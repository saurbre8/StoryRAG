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

def run_chat_query(user_id: str, project_folder: str, session_id: str, question: str) -> str:
    # 1) Load secrets
    qdrant_api_key = os.getenv("QDRANT_API_KEY")
    qdrant_host    = os.getenv("QDRANT_HOST")
    openai_api_key = os.getenv("OPENAI_API_KEY")
    redis_host     = os.getenv("REDIS_HOST", "localhost")
    redis_port     = int(os.getenv("REDIS_PORT", "6379"))
    redis_password = os.getenv("REDIS_PASSWORD2", "")
    collection_name = "splitter"

    # 2) Initialize Redis‐backed memory buffer
    chat_store = RedisChatStore(
        redis_url=f"redis://default:{redis_password}@{redis_host}:{redis_port}",
        ttl=3600
    )
    memory = ChatMemoryBuffer.from_defaults(
        chat_store=chat_store,
        chat_store_key=session_id
    )

    # 3) Put the new user message into memory
    memory.put(ChatMessage(role="user", content=question))

    # 4) Initialize Qdrant‐based VectorStore
    qdrant_client = QdrantClient(url=qdrant_host, api_key=qdrant_api_key)
    vector_store  = QdrantVectorStore(client=qdrant_client, collection_name=collection_name)

    # 5) Configure LlamaIndex’s LLM + Embedding settings
    Settings.llm = OpenAI(
        api_key=openai_api_key,
        model="gpt-3.5-turbo",
        temperature=0.3
    )
    Settings.embed_model = OpenAIEmbedding(
        model="text-embedding-3-small",
        api_key=openai_api_key
    )

    # 6) Build a Retriever that filters by user_id & project_folder
    index = VectorStoreIndex.from_vector_store(vector_store)
    retriever = VectorIndexRetriever(
        index=index,
        similarity_top_k=5,   # retrieve up to 5 candidates
        filters=MetadataFilters(filters=[
            MetadataFilter(key="user_id", value=str(user_id)),
            MetadataFilter(key="project_folder", value=project_folder),
        ])
    )

    # 7) Retrieve top‐k and check similarity scores
    #    NOTE: `retrieve()` returns a list of NodeWithScore objects,
    #    where `.score` is the similarity value (0 to 1).
    candidates = retriever.retrieve(question)
    SCORE_THRESHOLD = 0.65

    # If there are no candidates or the top candidate’s score is < threshold → fallback
    if not candidates or candidates[0].score < SCORE_THRESHOLD:
        # ——————————————————————————————————————————————
        # Fallback to chat‐only: LLM sees full conversation history
        # ——————————————————————————————————————————————
        history_messages = [
            ChatMessage(role=MessageRole(msg.role.value), content=msg.content)
            for msg in memory.get()
        ]
        history_messages.append(ChatMessage(role=MessageRole.USER, content=question))

        llm = Settings.llm
        llm_response = llm.chat(messages=history_messages)

        # Extract assistant text (either .content or .response)
        if hasattr(llm_response, "content"):
            assistant_text = llm_response.content
        else:
            assistant_text = llm_response.message.content

        # Store the assistant response in memory
        memory.put(ChatMessage(role="assistant", content=assistant_text))
        return assistant_text

    # ——————————————————————————————————————————————
    # Otherwise: At least one document ≥ SCORE_THRESHOLD → do RAG
    # ——————————————————————————————————————————————
    qa_prompt = ChatPromptTemplate(
        message_templates=[
            ChatMessage(
                role=MessageRole.SYSTEM,
                content=(
                    "You are a creative worldbuilding assistant for the Egothare fantasy setting.\n"
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

    # 8) Create the RetrieverQueryEngine with memory
    query_engine = RetrieverQueryEngine.from_args(
        retriever=retriever,
        text_qa_template=qa_prompt,
        memory=memory
    )

    # 9) Run the RAG‐style query
    response = query_engine.query(question)

    # 10) Store the assistant’s reply in memory
    memory.put(ChatMessage(role="assistant", content=response.response))

    # 11) (Optional) Debug: print the final assembled prompt
    history_list = memory.get()
    chat_history_text = "\n".join(
        f"{msg.role.value}: {msg.content}"
        for msg in history_list
    )
    assembled_prompt = qa_prompt.format_messages(
        context_str="(optional context)",
        query_str=question,
        chat_history=chat_history_text
    )
    print("🚨 Assembled prompt before LLM call:")
    for msg in assembled_prompt:
        print(f"{msg.role}: {msg.content}")

    # 12) Return the assistant’s RAG answer
    return response.response