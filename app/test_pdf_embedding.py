#!/usr/bin/env python3
"""
Test script for PDF embedding functionality.
This script demonstrates how to use the new PDF processing capabilities.
"""

import os
import sys
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Add the current directory to the path so we can import our modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from embed import embed_s3_pdfs, embed_s3_all_files
from pdf_processor import PDFProcessor

def test_pdf_processor():
    """Test the PDF processor functionality."""
    print("🧪 Testing PDF Processor...")
    
    # Initialize PDF processor
    pdf_processor = PDFProcessor()
    
    # Test PDF file detection
    test_files = [
        "document.pdf",
        "report.PDF", 
        "image.jpg",
        "text.md",
        "data.txt"
    ]
    
    print("\n📄 Testing PDF file detection:")
    for filename in test_files:
        is_pdf = pdf_processor.is_pdf_file(filename)
        print(f"  {filename}: {'✅ PDF' if is_pdf else '❌ Not PDF'}")
    
    print("\n✅ PDF processor test completed!")

def test_pdf_embedding(user_id: str, project_folder: str = None, debug: bool = True):
    """Test PDF embedding functionality."""
    print(f"\n🧪 Testing PDF embedding for user: {user_id}")
    if project_folder:
        print(f"Project folder: {project_folder}")
    
    try:
        # Test PDF-only embedding
        print("\n📄 Testing PDF-only embedding...")
        result = embed_s3_pdfs(user_id, project_folder, debug)
        print(f"Result: {result}")
        
        # Test all files embedding (markdown + PDF)
        print("\n📄 Testing all files embedding...")
        result = embed_s3_all_files(user_id, project_folder, debug)
        print(f"Result: {result}")
        
    except Exception as e:
        print(f"❌ Error during testing: {e}")
        import traceback
        traceback.print_exc()

def main():
    """Main test function."""
    print("🚀 Starting PDF Embedding Tests...")
    
    # Test basic PDF processor functionality
    test_pdf_processor()
    
    # Test with a sample user ID (you can modify this)
    user_id = "test_user"
    project_folder = "test_project"  # Optional
    
    print(f"\n🧪 Testing with user ID: {user_id}")
    test_pdf_embedding(user_id, project_folder, debug=True)
    
    print("\n✅ All tests completed!")

if __name__ == "__main__":
    main() 