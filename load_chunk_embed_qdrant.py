import os
import hashlib
import uuid
from pathlib import Path
from markdown import markdown
from bs4 import BeautifulSoup
from tqdm import tqdm
from sentence_transformers import SentenceTransformer
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct
from qdrant_client.http.models import Filter, FieldCondition, MatchValue
from dotenv import load_dotenv
from huggingface_hub import login
import os
import sys
import jwt
import requests
import boto3
from io import BytesIO

load_dotenv()

# === CONFIG ===
VAULT_PATH = "/Users/zachburns/Desktop/StoryRAG/lore"
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY")
QDRANT_HOST = os.getenv("QDRANT_HOST")
HG_FACE_READ_TOKEN = os.getenv("HG_FACE_READ_TOKEN")
COLLECTION_NAME = "lore_test"
EMBEDDING_MODEL = "BAAI/bge-small-en-v1.5"
CHUNK_SIZE = 500
CHUNK_OVERLAP = 100
#JWT_TOKEN=
JWT_TOKEN = os.getenv("COGNITO_TOKEN")
REGION = "us-east-1"  # your Cognito region
USER_POOL_ID = "us-east-1_3GBn9c4Qm" 
AUDIENCE = os.getenv("COGNITO_CLIENT_ID")

#HG_FACE login
if HG_FACE_READ_TOKEN:
    login(token=HG_FACE_READ_TOKEN)
else:
    raise ValueError("❌ Hugging Face token not found. Please set HG_FACE_READ_TOKEN in your .env file.")

# === HELPERS ===
def hash_to_uuid(text):
    return str(uuid.UUID(hashlib.sha256(text.encode("utf-8")).hexdigest()[0:32]))

def get_cognito_public_keys(region, user_pool_id):
    jwks_url = f'https://cognito-idp.{region}.amazonaws.com/{user_pool_id}/.well-known/jwks.json'
    return requests.get(jwks_url).json()

def decode_cognito_token(token, region, user_pool_id):
    jwks = get_cognito_public_keys(region, user_pool_id)
    unverified_header = jwt.get_unverified_header(token)
    key = next(k for k in jwks['keys'] if k['kid'] == unverified_header['kid'])
    public_key = jwt.algorithms.RSAAlgorithm.from_jwk(key)
    return jwt.decode(token, public_key, algorithms=["RS256"], audience=AUDIENCE)

try:
    decoded = decode_cognito_token(JWT_TOKEN, REGION, USER_POOL_ID)
    user_id = decoded["sub"]
except Exception as e:
    print("❌ Failed to decode token:", e)
    sys.exit(1)



# === STEP 1: Load & Chunk Markdown ===
def load_and_chunk_markdown(folder_path):
    chunks = []
    for file_path in Path(folder_path).rglob("*.md"):
        text = Path(file_path).read_text(encoding="utf-8")
        html = markdown(text)
        plain = BeautifulSoup(html, "html.parser").get_text()
        words = plain.split()

        for i in range(0, len(words), CHUNK_SIZE - CHUNK_OVERLAP):
            chunk_text = " ".join(words[i:i + CHUNK_SIZE])
            if chunk_text.strip():
                chunk_id = hash_to_uuid(chunk_text)
                chunks.append({
                    "id": chunk_id,
                    "text": chunk_text,
                    "metadata": {
                        "source": str(file_path.relative_to(folder_path)),
                        "user_id": user_id
                    }
                })
    return chunks

# === STEP 2: Filter Out Already Uploaded Chunks ===
def filter_new_chunks(client, collection_name, chunks):
    new_chunks = []
    for chunk in tqdm(chunks, desc="🔍 Checking for existing chunks"):
        try:
            result = client.retrieve(collection_name=collection_name, ids=[chunk["id"]], with_vectors=False)
            if not result:
                new_chunks.append(chunk)
        except:
            new_chunks.append(chunk)
    return new_chunks

# === STEP 3: Embed New Chunks ===
def embed_chunks(chunks, model_name):
    model = SentenceTransformer(model_name)
    texts = [chunk["text"] for chunk in chunks]
    vectors = model.encode(texts, show_progress_bar=True)
    return [
        {
            "id": chunk["id"],
            "embedding": vector.tolist(),
            "text": chunk["text"],
            "metadata": chunk["metadata"]
        }
        for vector, chunk in zip(vectors, chunks)
    ]

# === STEP 4: Upload to Qdrant Cloud ===
def upload_to_qdrant(embedded_chunks, client, collection_name):
    vector_dim = len(embedded_chunks[0]["embedding"])

    if not client.collection_exists(collection_name=collection_name):
        client.create_collection(
            collection_name=collection_name,
            vectors_config=VectorParams(size=vector_dim, distance=Distance.COSINE)
        )

    points = [
        PointStruct(
            id=chunk["id"],
            vector=chunk["embedding"],
            payload={
                "text": chunk["text"],
                **chunk["metadata"]
            }
        )
        for chunk in embedded_chunks
    ]

    client.upsert(collection_name=collection_name, points=points)

# === MAIN SCRIPT === python3 load_chunk_embed_qdrant.py
if __name__ == "__main__":
    print(f"📂 Loading and chunking Markdown files from {VAULT_PATH}...")
    chunks = load_and_chunk_markdown(VAULT_PATH)

    client = QdrantClient(url=QDRANT_HOST, api_key=QDRANT_API_KEY)

    print("🧠 Filtering out already uploaded chunks...")
    new_chunks = filter_new_chunks(client, COLLECTION_NAME, chunks)

    if not new_chunks:
        print("✅ No new content to upload.")
    else:
        print(f"🧠 Embedding {len(new_chunks)} new chunks...")
        embedded = embed_chunks(new_chunks, EMBEDDING_MODEL)

        print(f"⬆️ Uploading to Qdrant Cloud ({COLLECTION_NAME})...")
        upload_to_qdrant(embedded, client, COLLECTION_NAME)

        print("✅ Done.") 
