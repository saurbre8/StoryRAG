from fastapi import FastAPI, Query, HTTPException
from app.embed import embed_s3_markdown
from fastapi.middleware.cors import CORSMiddleware
from app.chat import run_chat_query
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",  # React development server
        "https://yourdomain.com",  # Your production domain (if you have one)
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)

@app.get("/health")
async def health_check():
    return {"status": "healthy", "message": "API is running"}

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
async def chat_route(
    user_id: str = Query(...),
    project_folder: str = Query(...),
    session_id: str = Query(...),
    question: str = Query(...),
    debug: bool = Query(False),
    system_prompt: str = Query(None),
    score_threshold: float = Query(0.5, ge=0.0, le=1.0, description="Minimum similarity score for document retrieval (0.0-1.0)")
):
    try:
        if not user_id or not project_folder or not question or not session_id:
            raise HTTPException(status_code=400, detail="All fields are required")

        result = run_chat_query(user_id, project_folder, session_id, question, debug=debug, system_prompt=system_prompt, score_threshold=score_threshold)
        
        # Handle the tuple return value (assistant_text, debug_output)
        if isinstance(result, tuple) and len(result) == 2:
            assistant_text, debug_output = result
            response = {"answer": assistant_text}
            if debug and debug_output:
                response["debug_output"] = debug_output
            return response
        else:
            # Fallback for non-tuple return (backward compatibility)
            return {"answer": result}
    except Exception as e:
        logger.error(f"Chat error: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")