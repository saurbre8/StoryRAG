import logging
import json
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List, Optional

def setup_logging(user_id: str, project_folder: str) -> logging.Logger:
    """
    Set up logging for a specific user and project.
    Creates a logs directory if it doesn't exist and returns a logger instance.
    """
    # Create logs directory if it doesn't exist
    logs_dir = Path("logs")
    logs_dir.mkdir(exist_ok=True)
    
    # Create a unique log file for this user/project
    log_file = logs_dir / f"user_{user_id}_project_{project_folder}.log"
    
    # Configure logger
    logger = logging.getLogger(f"user_{user_id}_project_{project_folder}")
    logger.setLevel(logging.INFO)
    
    # Create file handler
    file_handler = logging.FileHandler(log_file)
    file_handler.setLevel(logging.INFO)
    
    # Create formatter
    formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
    file_handler.setFormatter(formatter)
    
    # Add handler to logger
    logger.addHandler(file_handler)
    
    return logger

def log_interaction(logger: logging.Logger, event_type: str, data: dict):
    """
    Log an interaction event with structured data.
    """
    log_entry = {
        "timestamp": datetime.utcnow().isoformat(),
        "event_type": event_type,
        "data": data
    }
    logger.info(json.dumps(log_entry))

def analyze_logs(log_file: str) -> Dict[str, Any]:
    """
    Analyze a log file and return various metrics.
    """
    metrics = {
        'total_queries': 0,
        'total_candidates': 0,
        'filtered_candidates': 0,
        'queries': [],
        'avg_candidates_per_query': 0,
        'avg_filter_rate': 0
    }
    
    with open(log_file, 'r') as f:
        for line in f:
            log_entry = json.loads(line.split(' - ')[-1])
            
            if log_entry['event_type'] == 'query_received':
                metrics['total_queries'] += 1
                metrics['queries'].append(log_entry['data']['question'])
            
            elif log_entry['event_type'] == 'candidate_filtering':
                metrics['total_candidates'] += log_entry['data']['total_candidates']
                metrics['filtered_candidates'] += log_entry['data']['filtered_candidates']
    
    # Calculate averages
    if metrics['total_queries'] > 0:
        metrics['avg_candidates_per_query'] = metrics['total_candidates'] / metrics['total_queries']
        metrics['avg_filter_rate'] = metrics['filtered_candidates'] / metrics['total_candidates']
    
    return metrics

def get_queries(log_file: str) -> List[Dict[str, Any]]:
    """
    Extract all queries and their associated data from a log file.
    Deduplicates queries that have the same timestamp and content.
    """
    seen_queries = set()  # Track unique queries
    queries = []
    
    with open(log_file, 'r') as f:
        for line in f:
            log_entry = json.loads(line.split(' - ')[-1])
            if log_entry['event_type'] == 'query_received':
                # Create a unique key for this query
                query_key = f"{log_entry['timestamp']}_{log_entry['data']['question']}"
                
                # Only add if we haven't seen this exact query before
                if query_key not in seen_queries:
                    seen_queries.add(query_key)
                    queries.append({
                        'timestamp': log_entry['timestamp'],
                        'question': log_entry['data']['question'],
                        'session_id': log_entry['data']['session_id']
                    })
    
    return queries

def get_candidate_stats(log_file: str) -> Dict[str, Any]:
    """
    Get statistics about candidate retrieval and filtering.
    """
    stats = {
        'total_retrievals': 0,
        'total_candidates': 0,
        'filtered_candidates': 0,
        'avg_scores': {
            'vector': 0.0,
            'metadata': 0.0,
            'combined': 0.0
        }
    }
    
    score_sums = {'vector': 0.0, 'metadata': 0.0, 'combined': 0.0}
    score_count = 0
    
    with open(log_file, 'r') as f:
        for line in f:
            log_entry = json.loads(line.split(' - ')[-1])
            
            if log_entry['event_type'] == 'candidate_retrieved':
                stats['total_candidates'] += 1
                score_sums['vector'] += log_entry['data']['vector_score']
                score_sums['metadata'] += log_entry['data']['metadata_bonus']
                score_sums['combined'] += log_entry['data']['combined_score']
                score_count += 1
            
            elif log_entry['event_type'] == 'candidate_filtering':
                stats['total_retrievals'] += 1
                stats['filtered_candidates'] += log_entry['data']['filtered_candidates']
    
    if score_count > 0:
        stats['avg_scores'] = {
            'vector': score_sums['vector'] / score_count,
            'metadata': score_sums['metadata'] / score_count,
            'combined': score_sums['combined'] / score_count
        }
    
    return stats

def get_user_session_stats(log_file: str) -> Dict[str, Any]:
    """
    Get statistics about user sessions and interactions.
    """
    stats = {
        'total_sessions': set(),
        'queries_per_session': {},
        'avg_queries_per_session': 0,
        'total_queries': 0
    }
    
    with open(log_file, 'r') as f:
        for line in f:
            log_entry = json.loads(line.split(' - ')[-1])
            
            if log_entry['event_type'] == 'query_received':
                session_id = log_entry['data']['session_id']
                stats['total_sessions'].add(session_id)
                stats['queries_per_session'][session_id] = stats['queries_per_session'].get(session_id, 0) + 1
                stats['total_queries'] += 1
    
    if len(stats['total_sessions']) > 0:
        stats['avg_queries_per_session'] = stats['total_queries'] / len(stats['total_sessions'])
    
    return stats 