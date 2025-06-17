import os
from dotenv import load_dotenv
from qdrant_client import QdrantClient
from llama_index.core import VectorStoreIndex, StorageContext, load_index_from_storage
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
import logging
import json
from datetime import datetime
from pathlib import Path
from app.logging_utils import setup_logging, log_interaction

def calculate_metadata_score(question: str, metadata: Dict[str, Any]) -> float:
    """
    Calculate a bonus score based on metadata relevance to the question.
    Returns a score between 0 and 1, where 0 means no penalty.
    """
    bonus = 0.0
    weights = {
        'filename_exact': 0.3,  # Bonus for exact filename matches
        'filename_partial': 0.15,  # Bonus for partial matches
        'source_exact': 0.2,  # Bonus for exact path matches
        'source_partial': 0.1   # Bonus for partial path matches
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
            bonus += weights['filename_exact']
        # Check for partial matches
        else:
            filename_words = set(re.findall(r'\w+', filename_base))
            common_words = filename_words.intersection(question_words)
            if common_words:
                bonus += weights['filename_partial'] * (len(common_words) / len(filename_words))
    
    # Score based on source path relevance
    if 'source' in metadata:
        source = metadata['source'].lower()
        source_base = source.split('/')[-1].replace('.md', '')  # Get filename from path
        
        # Check for exact path match
        if source_base in question_lower:
            bonus += weights['source_exact']
        # Check for partial matches
        else:
            source_words = set(re.findall(r'\w+', source))
            common_words = source_words.intersection(question_words)
            if common_words:
                bonus += weights['source_partial'] * (len(common_words) / len(source_words))
    
    return min(bonus, 1.0)  # Cap at 1.0

def combine_scores(vector_score: float, metadata_score: float, vector_weight: float = 0.8) -> float:
    """
    Combine vector similarity score with metadata bonus.
    vector_weight determines the base score, metadata adds a bonus.
    """
    # Start with vector score as the base
    base_score = vector_score
    
    # Add metadata bonus (up to 20% boost)
    max_bonus = 0.2
    metadata_bonus = metadata_score * max_bonus
    
    # Combine scores, ensuring we don't exceed 1.0
    return min(base_score + metadata_bonus, 1.0)

def run_chat_query(user_id: str, project_folder: str, session_id: str, question: str, debug: bool = False) -> str:
    # Set up logging
    logger = setup_logging(user_id, project_folder)
    
    # Log the query
    log_interaction(logger, "query_received", {
        "session_id": session_id,
        "question": question,
        "debug_mode": debug
    })

    # 1) Load secrets uvicorn app.main:app --host 0.0.0.0 --port 8000
    qdrant_api_key = os.getenv("QDRANT_API_KEY")
    qdrant_host    = os.getenv("QDRANT_HOST")
    openai_api_key = os.getenv("OPENAI_API_KEY")
    redis_host     = os.getenv("REDIS_HOST", "localhost")
    redis_port     = int(os.getenv("REDIS_PORT", "6379"))
    redis_password = os.getenv("REDIS_PASSWORD2", "")
    collection_name = "splitter"

    # Log system configuration
    log_interaction(logger, "system_config", {
        "collection_name": collection_name,
        "redis_host": redis_host,
        "redis_port": redis_port,
        "qdrant_host": qdrant_host
    })

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

    # Log memory state
    log_interaction(logger, "memory_updated", {
        "session_id": session_id,
        "message_type": "user",
        "message_content": question
    })

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
    SCORE_THRESHOLD = 0.5  # Base threshold for vector similarity

    if debug:
        print(f"\n🔍 Retrieved {len(candidates)} candidates")
        print("\n📊 All retrieved candidates with scores:")
        for i, c in enumerate(candidates):
            content_preview = c.node.get_content()[:100] + "..." if len(c.node.get_content()) > 100 else c.node.get_content()
            metadata_score = calculate_metadata_score(question, c.node.metadata)
            combined_score = combine_scores(c.score, metadata_score)
            print(f"\nCandidate {i+1}:")
            print(f"Vector Score: {c.score:.3f}")
            print(f"Metadata Bonus: {metadata_score:.3f}")
            print(f"Combined Score: {combined_score:.3f}")
            print(f"Content: {content_preview}")
            print(f"Metadata: {c.node.metadata}")
            print(f"Filename: {c.node.metadata.get('filename', 'N/A')}")
            
            # Log candidate details
            log_interaction(logger, "candidate_retrieved", {
                "candidate_index": i + 1,
                "vector_score": c.score,
                "metadata_bonus": metadata_score,
                "combined_score": combined_score,
                "content_preview": content_preview,
                "metadata": c.node.metadata
            })

    # Filter candidates using combined scores
    filtered_candidates = []
    for c in candidates:
        metadata_score = calculate_metadata_score(question, c.node.metadata)
        combined_score = combine_scores(c.score, metadata_score)
        if combined_score >= SCORE_THRESHOLD:
            filtered_candidates.append(c)
    
    # Log filtering results
    log_interaction(logger, "candidate_filtering", {
        "total_candidates": len(candidates),
        "filtered_candidates": len(filtered_candidates),
        "threshold": SCORE_THRESHOLD
    })

    if debug:
        print(f"\n📈 Filtered to {len(filtered_candidates)} candidates above threshold {SCORE_THRESHOLD}")
        for i, c in enumerate(filtered_candidates):
            metadata_score = calculate_metadata_score(question, c.node.metadata)
            combined_score = combine_scores(c.score, metadata_score)
            print(f"Filtered Candidate {i+1}:")
            print(f"Vector Score: {c.score:.3f}")
            print(f"Metadata Bonus: {metadata_score:.3f}")
            print(f"Combined Score: {combined_score:.3f}")
            print(f"Filename: {c.node.metadata.get('filename', 'N/A')}")

    # If no candidates meet the threshold, use memory-only approach
    if not filtered_candidates:
        log_interaction(logger, "fallback_to_memory", {
            "session_id": session_id,
            "reason": "no_candidates_above_threshold",
            "threshold": SCORE_THRESHOLD
        })

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

        # Log memory update for assistant response
        log_interaction(logger, "memory_updated", {
            "session_id": session_id,
            "message_type": "assistant",
            "message_content": assistant_text
        })

        if debug:
            print_chat_history(memory, session_id)

        # Log the final response
        log_interaction(logger, "response_generated", {
            "session_id": session_id,
            "response": assistant_text,
            "num_candidates_used": 0,
            "response_type": "memory_only"
        })

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

        # Log the final response
        log_interaction(logger, "response_generated", {
            "session_id": session_id,
            "response": assistant_text,
            "num_candidates_used": len(filtered_candidates),
            "response_type": "rag",
            "context_used": [c.node.metadata.get('filename', 'N/A') for c in filtered_candidates]
        })

    # Log memory update for assistant response
    log_interaction(logger, "memory_updated", {
        "session_id": session_id,
        "message_type": "assistant",
        "message_content": assistant_text
    })

    return assistant_text


def print_chat_history(memory: ChatMemoryBuffer, session_id: str):
    print(f"\n🧠 Chat History for Session `{session_id}`:\n" + "-" * 40)
    for msg in memory.get():
        role_str = getattr(msg.role, 'value', str(msg.role)).upper()
        print(f"{role_str}: {msg.content}\n")
