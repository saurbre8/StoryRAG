import os
import hashlib
import uuid
import tempfile
from pathlib import Path
from typing import List, Dict, Optional, Tuple
import boto3
from io import BytesIO
import fitz  # PyMuPDF
import pdfplumber
from PIL import Image
import pytesseract
from pdf2image import convert_from_bytes
import re
from tqdm import tqdm
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class PDFProcessor:
    def __init__(self, s3_client=None):
        self.s3_client = s3_client or boto3.client("s3")
        
    def hash_to_uuid(self, text: str) -> str:
        """Generate UUID from text hash."""
        return str(uuid.UUID(hashlib.sha256(text.encode("utf-8")).hexdigest()[0:32]))
    
    def is_pdf_file(self, filename: str) -> bool:
        """Check if file is a PDF based on extension."""
        return filename.lower().endswith('.pdf')
    
    def detect_scanned_pdf(self, pdf_bytes: bytes) -> bool:
        """
        Detect if PDF is scanned (image-based) by checking text extraction.
        Returns True if PDF appears to be scanned/image-based.
        """
        try:
            # Try to extract text using PyMuPDF
            doc = fitz.open(stream=pdf_bytes, filetype="pdf")
            text_content = ""
            
            for page_num in range(min(3, len(doc))):  # Check first 3 pages
                page = doc.load_page(page_num)
                text = page.get_text()
                text_content += text
            
            doc.close()
            
            # If very little text is extracted, likely scanned
            if len(text_content.strip()) < 100:
                return True
                
            # Check for common scanned PDF indicators
            scanned_indicators = [
                "image", "scan", "scanned", "ocr", "optical character recognition"
            ]
            
            # Convert to lowercase for case-insensitive matching
            text_lower = text_content.lower()
            
            # If any scanned indicators are found, likely scanned
            for indicator in scanned_indicators:
                if indicator in text_lower:
                    return True
            
            return False
            
        except Exception as e:
            logger.warning(f"Error detecting scanned PDF: {e}")
            # Default to treating as scanned if detection fails
            return True
    
    def extract_text_from_pdf(self, pdf_bytes: bytes, is_scanned: bool = False) -> Dict[str, any]:
        """
        Extract text from PDF, using OCR if it's scanned.
        Returns dict with text content and metadata.
        """
        try:
            if is_scanned:
                return self._extract_text_with_ocr(pdf_bytes)
            else:
                return self._extract_text_direct(pdf_bytes)
        except Exception as e:
            logger.error(f"Error extracting text from PDF: {e}")
            return {"text": "", "metadata": {"error": str(e)}}
    
    def _extract_text_direct(self, pdf_bytes: bytes) -> Dict[str, any]:
        """Extract text directly from PDF without OCR."""
        try:
            # Use pdfplumber for better text extraction
            with pdfplumber.open(BytesIO(pdf_bytes)) as pdf:
                text_content = ""
                page_count = len(pdf.pages)
                
                for page_num, page in enumerate(pdf.pages):
                    text = page.extract_text()
                    if text:
                        text_content += f"\n--- Page {page_num + 1} ---\n{text}\n"
                
                return {
                    "text": text_content,
                    "metadata": {
                        "extraction_method": "direct",
                        "page_count": page_count,
                        "ocr_used": False
                    }
                }
        except Exception as e:
            logger.error(f"Error in direct text extraction: {e}")
            # Fallback to PyMuPDF
            return self._extract_text_with_pymupdf(pdf_bytes)
    
    def _extract_text_with_pymupdf(self, pdf_bytes: bytes) -> Dict[str, any]:
        """Fallback text extraction using PyMuPDF."""
        try:
            doc = fitz.open(stream=pdf_bytes, filetype="pdf")
            text_content = ""
            page_count = len(doc)
            
            for page_num in range(page_count):
                page = doc.load_page(page_num)
                text = page.get_text()
                if text:
                    text_content += f"\n--- Page {page_num + 1} ---\n{text}\n"
            
            doc.close()
            
            return {
                "text": text_content,
                "metadata": {
                    "extraction_method": "pymupdf",
                    "page_count": page_count,
                    "ocr_used": False
                }
            }
        except Exception as e:
            logger.error(f"Error in PyMuPDF extraction: {e}")
            return {"text": "", "metadata": {"error": str(e)}}
    
    def _extract_text_with_ocr(self, pdf_bytes: bytes) -> Dict[str, any]:
        """Extract text from scanned PDF using OCR."""
        try:
            # Convert PDF pages to images
            images = convert_from_bytes(pdf_bytes)
            text_content = ""
            page_count = len(images)
            
            logger.info(f"Processing {page_count} pages with OCR...")
            
            for page_num, image in enumerate(tqdm(images, desc="OCR Processing")):
                # Convert PIL image to text using pytesseract
                text = pytesseract.image_to_string(image)
                if text.strip():
                    text_content += f"\n--- Page {page_num + 1} ---\n{text}\n"
            
            return {
                "text": text_content,
                "metadata": {
                    "extraction_method": "ocr",
                    "page_count": page_count,
                    "ocr_used": True
                }
            }
        except Exception as e:
            logger.error(f"Error in OCR extraction: {e}")
            return {"text": "", "metadata": {"error": str(e)}}
    
    def chunk_text(self, text: str, chunk_size: int = 500, chunk_overlap: int = 100) -> List[Dict[str, any]]:
        """
        Split text into chunks with overlap.
        Returns list of chunk dictionaries with metadata.
        """
        if not text.strip():
            return []
        
        # Clean and normalize text
        text = re.sub(r'\s+', ' ', text.strip())
        words = text.split()
        
        chunks = []
        for i in range(0, len(words), chunk_size - chunk_overlap):
            chunk_text = " ".join(words[i:i + chunk_size])
            if chunk_text.strip():
                chunks.append({
                    "text": chunk_text,
                    "word_start": i,
                    "word_end": min(i + chunk_size, len(words)),
                    "chunk_index": len(chunks)
                })
        
        return chunks
    
    def process_pdf_from_s3(self, bucket_name: str, key: str, user_id: str, 
                           chunk_size: int = 500, chunk_overlap: int = 100) -> List[Dict[str, any]]:
        """
        Process a PDF file from S3 and return chunks with metadata.
        """
        try:
            logger.info(f"Processing PDF: {key}")
            
            # Download PDF from S3
            response = self.s3_client.get_object(Bucket=bucket_name, Key=key)
            pdf_bytes = response["Body"].read()
            
            # Detect if PDF is scanned
            is_scanned = self.detect_scanned_pdf(pdf_bytes)
            logger.info(f"PDF {'is scanned' if is_scanned else 'is not scanned'}")
            
            # Extract text
            extraction_result = self.extract_text_from_pdf(pdf_bytes, is_scanned)
            text = extraction_result["text"]
            extraction_metadata = extraction_result["metadata"]
            
            if not text.strip():
                logger.warning(f"No text extracted from {key}")
                return []
            
            # Chunk the text
            chunks = self.chunk_text(text, chunk_size, chunk_overlap)
            
            # Add metadata to chunks
            parts = key.split("/")
            file_project_folder = parts[2] if len(parts) > 3 else "root"
            filename = parts[-1]
            
            processed_chunks = []
            for chunk in chunks:
                chunk_id_input = f"{user_id}|{file_project_folder}|{chunk['text']}"
                chunk_id = self.hash_to_uuid(chunk_id_input)
                
                processed_chunks.append({
                    "id": chunk_id,
                    "text": chunk["text"],
                    "metadata": {
                        "user_id": str(user_id),
                        "project_folder": file_project_folder,
                        "filename": filename,
                        "source": key,
                        "file_type": "pdf",
                        "is_scanned": is_scanned,
                        "extraction_method": extraction_metadata.get("extraction_method", "unknown"),
                        "ocr_used": extraction_metadata.get("ocr_used", False),
                        "page_count": extraction_metadata.get("page_count", 0),
                        "chunk_index": chunk["chunk_index"],
                        "word_start": chunk["word_start"],
                        "word_end": chunk["word_end"]
                    }
                })
            
            logger.info(f"Generated {len(processed_chunks)} chunks from {key}")
            return processed_chunks
            
        except Exception as e:
            logger.error(f"Error processing PDF {key}: {e}")
            return []
    
    def load_and_chunk_pdfs_from_s3(self, bucket_name: str, user_id: str, 
                                   project_folder: Optional[str] = None, 
                                   debug: bool = False) -> List[Dict[str, any]]:
        """
        Load and chunk all PDF files from S3 for a user/project.
        """
        chunks = []
        prefix = f"users/{user_id}/"
        if project_folder:
            prefix += f"{project_folder}/"
        
        if debug:
            print(f"\n🔍 Listing PDF objects in s3://{bucket_name}/{prefix}")
        
        response = self.s3_client.list_objects_v2(Bucket=bucket_name, Prefix=prefix)
        
        if debug:
            print(f"📁 Found {len(response.get('Contents', []))} objects in S3")
        
        pdf_files = [obj["Key"] for obj in response.get("Contents", []) 
                    if self.is_pdf_file(obj["Key"])]
        
        if debug:
            print(f"📄 Found {len(pdf_files)} PDF files")
        
        for key in pdf_files:
            if debug:
                print(f"\n📄 Processing PDF: {key}")
            
            file_chunks = self.process_pdf_from_s3(bucket_name, key, user_id)
            chunks.extend(file_chunks)
        
        if debug:
            print(f"\n📦 Generated {len(chunks)} chunks from all PDF files")
        
        return chunks 