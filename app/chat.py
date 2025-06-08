import os
from dotenv import load_dotenv
from qdrant_client import QdrantClient
from llama_index.core import VectorStoreIndex
from llama_index.core.query_engine import RetrieverQueryEngine
from llama_index.vector_stores.qdrant import QdrantVectorStore
from llama_index.core.retrievers import VectorIndexRetriever
from llama_index.llms.openai import OpenAI
from llama_index.core.settings import Settings
from llama_index.embeddings.openai import OpenAIEmbedding
from llama_index.core.vector_stores.types import MetadataFilter, MetadataFilters
from llama_index.core.memory import ChatMemoryBuffer
from llama_index.core.llms import ChatMessage, MessageRole
from llama_index.storage.chat_store.redis import RedisChatStore
from llama_index.core.prompts import ChatPromptTemplate
load_dotenv()

def run_chat_query(user_id: str, project_folder: str, session_id: str, question: str, debug: bool = False) -> str:
    # 1) Load secrets uvicorn app.main:app --host 0.0.0.0 --port 8000
    qdrant_api_key = os.getenv("QDRANT_API_KEY")
    qdrant_host    = os.getenv("QDRANT_HOST")
    openai_api_key = os.getenv("OPENAI_API_KEY")
    redis_host     = os.getenv("REDIS_HOST", "localhost")
    redis_port     = int(os.getenv("REDIS_PORT", "6379"))
    redis_password = os.getenv("REDIS_PASSWORD2", "")
    collection_name = "splitter"

    # 2) Redis-backed memory buffer
    chat_store = RedisChatStore(
        redis_url=f"redis://default:{redis_password}@{redis_host}:{redis_port}",
        ttl=3600
    )
    memory = ChatMemoryBuffer.from_defaults(
        chat_store=chat_store,
        chat_store_key=session_id
    )

    # 3) Add user message to memory
    memory.put(ChatMessage(role=MessageRole.USER, content=question))

    # 4) Qdrant VectorStore
    qdrant_client = QdrantClient(url=qdrant_host, api_key=qdrant_api_key)
    vector_store  = QdrantVectorStore(client=qdrant_client, collection_name=collection_name)

    # 5) LLM + Embeddings
    Settings.llm = OpenAI(
        api_key=openai_api_key,
        model="gpt-3.5-turbo",
        temperature=0.3
    )
    Settings.embed_model = OpenAIEmbedding(
        model="text-embedding-3-small",
        api_key=openai_api_key
    )

    # 6) Retriever with filters
    index = VectorStoreIndex.from_vector_store(vector_store)
    retriever = VectorIndexRetriever(
        index=index,
        similarity_top_k=5,
        filters=MetadataFilters(filters=[
            MetadataFilter(key="user_id", value=str(user_id)),
            MetadataFilter(key="project_folder", value=project_folder),
        ])
    )

    candidates = retriever.retrieve(question)
    SCORE_THRESHOLD = 0.5

    if debug:
        print(f"\n🔍 Retrieved {len(candidates)} candidates")
        print("\n📊 All retrieved candidates with scores:")
        for i, c in enumerate(candidates):
            content_preview = c.node.get_content()[:100] + "..." if len(c.node.get_content()) > 100 else c.node.get_content()
            print(f"\nCandidate {i+1}:")
            print(f"Score: {c.score:.3f}")
            print(f"Content: {content_preview}")
            print(f"Metadata: {c.node.metadata}")

    # Filter candidates by similarity score
    filtered_candidates = [c for c in candidates if c.score >= SCORE_THRESHOLD]
    
    if debug:
        print(f"\n📈 Filtered to {len(filtered_candidates)} candidates above threshold {SCORE_THRESHOLD}")
        for i, c in enumerate(filtered_candidates):
            print(f"Filtered Candidate {i+1} score: {c.score:.3f}")
    
    # If no candidates meet the threshold, use memory-only approach
    if not filtered_candidates:
        history_messages = [
            ChatMessage(role=MessageRole(msg.role.lower()), content=msg.content)
            for msg in memory.get()
        ]
        history_messages.append(ChatMessage(role=MessageRole.USER, content=question))

        llm = Settings.llm
        llm_response = llm.chat(messages=history_messages)

        assistant_text = getattr(llm_response, "content", None)
        if not assistant_text:
            assistant_text = getattr(getattr(llm_response, "message", {}), "content", "")

        memory.put(ChatMessage(role=MessageRole.ASSISTANT, content=assistant_text))

        if debug:
            print_chat_history(memory, session_id)

        return assistant_text

    # 8) RAG prompt setup
    qa_prompt = ChatPromptTemplate(
        message_templates=[
            ChatMessage(
                role=MessageRole.SYSTEM,
                content=(
                    "You are a creative worldbuilding assistant for writers.\n"
                    "Here is some relevant context to help you answer:\n"
                    "{context_str}\n\n"
                    "Below is the conversation so far:\n"
                    "{chat_history}\n\n"
                    "Use that context when answering the user. Be consistent and engaging."
                )
            ),
            ChatMessage(
                role=MessageRole.USER,
                content="{query_str}"
            )
        ]
    )

    # 9) Query engine with memory
    query_engine = RetrieverQueryEngine.from_args(
        retriever=retriever,
        text_qa_template=qa_prompt,
        memory=memory
    )

    response = query_engine.query(question)
    assistant_text = getattr(response, "response", getattr(response, "message", response))

    memory.put(ChatMessage(role=MessageRole.ASSISTANT, content=assistant_text))

    if debug:
        history_list = memory.get()
        context_str = "\n\n".join([node.get_content() for node in filtered_candidates])
        chat_history_text = "\n".join(
            f"{getattr(msg.role, 'value', str(msg.role)).upper()}: {msg.content}"
            for msg in history_list
        )
        assembled_prompt = qa_prompt.format_messages(
            context_str=context_str,
            query_str=question,
            chat_history=chat_history_text
        )

        print("\n🚨 Assembled prompt before LLM call:")
        for msg in assembled_prompt:
            print(f"{msg.role}: {msg.content}\n")

        print_chat_history(memory, session_id)

    return assistant_text


def print_chat_history(memory: ChatMemoryBuffer, session_id: str):
    print(f"\n🧠 Chat History for Session `{session_id}`:\n" + "-" * 40)
    for msg in memory.get():
        role_str = getattr(msg.role, 'value', str(msg.role)).upper()
        print(f"{role_str}: {msg.content}\n")
