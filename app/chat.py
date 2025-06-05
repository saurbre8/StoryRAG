import os
from dotenv import load_dotenv
from qdrant_client import QdrantClient
from qdrant_client.models import Filter, FieldCondition, MatchValue
from llama_index.core.retrievers import VectorIndexRetriever
from llama_index.vector_stores.qdrant import QdrantVectorStore
from llama_index.core import VectorStoreIndex
from llama_index.core.query_engine import RetrieverQueryEngine
from llama_index.llms.openai import OpenAI
from llama_index.core.settings import Settings
from llama_index.core.base.embeddings.base import BaseEmbedding
from llama_index.core.prompts import PromptTemplate
from llama_index.core.vector_stores.types import MetadataFilter, MetadataFilters
from llama_index.embeddings.openai import OpenAIEmbedding

load_dotenv()

# === Embedding wrapper ===
def run_chat_query(user_id: str, project_folder: str, question: str) -> str:
    qdrant_api_key = os.getenv("QDRANT_API_KEY")
    qdrant_host = os.getenv("QDRANT_HOST")
    openai_api_key = os.getenv("OPENAI_API_KEY")
    collection_name = "splitter"

    # Init Qdrant
    qdrant_client = QdrantClient(url=qdrant_host, api_key=qdrant_api_key)
    vector_store = QdrantVectorStore(client=qdrant_client, collection_name=collection_name)

    # Settings
    Settings.llm = OpenAI(api_key=openai_api_key, model="gpt-3.5-turbo", temperature=0.3)
    Settings.embed_model = OpenAIEmbedding(model="text-embedding-3-small", api_key=openai_api_key)

    # Retriever
    retriever = VectorIndexRetriever(
        index=VectorStoreIndex.from_vector_store(vector_store),
        similarity_top_k=3,
        filters=MetadataFilters(filters=[
            MetadataFilter(key="user_id", value=str(user_id)),
            MetadataFilter(key="project_folder", value=project_folder),
        ])
    )

    # Prompt
    qa_prompt = PromptTemplate(
        "You are a creative worldbuilding assistant for the Egothare fantasy setting. "
        "Use the context information below as inspiration, but feel free to extrapolate...\n\n"
        "Context information:\n{context_str}\n\n"
        "Query: {query_str}\n\n"
        "Answer creatively while staying true to the world's tone and themes:"
    )

    query_engine = RetrieverQueryEngine.from_args(retriever=retriever, text_qa_template=qa_prompt)
    response = query_engine.query(question)

    return response.response