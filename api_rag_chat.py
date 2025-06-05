from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, Optional
import uuid
import os
import logging

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

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# === Load secrets ===
load_dotenv()
qdrant_api_key = os.getenv("QDRANT_API_KEY")
qdrant_host = os.getenv("QDRANT_HOST")
collection_name = "splitter"
openai_api_key = os.getenv("OPENAI_API_KEY")

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

##retriever = VectorIndexRetriever(
##    index=index,
##    similarity_top_k=3,
##    filters=MetadataFilters(filters=[
##        MetadataFilter(key="user_id", value=str(user_id)),
##        MetadataFilter(key="project_folder", value=project_folder)
##    ])
##)

qa_prompt = PromptTemplate(
    "You are a creative worldbuilding assistant for a fantasy setting.\n"
    "Context information:\n{context_str}\n\n"
    "Query: {query_str}\n\n"
    "Answer creatively while staying true to the world's tone and themes, dont create anything new unless asked to.:"
)

##query_engine = RetrieverQueryEngine.from_args(
##    retriever=retriever,
##    text_qa_template=qa_prompt
##)

# === Memory store ===
session_memory: Dict[str, list] = {}

# === FastAPI ===
app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://yourdomain.com"],  # Add your frontend URLs
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatInput(BaseModel):
    session_id: str
    message: str
    user_id: Optional[str] = None
    project_folder: Optional[str] = None

@app.post("/chat")
async def chat(input: ChatInput):
    try:
        session_id = input.session_id or str(uuid.uuid4())
        message = input.message
        
        # Require user_id and project_folder from the request - no fallbacks
        if not input.user_id:
            return {"error": "user_id is required"}
        if not input.project_folder:
            return {"error": "project_folder is required"}
            
        project_name = input.project_folder
        user_id_param = input.user_id
        
        logger.info(f"Using dynamic values - User: {user_id_param}, Project: {project_name}")

        # Create a NEW retriever with the dynamic filters for each request
        dynamic_retriever = VectorIndexRetriever(
            index=index,
            similarity_top_k=3,
            filters=MetadataFilters(filters=[
                MetadataFilter(key="user_id", value=str(user_id_param)),
                MetadataFilter(key="project_folder", value=project_name)
            ])
        )

        # Create a NEW query engine with the dynamic retriever
        dynamic_query_engine = RetrieverQueryEngine.from_args(
            retriever=dynamic_retriever,
            text_qa_template=qa_prompt
        )

        # Use project-specific memory
        memory_key = f"{session_id}_{project_name}"
        if memory_key not in session_memory:
            session_memory[memory_key] = []

        session_memory[memory_key].append({"user": message})
        
        # Query with the dynamic engine
        response = dynamic_query_engine.query(message).response
        
        if not response or response.strip() == "":
            response = f"I don't have enough context about '{project_name}' to answer that question. Please make sure you have uploaded content for this project."

        session_memory[memory_key].append({"assistant": response})

        return {
            "session_id": session_id,
            "response": response,
            "project": project_name,
            "user": user_id_param,
            "memory": session_memory[memory_key]
        }
        
    except Exception as e:
        logger.error(f"Error in chat endpoint: {str(e)}")
        return {
            "session_id": session_id,
            "response": f"Sorry, I encountered an error: {str(e)}",
            "error": True
        }