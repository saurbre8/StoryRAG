from fastapi import FastAPI, Request
from pydantic import BaseModel
from typing import Dict
import uuid
import os

from qdrant_client.models import Filter, FieldCondition, MatchValue
from llama_index.core.retrievers import VectorIndexRetriever
from qdrant_client import QdrantClient
from llama_index.core import VectorStoreIndex
from llama_index.core.query_engine import RetrieverQueryEngine
from llama_index.vector_stores.qdrant import QdrantVectorStore
from llama_index.llms.openai import OpenAI
from llama_index.core.settings import Settings
from llama_index.core.base.embeddings.base import BaseEmbedding
from sentence_transformers import SentenceTransformer
from llama_index.core.prompts import PromptTemplate
from llama_index.core.vector_stores.types import MetadataFilter, MetadataFilters
from dotenv import load_dotenv

# === Load secrets ===
load_dotenv()
qdrant_api_key = os.getenv("QDRANT_API_KEY")
qdrant_host = os.getenv("QDRANT_HOST")
collection_name = "splitter"
openai_api_key = os.getenv("OPENAI_API_KEY")

user_id = os.getenv("USER_ID", "demo_user")
project_folder = os.getenv("PROJECT_FOLDER", "egothare")

# === Embedding ===
class MiniLMMEmbedding(BaseEmbedding):
    def __init__(self):
        super().__init__()
        self._model = SentenceTransformer("BAAI/bge-small-en-v1.5")

    def _get_text_embedding(self, text: str):
        return self._model.encode(text).tolist()

    def _get_query_embedding(self, query: str):
        return self._model.encode(query).tolist()

    async def _aget_text_embedding(self, text: str):
        return self._get_text_embedding(text)

    async def _aget_query_embedding(self, query: str):
        return self._get_query_embedding(query)

# === Set up LLM and vector index ===
embed_model = MiniLMMEmbedding()
llm = OpenAI(model="gpt-3.5-turbo", temperature=0.3)

qdrant_client = QdrantClient(url=qdrant_host, api_key=qdrant_api_key)
vector_store = QdrantVectorStore(client=qdrant_client, collection_name=collection_name)
Settings.llm = llm
Settings.embed_model = embed_model

index = VectorStoreIndex.from_vector_store(vector_store)

retriever = VectorIndexRetriever(
    index=index,
    similarity_top_k=3,
    filters=MetadataFilters(filters=[
        MetadataFilter(key="user_id", value=str(user_id)),
        MetadataFilter(key="project_folder", value=project_folder)
    ])
)

qa_prompt = PromptTemplate(
    "You are a creative worldbuilding assistant for the Egothare fantasy setting.\n"
    "Context information:\n{context_str}\n\n"
    "Query: {query_str}\n\n"
    "Answer creatively while staying true to the world's tone and themes:"
)

query_engine = RetrieverQueryEngine.from_args(
    retriever=retriever,
    text_qa_template=qa_prompt
)

# === Memory store ===
session_memory: Dict[str, list] = {}

# === FastAPI ===
app = FastAPI()

class ChatInput(BaseModel):
    session_id: str
    message: str

@app.post("/chat")
async def chat(input: ChatInput):
    session_id = input.session_id or str(uuid.uuid4())
    message = input.message

    # Memory initialization
    if session_id not in session_memory:
        session_memory[session_id] = []

    session_memory[session_id].append({"user": message})
    response = query_engine.query(message).response
    session_memory[session_id].append({"assistant": response})

    return {
        "session_id": session_id,
        "response": response,
        "memory": session_memory[session_id]
    }