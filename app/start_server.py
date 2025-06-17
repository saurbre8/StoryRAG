#!/usr/bin/env python3
"""
Simple server startup script for StoryRAG API
Run this from the app/ directory
"""
import os
import sys
import subprocess
from pathlib import Path

def check_env_file():
    """Check if .env file exists and has required variables"""
    required_vars = [
        "QDRANT_API_KEY",
        "QDRANT_HOST",
        "OPENAI_API_KEY",
        "REDIS_HOST",
        "REDIS_PORT",
        "REDIS_PASSWORD2",
        "S3_BUCKET_NAME"
    ]
    
    if not os.path.exists('.env'):
        print("⚠️  No .env file found!")
        print("Create a .env file with the following variables:")
        for var in required_vars:
            print(f"{var}=your_value")
        return False
    
    # Check for required variables
    missing_vars = []
    for var in required_vars:
        if not os.getenv(var):
            missing_vars.append(var)
    
    if missing_vars:
        print("⚠️  Missing required environment variables:")
        for var in missing_vars:
            print(f"- {var}")
        return False
    
    print("✅ .env file found with all required variables")
    return True

def check_dependencies():
    """Check if all required packages are installed"""
    required_packages = [
        "fastapi",
        "uvicorn",
        "python-dotenv",
        "qdrant-client",
        "llama-index",
        "openai",
        "boto3",
        "redis"
    ]
    
    missing_packages = []
    for package in required_packages:
        try:
            __import__(package.replace("-", "_"))
        except ImportError:
            missing_packages.append(package)
    
    if missing_packages:
        print("⚠️  Missing required packages:")
        for package in missing_packages:
            print(f"- {package}")
        print("\nInstall missing packages with:")
        print(f"pip install {' '.join(missing_packages)}")
        return False
    
    print("✅ All required packages are installed")
    return True

def check_main_py():
    """Check if main.py exists"""
    if not os.path.exists('main.py'):
        print("❌ main.py not found in current directory")
        print("Make sure you're running this from the app/ folder")
        return False
    print("✅ main.py found")
    return True

def start_server(host="0.0.0.0", port=8000, production=False):
    """Start the server"""
    print(f"🚀 Starting server on {host}:{port}")
    
    if production:
        print("🏭 Production mode (gunicorn)")
        try:
            # Check if gunicorn is installed
            subprocess.run(["gunicorn", "--version"], check=True, capture_output=True)
        except (subprocess.CalledProcessError, FileNotFoundError):
            print("Installing gunicorn...")
            subprocess.run([sys.executable, "-m", "pip", "install", "gunicorn"])
        
        # Start with gunicorn
        cmd = [
            "gunicorn",
            "-w", "2",  # 2 workers for small instance
            "-k", "uvicorn.workers.UvicornWorker",
            "-b", f"{host}:{port}",
            "main:app"
        ]
    else:
        print("🔧 Development mode (uvicorn)")
        cmd = [
            "uvicorn",
            "main:app",
            "--host", host,
            "--port", str(port),
            "--reload"
        ]
    
    try:
        print(f"📝 Running: {' '.join(cmd)}")
        print("Press Ctrl+C to stop")
        subprocess.run(cmd)
    except KeyboardInterrupt:
        print("\n👋 Server stopped")
    except FileNotFoundError as e:
        print(f"❌ Command not found: {e}")
        print("Install missing packages: pip install uvicorn fastapi")
        sys.exit(1)

def main():
    """Main function"""
    print("StoryRAG Server Starter")
    print("=" * 30)
    
    # Check if we're in the right directory
    if not check_main_py():
        sys.exit(1)
    
    # Check environment
    if not check_env_file():
        sys.exit(1)
    
    # Check dependencies
    if not check_dependencies():
        sys.exit(1)
    
    # Get user input
    print("\nChoose server mode:")
    print("1. Development (auto-reload)")
    print("2. Production (gunicorn)")
    
    try:
        choice = input("Enter choice (1 or 2): ").strip()
        
        if choice == "2":
            start_server(production=True)
        else:
            start_server(production=False)
            
    except KeyboardInterrupt:
        print("\n👋 Cancelled")

if __name__ == "__main__":
    main() 