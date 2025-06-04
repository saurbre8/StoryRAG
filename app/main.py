from fastapi import FastAPI, Query, HTTPException
from app.embed import embed_s3_markdown
from app.chat import run_chat_query
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

@app.post("/embed")
def embed_route(
    user_id: str = Query(...),
    project_folder: str = Query(None)
):
    try:
        if not user_id:
            raise HTTPException(status_code=400, detail="user_id is required")
        return embed_s3_markdown(user_id, project_folder)
    except Exception as e:
        logger.error(f"Embed error: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.post("/chat")
def chat_route(
    user_id: str = Query(...),
    project_folder: str = Query(...),
    question: str = Query(...)
):
    try:
        if not user_id or not project_folder or not question:
            raise HTTPException(status_code=400, detail="All fields are required")
        answer = run_chat_query(user_id, project_folder, question)
        return {"answer": answer}
    except Exception as e:
        logger.error(f"Chat error: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")