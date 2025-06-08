import os
import hashlib
import uuid
from pathlib import Path
from markdown import markdown
from bs4 import BeautifulSoup
from tqdm import tqdm
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct
from qdrant_client.http.models import Filter, FieldCondition, MatchValue
from dotenv import load_dotenv
import sys
import requests
import boto3
from io import BytesIO
from qdrant_client.models import PayloadSchemaType
from openai import OpenAI

# === ENVIRONMENT SETUP ===
load_dotenv()

QDRANT_API_KEY = os.getenv("QDRANT_API_KEY")
QDRANT_HOST = os.getenv("QDRANT_HOST")
HG_FACE_READ_TOKEN = os.getenv("HG_FACE_READ_TOKEN")
COLLECTION_NAME = "splitter"
EMBEDDING_MODEL = "text-embedding-3-small"
CHUNK_SIZE = 500
CHUNK_OVERLAP = 100
JWT_TOKEN = os.getenv("COGNITO_TOKEN")
REGION = "us-east-1"
USER_POOL_ID = "us-east-1_3GBn9c4Qm"
AUDIENCE = os.getenv("COGNITO_CLIENT_ID")
S3_BUCKET_NAME = os.getenv("S3_BUCKET_NAME")
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
s3_client = boto3.client("s3")

#=== HELPERS ===
def hash_to_uuid(text):
    return str(uuid.UUID(hashlib.sha256(text.encode("utf-8")).hexdigest()[0:32]))

def load_and_chunk_markdown_from_s3(bucket_name, user_id, project_folder=None, debug=False):
    chunks = []
    prefix = f"users/{user_id}/"
    if project_folder:
        prefix += f"{project_folder}/"

    if debug:
        print(f"\n🔍 Listing objects in s3://{bucket_name}/{prefix}")
    response = s3_client.list_objects_v2(Bucket=bucket_name, Prefix=prefix)
    
    if debug:
        print(f"📁 Found {len(response.get('Contents', []))} objects in S3")
    
    for obj in response.get("Contents", []):
        key = obj["Key"]
        if not key.endswith(".md"):
            continue

        if debug:
            print(f"\n📄 Processing file: {key}")
        s3_response = s3_client.get_object(Bucket=bucket_name, Key=key)
        text = s3_response["Body"].read().decode("utf-8")

        html = markdown(text)
        plain = BeautifulSoup(html, "html.parser").get_text()
        words = plain.split()

        if debug:
            print(f"📝 Found {len(words)} words in {key}")
        
        for i in range(0, len(words), CHUNK_SIZE - CHUNK_OVERLAP):
            chunk_text = " ".join(words[i:i + CHUNK_SIZE])
            if chunk_text.strip():
                chunk_id_input = f"{user_id}|{project_folder}|{chunk_text}"
                chunk_id = hash_to_uuid(chunk_id_input)
                parts = key.split("/")
                file_project_folder = parts[2] if len(parts) > 3 else "root"
                filename = parts[-1]

                chunks.append({
                    "id": chunk_id,
                    "text": chunk_text,
                    "metadata": {
                        "user_id": str(user_id),
                        "project_folder": file_project_folder,
                        "filename": filename,
                        "source": key
                    }
                })
    
    if debug:
        print(f"\n📦 Generated {len(chunks)} chunks from all files")
    return chunks

# === STEP 2: Filter Out Already Uploaded Chunks ===
def filter_new_chunks(client, collection_name, chunks, debug=False):
    new_chunks = []
    if debug:
        print(f"\n🔍 Checking {len(chunks)} chunks against existing database...")
    
    # First, get all existing IDs in one batch
    existing_ids = set()
    for i in range(0, len(chunks), 100):
        batch = chunks[i:i+100]
        batch_ids = [chunk["id"] for chunk in batch]
        try:
            results = client.retrieve(collection_name=collection_name, ids=batch_ids, with_vectors=False)
            existing_ids.update(result.id for result in results)
        except Exception as e:
            if debug:
                print(f"⚠️ Error checking batch: {e}")
    
    if debug:
        print(f"📊 Found {len(existing_ids)} existing chunks in database")
    
    # Filter chunks that don't exist
    new_chunks = [chunk for chunk in chunks if chunk["id"] not in existing_ids]
    if debug:
        print(f"✨ Found {len(new_chunks)} new chunks to add")
    
    return new_chunks

# === STEP 3: Embed New Chunks ===
def embed_chunks(chunks, model_name="text-embedding-3-small", debug=False):
    texts = [chunk["text"] for chunk in chunks]
    embedded_chunks = []

    if debug:
        print("📦 Sending chunks to OpenAI for embedding...")

    for i in tqdm(range(0, len(texts), 100), desc="🔌 Embedding with OpenAI"):
        batch = texts[i:i+100]

        for attempt in range(5):
            try:
                response = client.embeddings.create(input=batch, model=model_name)
                break
            except Exception as e:
                if debug:
                    print(f"⚠️ Attempt {attempt+1} failed: {e}")
                time.sleep(2 ** attempt)
        else:
            raise RuntimeError("❌ Failed to embed after 5 retries.")

        embeddings = [record.embedding for record in response.data]

        for j, vector in enumerate(embeddings):
            chunk = chunks[i + j]
            embedded_chunks.append({
                "id": chunk["id"],
                "embedding": vector,
                "text": chunk["text"],
                "metadata": chunk["metadata"]
            })

    return embedded_chunks


def ensure_metadata_indexes(client, collection_name, debug=False):
    required_indexes = {
        "user_id": PayloadSchemaType.KEYWORD,
        "project_folder": PayloadSchemaType.KEYWORD,
        "filename": PayloadSchemaType.KEYWORD,
    }

    existing_indexes = client.get_collection(collection_name).payload_schema

    for field, schema in required_indexes.items():
        if field not in existing_indexes:
            if debug:
                print(f"🔧 Creating index on: {field}")
            client.create_payload_index(
                collection_name=collection_name,
                field_name=field,
                field_schema=schema
            )

# === STEP 4: Upload to Qdrant Cloud ===
def upload_to_qdrant(embedded_chunks, client, collection_name, debug=False):
    vector_dim = len(embedded_chunks[0]["embedding"])

    if not client.collection_exists(collection_name=collection_name):
        client.create_collection(
            collection_name=collection_name,
            vectors_config=VectorParams(size=vector_dim, distance=Distance.COSINE)
        )

    # 🆕 Ensure proper metadata indexes exist
    ensure_metadata_indexes(client, collection_name, debug)

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
def embed_s3_markdown(user_id: str, project_folder: str = None, debug: bool = False):
    if debug:
        print(f"📂 Loading and chunking Markdown files from s3://{S3_BUCKET_NAME}/{user_id}/")
    chunks = load_and_chunk_markdown_from_s3(S3_BUCKET_NAME, user_id, project_folder, debug)

    client = QdrantClient(url=QDRANT_HOST, api_key=QDRANT_API_KEY)

    if debug:
        print("🧠 Filtering out already uploaded chunks...")
    new_chunks = filter_new_chunks(client, COLLECTION_NAME, chunks, debug)

    if not new_chunks:
        return {"message": "✅ No new content to upload."}

    if debug:
        print(f"🧠 Embedding {len(new_chunks)} new chunks...")
    embedded = embed_chunks(new_chunks, EMBEDDING_MODEL, debug)

    if debug:
        print(f"⬆️ Uploading to Qdrant Cloud ({COLLECTION_NAME})...")
    upload_to_qdrant(embedded, client, COLLECTION_NAME, debug)

    return {"message": f"✅ Uploaded {len(embedded)} chunks to Qdrant."}