from fastapi import FastAPI, Query
from app.embed import embed_s3_markdown
from app.chat import run_chat_query

app = FastAPI()

@app.post("/embed")
def embed_route(
    user_id: str,
    project_folder: str = None
):
    return embed_s3_markdown(user_id, project_folder)

@app.post("/chat")
def chat_route(
    user_id: str = Query(...),
    project_folder: str = Query(...),
    question: str = Query(...)
):
    try:
        answer = run_chat_query(user_id, project_folder, question)
        return {"answer": answer}
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"error": str(e)}