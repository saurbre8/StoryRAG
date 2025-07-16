# PDF Embedding Functionality

This module adds comprehensive PDF processing capabilities to the StoryRAG system, including automatic detection of scanned PDFs, OCR processing, and intelligent text extraction.

## Features

### 🔍 **Automatic PDF Detection**
- Detects PDF files by file extension (.pdf, .PDF)
- Integrates seamlessly with existing S3 file processing

### 📄 **Scanned PDF Detection**
- Automatically detects if a PDF is scanned (image-based) or text-based
- Uses multiple detection methods:
  - Text extraction analysis
  - Content pattern matching
  - File structure analysis

### 🔤 **OCR Processing**
- Automatically applies OCR (Optical Character Recognition) for scanned PDFs
- Uses Tesseract OCR engine for high-quality text extraction
- Processes PDF pages as images for optimal OCR results

### 📝 **Intelligent Text Extraction**
- **Direct extraction** for text-based PDFs using pdfplumber and PyMuPDF
- **OCR extraction** for scanned PDFs using pdf2image + pytesseract
- **Fallback mechanisms** ensure robust text extraction

### 🏷️ **Rich Metadata Storage**
Each PDF chunk includes comprehensive metadata:
- `file_type`: "pdf"
- `is_scanned`: Boolean indicating if PDF was scanned
- `ocr_used`: Boolean indicating if OCR was applied
- `extraction_method`: "direct", "ocr", "pymupdf"
- `page_count`: Number of pages in the PDF
- `chunk_index`: Position of chunk within the document
- `word_start`/`word_end`: Word boundaries for the chunk

## Installation

### Prerequisites

1. **Install Tesseract OCR** (required for scanned PDF processing):
   ```bash
   # macOS
   brew install tesseract
   
   # Ubuntu/Debian
   sudo apt-get install tesseract-ocr
   
   # Windows
   # Download from: https://github.com/UB-Mannheim/tesseract/wiki
   ```

2. **Install Python dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

### Dependencies Added

The following new dependencies have been added to `requirements.txt`:
- `PyPDF2>=3.0.0` - Basic PDF text extraction
- `pdfplumber>=0.9.0` - Advanced PDF text extraction
- `pytesseract>=0.3.10` - OCR processing
- `Pillow>=10.0.0` - Image processing
- `pdf2image>=1.16.3` - PDF to image conversion
- `PyMuPDF>=1.23.0` - High-performance PDF processing

## Usage

### Basic PDF Embedding

```python
from embed import embed_s3_pdfs

# Embed only PDF files
result = embed_s3_pdfs(user_id="user123", project_folder="my_project", debug=True)
print(result)
```

### Combined File Embedding

```python
from embed import embed_s3_all_files

# Embed both markdown and PDF files
result = embed_s3_all_files(user_id="user123", project_folder="my_project", debug=True)
print(result)
```

### Direct PDF Processing

```python
from pdf_processor import PDFProcessor

# Initialize processor
pdf_processor = PDFProcessor()

# Process a single PDF from S3
chunks = pdf_processor.process_pdf_from_s3(
    bucket_name="my-bucket",
    key="users/user123/document.pdf",
    user_id="user123"
)

print(f"Generated {len(chunks)} chunks")
```

## File Structure

```
app/
├── embed.py                 # Main embedding functions (updated)
├── pdf_processor.py         # PDF processing module (new)
├── test_pdf_embedding.py   # Test script (new)
├── requirements.txt         # Dependencies (updated)
└── PDF_EMBEDDING_README.md # This documentation
```

## Processing Flow

### 1. **File Detection**
- Scans S3 bucket for PDF files
- Filters by file extension (.pdf, .PDF)

### 2. **PDF Analysis**
- Downloads PDF from S3
- Analyzes first 3 pages to detect if scanned
- Determines optimal extraction method

### 3. **Text Extraction**
- **Text-based PDFs**: Direct extraction using pdfplumber/PyMuPDF
- **Scanned PDFs**: OCR processing using Tesseract
- **Fallback**: Multiple extraction methods for robustness

### 4. **Chunking**
- Splits extracted text into overlapping chunks
- Maintains document structure and page boundaries
- Preserves word-level positioning information

### 5. **Metadata Enrichment**
- Adds comprehensive metadata to each chunk
- Includes processing information (OCR used, extraction method)
- Maintains document context (page numbers, chunk positions)

### 6. **Embedding & Storage**
- Generates embeddings using existing OpenAI integration
- Stores in Qdrant with rich metadata
- Supports filtering and querying by PDF-specific attributes

## Configuration

### Environment Variables

Ensure these environment variables are set:
```bash
OPENAI_API_KEY=your_openai_key
QDRANT_API_KEY=your_qdrant_key
QDRANT_HOST=your_qdrant_host
S3_BUCKET_NAME=your_s3_bucket
```

### OCR Configuration

For optimal OCR performance, you can configure Tesseract:

```python
import pytesseract

# Set Tesseract path (if not in PATH)
pytesseract.pytesseract.tesseract_cmd = r'/usr/local/bin/tesseract'

# Configure OCR parameters
custom_config = r'--oem 3 --psm 6'
text = pytesseract.image_to_string(image, config=custom_config)
```

## Testing

Run the test script to verify functionality:

```bash
cd app
python test_pdf_embedding.py
```

## Performance Considerations

### **OCR Processing**
- OCR is computationally intensive
- Large PDFs may take significant time to process
- Consider processing in background jobs for large files

### **Memory Usage**
- PDF to image conversion requires significant memory
- Large PDFs may need to be processed in smaller batches

### **Storage**
- Rich metadata increases storage requirements
- Consider data retention policies for PDF chunks

## Troubleshooting

### Common Issues

1. **Tesseract not found**:
   ```bash
   # Install Tesseract
   brew install tesseract  # macOS
   sudo apt-get install tesseract-ocr  # Ubuntu
   ```

2. **PDF processing errors**:
   - Check PDF file integrity
   - Verify file permissions
   - Ensure sufficient memory for large files

3. **OCR quality issues**:
   - Adjust Tesseract configuration
   - Pre-process images for better quality
   - Consider alternative OCR engines

### Debug Mode

Enable debug mode for detailed logging:

```python
result = embed_s3_pdfs(user_id="user123", debug=True)
```

## Integration with Existing System

The PDF functionality integrates seamlessly with the existing StoryRAG system:

- **Same embedding pipeline**: Uses existing OpenAI embeddings
- **Same storage**: Stores in existing Qdrant collection
- **Same metadata structure**: Extends existing metadata schema
- **Same query interface**: PDF chunks are queryable like markdown chunks

## Future Enhancements

Potential improvements for future versions:

1. **Advanced OCR**: Support for multiple OCR engines
2. **Table extraction**: Intelligent table structure recognition
3. **Image processing**: Pre-processing for better OCR results
4. **Batch processing**: Parallel processing for multiple PDFs
5. **Caching**: Cache OCR results to avoid reprocessing
6. **Quality assessment**: Automatic OCR quality evaluation

## Support

For issues or questions about the PDF embedding functionality:

1. Check the troubleshooting section above
2. Review the test script for usage examples
3. Enable debug mode for detailed error information
4. Check logs for specific error messages 