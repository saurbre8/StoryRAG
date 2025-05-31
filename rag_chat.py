#pip install -r requirements.txt
import os
from dotenv import load_dotenv
from qdrant_client import QdrantClient
from llama_index.core import VectorStoreIndex
from llama_index.core.query_engine import RetrieverQueryEngine
from llama_index.vector_stores.qdrant import QdrantVectorStore
from llama_index.llms.openai import OpenAI
from llama_index.core.settings import Settings
from llama_index.core.base.embeddings.base import BaseEmbedding
from sentence_transformers import SentenceTransformer

# === Load secrets ===
load_dotenv()
qdrant_api_key = os.getenv("QDRANT_API_KEY")
qdrant_host = os.getenv("QDRANT_HOST")
collection_name = "lore_test"
openai_api_key = os.getenv("OPENAI_API_KEY")

# === Custom MiniLM Embedding ===
class MiniLMMEmbedding(BaseEmbedding):
    def __init__(self):
        super().__init__()
        self._model = SentenceTransformer("all-MiniLM-L6-v2")

    def _get_text_embedding(self, text: str):
        return self._model.encode(text).tolist()

    def _get_query_embedding(self, query: str):
        return self._model.encode(query).tolist()

    async def _aget_text_embedding(self, text: str):
        return self._get_text_embedding(text)

    async def _aget_query_embedding(self, query: str):
        return self._get_query_embedding(query)

embed_model = MiniLMMEmbedding()

# === Initialize LLM ===
llm = OpenAI(model="gpt-3.5-turbo", temperature=0.3)

# === Connect to Qdrant ===
qdrant_client = QdrantClient(
    url=qdrant_host,
    api_key=qdrant_api_key,
)

vector_store = QdrantVectorStore(
    client=qdrant_client,
    collection_name=collection_name,
)

# === Set global embedding + LLM ===
Settings.llm = llm
Settings.embed_model = embed_model

# === Build index & query engine ===
index = VectorStoreIndex.from_vector_store(vector_store)
query_engine = index.as_query_engine(similarity_top_k=3)

# === Run interactive chat loop ===
if __name__ == "__main__":
    print("🧠 Ask your Obsidian-powered assistant something (Ctrl+C to exit):")
    while True:
        try:
            question = input("\n> ")
            answer = query_engine.query(question)
            print(f"\n💬 {answer.response}")
        except KeyboardInterrupt:
            print("\n👋 Goodbye!")
            break