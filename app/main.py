from fastapi import FastAPI
from app.embed import embed_s3_markdown

app = FastAPI()  # ✅ THIS is what uvicorn is looking for

@app.post("/embed")
def embed_route(
    user_id: str,
    project_folder: str = None
):
    return embed_s3_markdown(user_id, project_folder)