# python3 -m streamlit run chat_ui.py
import os
import streamlit as st
from dotenv import load_dotenv
from qdrant_client import QdrantClient
from llama_index.core import VectorStoreIndex
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

# === MiniLM embedding model ===
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

# === LLM + Embedding setup ===
llm = OpenAI(model="gpt-3.5-turbo", temperature=0.3)
embed_model = MiniLMMEmbedding()

Settings.llm = llm
Settings.embed_model = embed_model

# === Connect to Qdrant ===
client = QdrantClient(url=qdrant_host, api_key=qdrant_api_key)
vector_store = QdrantVectorStore(client=client, collection_name=collection_name)
index = VectorStoreIndex.from_vector_store(vector_store)
query_engine = index.as_query_engine(similarity_top_k=3)

# === Streamlit UI ===
st.set_page_config(page_title="StoryRAG Chat", page_icon="📚")
st.title("🧠 Obsidian RAG Chat")

if "chat_history" not in st.session_state:
    st.session_state.chat_history = []

user_input = st.text_input("Ask something about your lore...", "")

if st.button("Send") and user_input:
    response = query_engine.query(user_input)
    st.session_state.chat_history.append(("You", user_input))
    st.session_state.chat_history.append(("Bot", response.response))

st.markdown("---")
for sender, msg in reversed(st.session_state.chat_history):
    st.markdown(f"**{sender}:** {msg}")