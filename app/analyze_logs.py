#!/usr/bin/env python3
import json
from pathlib import Path
from typing import Dict, Any, List
from logging_utils import (
    analyze_logs,
    get_queries,
    get_candidate_stats,
    get_user_session_stats
)

def print_metrics(metrics: Dict[str, Any]):
    """Print metrics in a readable format."""
    print("\n=== Overall Metrics ===")
    print(f"Total Queries: {metrics['total_queries']}")
    print(f"Total Candidates: {metrics['total_candidates']}")
    print(f"Filtered Candidates: {metrics['filtered_candidates']}")
    print(f"Average Candidates per Query: {metrics['avg_candidates_per_query']:.2f}")
    print(f"Average Filter Rate: {metrics['avg_filter_rate']:.2%}")

def print_candidate_stats(stats: Dict[str, Any]):
    """Print candidate statistics in a readable format."""
    print("\n=== Candidate Statistics ===")
    print(f"Total Retrievals: {stats['total_retrievals']}")
    print(f"Total Candidates: {stats['total_candidates']}")
    print(f"Filtered Candidates: {stats['filtered_candidates']}")
    print("\nAverage Scores:")
    print(f"  Vector Score: {stats['avg_scores']['vector']:.3f}")
    print(f"  Metadata Bonus: {stats['avg_scores']['metadata']:.3f}")
    print(f"  Combined Score: {stats['avg_scores']['combined']:.3f}")

def print_session_stats(stats: Dict[str, Any]):
    """Print session statistics in a readable format."""
    print("\n=== Session Statistics ===")
    print(f"Total Sessions: {len(stats['total_sessions'])}")
    print(f"Total Queries: {stats['total_queries']}")
    print(f"Average Queries per Session: {stats['avg_queries_per_session']:.2f}")
    
    print("\nQueries per Session:")
    for session_id, count in stats['queries_per_session'].items():
        print(f"  Session {session_id}: {count} queries")

def analyze_log_file(log_file: str):
    """Analyze a single log file and print all statistics."""
    print(f"\nAnalyzing log file: {log_file}")
    print("=" * 50)
    
    # Get overall metrics
    metrics = analyze_logs(log_file)
    print_metrics(metrics)
    
    # Get candidate statistics
    candidate_stats = get_candidate_stats(log_file)
    print_candidate_stats(candidate_stats)
    
    # Get session statistics
    session_stats = get_user_session_stats(log_file)
    print_session_stats(session_stats)
    
    # Get and print recent queries
    queries = get_queries(log_file)
    print("\n=== Recent Queries ===")
    for query in queries[-5:]:  # Show last 5 queries
        print(f"\nTime: {query['timestamp']}")
        print(f"Session: {query['session_id']}")
        print(f"Question: {query['question']}")

def main():
    """Main function to analyze logs."""
    # Get the project root directory (one level up from app directory)
    project_root = Path(__file__).parent.parent
    
    # Get all log files
    logs_dir = project_root / "logs"
    if not logs_dir.exists():
        print(f"No logs directory found at {logs_dir}!")
        print("Make sure you have run some queries to generate logs.")
        return
    
    log_files = list(logs_dir.glob("*.log"))
    if not log_files:
        print(f"No log files found in {logs_dir}!")
        print("Make sure you have run some queries to generate logs.")
        return
    
    # Analyze each log file
    for log_file in log_files:
        analyze_log_file(str(log_file))
        print("\n" + "=" * 50 + "\n")

if __name__ == "__main__":
    main() 