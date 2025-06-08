from fastapi import FastAPI, Query
from app.embed import embed_s3_markdown

app = FastAPI()

@app.post("/embed")
def embed_route(
    user_id: str = Query(..., description="User ID to load from S3"),
    project_folder: str = Query(None, description="Optional project folder under user's S3 path")
):
    return embed_s3_markdown(user_id, project_folder)