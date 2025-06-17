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
import re
from typing import List, Dict, Any

def calculate_metadata_score(question: str, metadata: Dict[str, Any]) -> float:
    """
    Calculate a score based on metadata relevance to the question.
    Returns a score between 0 and 1.
    """
    score = 0.0
    weights = {
        'filename_exact': 0.4,  # Higher weight for exact filename matches
        'filename_partial': 0.2,  # Lower weight for partial matches
        'source_exact': 0.3,  # Higher weight for exact path matches
        'source_partial': 0.1   # Lower weight for partial path matches
    }
    
    # Convert question to lowercase for case-insensitive matching
    question_lower = question.lower()
    question_words = set(re.findall(r'\w+', question_lower))
    
    # Score based on filename relevance
    if 'filename' in metadata:
        filename = metadata['filename'].lower()
        filename_base = filename.replace('.md', '')  # Remove .md extension
        
        # Check for exact filename match
        if filename_base in question_lower:
            score += weights['filename_exact']
        # Check for partial matches
        else:
            filename_words = set(re.findall(r'\w+', filename_base))
            common_words = filename_words.intersection(question_words)
            if common_words:
                score += weights['filename_partial'] * (len(common_words) / len(filename_words))
    
    # Score based on source path relevance
    if 'source' in metadata:
        source = metadata['source'].lower()
        source_base = source.split('/')[-1].replace('.md', '')  # Get filename from path
        
        # Check for exact path match
        if source_base in question_lower:
            score += weights['source_exact']
        # Check for partial matches
        else:
            source_words = set(re.findall(r'\w+', source))
            common_words = source_words.intersection(question_words)
            if common_words:
                score += weights['source_partial'] * (len(common_words) / len(source_words))
    
    return min(score, 1.0)  # Cap at 1.0

def combine_scores(vector_score: float, metadata_score: float, vector_weight: float = 0.6) -> float:
    """
    Combine vector similarity score with metadata score.
    vector_weight determines how much to weight the vector similarity vs metadata.
    """
    metadata_weight = 1 - vector_weight
    return (vector_score * vector_weight) + (metadata_score * metadata_weight)

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
        similarity_top_k=5,  # Increased to get more candidates for scoring
        filters=MetadataFilters(filters=[
            MetadataFilter(key="user_id", value=str(user_id)),
            MetadataFilter(key="project_folder", value=project_folder),
        ])
    )

    candidates = retriever.retrieve(question)
    SCORE_THRESHOLD = 0.5  # Lowered threshold to allow more metadata-influenced matches

    if debug:
        print(f"\n🔍 Retrieved {len(candidates)} candidates")
        print("\n📊 All retrieved candidates with scores:")
        for i, c in enumerate(candidates):
            content_preview = c.node.get_content()[:100] + "..." if len(c.node.get_content()) > 100 else c.node.get_content()
            metadata_score = calculate_metadata_score(question, c.node.metadata)
            combined_score = combine_scores(c.score, metadata_score)
            print(f"\nCandidate {i+1}:")
            print(f"Vector Score: {c.score:.3f}")
            print(f"Metadata Score: {metadata_score:.3f}")
            print(f"Combined Score: {combined_score:.3f}")
            print(f"Content: {content_preview}")
            print(f"Metadata: {c.node.metadata}")
            print(f"Filename: {c.node.metadata.get('filename', 'N/A')}")

    # Filter candidates using combined scores
    filtered_candidates = []
    for c in candidates:
        metadata_score = calculate_metadata_score(question, c.node.metadata)
        combined_score = combine_scores(c.score, metadata_score)
        if combined_score >= SCORE_THRESHOLD:
            filtered_candidates.append(c)
    
    if debug:
        print(f"\n📈 Filtered to {len(filtered_candidates)} candidates above threshold {SCORE_THRESHOLD}")
        for i, c in enumerate(filtered_candidates):
            metadata_score = calculate_metadata_score(question, c.node.metadata)
            combined_score = combine_scores(c.score, metadata_score)
            print(f"Filtered Candidate {i+1}:")
            print(f"Vector Score: {c.score:.3f}")
            print(f"Metadata Score: {metadata_score:.3f}")
            print(f"Combined Score: {combined_score:.3f}")
            print(f"Filename: {c.node.metadata.get('filename', 'N/A')}")

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
                    "Use that context when answering the user. Be consistent and engaging. Keep to concise answers unless asked for longer text."
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
