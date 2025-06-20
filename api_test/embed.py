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
import sys
import jwt
import requests
import boto3
from io import BytesIO
from qdrant_client.models import PayloadSchemaType

# === ENVIRONMENT SETUP ===
load_dotenv()

QDRANT_API_KEY = os.getenv("QDRANT_API_KEY")
QDRANT_HOST = os.getenv("QDRANT_HOST")
HG_FACE_READ_TOKEN = os.getenv("HG_FACE_READ_TOKEN")
COLLECTION_NAME = "splitter"
EMBEDDING_MODEL = "BAAI/bge-small-en-v1.5"
CHUNK_SIZE = 500
CHUNK_OVERLAP = 100
JWT_TOKEN = os.getenv("COGNITO_TOKEN")
REGION = "us-east-1"
USER_POOL_ID = "us-east-1_3GBn9c4Qm"
AUDIENCE = os.getenv("COGNITO_CLIENT_ID")
S3_BUCKET_NAME = os.getenv("S3_BUCKET_NAME")
user_id="b4b8d418-50d1-70cc-cc15-3500f85e6de3"

s3_client = boto3.client("s3")

# Hugging Face Login
if HG_FACE_READ_TOKEN:
    login(token=HG_FACE_READ_TOKEN)
else:
    raise ValueError("❌ Hugging Face token not found. Please set HG_FACE_READ_TOKEN in your .env file.")

#=== HELPERS ===
def hash_to_uuid(text):
    return str(uuid.UUID(hashlib.sha256(text.encode("utf-8")).hexdigest()[0:32]))


def load_and_chunk_markdown_from_s3(bucket_name, user_id):
    chunks = []
    response = s3_client.list_objects_v2(Bucket=bucket_name, Prefix=f"users/{user_id}/")

    # if "Contents" not in response:
    #     print(f"❌ No contents found under s3://{bucket_name}/{user_id}/")
    # else:
    #     print(f"✅ Found {len(response['Contents'])} objects:")
    #     for obj in response["Contents"]:
    #         print(" -", obj["Key"])
    
    
    for obj in response["Contents"]:
        print(" -", obj["Key"])
    
    for obj in response.get("Contents", []):
        key = obj["Key"]
        if not key.endswith(".md"):
            continue

        s3_response = s3_client.get_object(Bucket=bucket_name, Key=key)
        text = s3_response["Body"].read().decode("utf-8")

        html = markdown(text)
        plain = BeautifulSoup(html, "html.parser").get_text()
        words = plain.split()

        for i in range(0, len(words), CHUNK_SIZE - CHUNK_OVERLAP):
            chunk_text = " ".join(words[i:i + CHUNK_SIZE])
            if chunk_text.strip():
                chunk_id = hash_to_uuid(chunk_text)
                parts = key.split("/")
                project_folder = parts[2] if len(parts) > 3 else "root"
                filename = parts[-1]

                chunks.append({
                    "id": chunk_id,
                    "text": chunk_text,
                    "metadata": {
                        "user_id": str(user_id),
                        "project_folder": project_folder,
                        "filename": filename,
                        "source": key
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

def ensure_metadata_indexes(client, collection_name):
    required_indexes = {
        "user_id": PayloadSchemaType.KEYWORD,
        "project_folder": PayloadSchemaType.KEYWORD,
        "filename": PayloadSchemaType.KEYWORD,
    }

    existing_indexes = client.get_collection(collection_name).payload_schema

    for field, schema in required_indexes.items():
        if field not in existing_indexes:
            print(f"🔧 Creating index on: {field}")
            client.create_payload_index(
                collection_name=collection_name,
                field_name=field,
                field_schema=schema
            )

# === STEP 4: Upload to Qdrant Cloud ===
def upload_to_qdrant(embedded_chunks, client, collection_name):
    vector_dim = len(embedded_chunks[0]["embedding"])

    if not client.collection_exists(collection_name=collection_name):
        client.create_collection(
            collection_name=collection_name,
            vectors_config=VectorParams(size=vector_dim, distance=Distance.COSINE)
        )

    # 🆕 Ensure proper metadata indexes exist
    ensure_metadata_indexes(client, collection_name)

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

# === MAIN SCRIPT ===
if __name__ == "__main__":
    print(f"📂 Loading and chunking Markdown files from s3://{S3_BUCKET_NAME}/{user_id}/")
    chunks = load_and_chunk_markdown_from_s3(S3_BUCKET_NAME, user_id)

    client = QdrantClient(url=QDRANT_HOST, api_key=QDRANT_API_KEY)

    print("🧠 Filtering out already uploaded chunks...")
    new_chunks = chunks
    #new_chunks = filter_new_chunks(client, COLLECTION_NAME, chunks)

    if not new_chunks:
        print("✅ No new content to upload.")
    else:
        print(f"🧠 Embedding {len(new_chunks)} new chunks...")
        embedded = embed_chunks(new_chunks, EMBEDDING_MODEL)

        print(f"⬆️ Uploading to Qdrant Cloud ({COLLECTION_NAME})...")
        upload_to_qdrant(embedded, client, COLLECTION_NAME)

        print("✅ Done.")