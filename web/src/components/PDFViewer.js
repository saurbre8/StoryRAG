import React, { useState, useEffect } from 'react';
import s3Service from '../services/s3Service';
import './PDFViewer.css';

const PDFViewer = ({ file, auth }) => {
  const [pdfUrl, setPdfUrl] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [fileInfo, setFileInfo] = useState(null);

  useEffect(() => {
    if (file && auth.user) {
      loadPDF();
    }
  }, [file, auth.user]);

  const loadPDF = async () => {
    if (!file || !auth.user) return;
    
    try {
      setIsLoading(true);
      setError(null);
      
      const initialized = s3Service.initializeWithCognito(auth.user);
      if (!initialized) {
        throw new Error('Failed to initialize S3 service');
      }

      // Get a presigned URL for the PDF file
      const url = await s3Service.getPresignedUrl(file.key);
      setPdfUrl(url);
      
      // Get file info
      setFileInfo({
        name: file.name,
        size: file.size,
        lastModified: file.lastModified,
        key: file.key
      });
      
    } catch (error) {
      console.error('Failed to load PDF:', error);
      setError(`Error loading PDF: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown';
    return new Date(dateString).toLocaleDateString();
  };

  if (isLoading) {
    return (
      <div className="pdf-viewer">
        <div className="pdf-viewer-header">
          <h5>{file?.name || 'PDF Viewer'}</h5>
          <div className="pdf-loading">
            <div className="loading-spinner"></div>
            <span>Loading PDF...</span>
          </div>
        </div>
        <div className="pdf-content">
          <div className="loading-placeholder">
            <div className="pdf-icon">📄</div>
            <p>Loading PDF preview...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="pdf-viewer">
        <div className="pdf-viewer-header">
          <h5>{file?.name || 'PDF Viewer'}</h5>
          <div className="pdf-error">
            <span className="error-icon">⚠️</span>
            <span>{error}</span>
          </div>
        </div>
        <div className="pdf-content">
          <div className="error-placeholder">
            <div className="error-icon-large">⚠️</div>
            <h4>Failed to load PDF</h4>
            <p>{error}</p>
            <button 
              className="retry-btn"
              onClick={loadPDF}
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pdf-viewer">
      <div className="pdf-viewer-header">
        <div className="pdf-header-info">
          <h5>{fileInfo?.name || file?.name}</h5>
          {fileInfo && (
            <div className="pdf-file-meta">
              <span className="file-size">{formatFileSize(fileInfo.size)}</span>
              <span className="file-date">{formatDate(fileInfo.lastModified)}</span>
              <span className="file-path">{fileInfo.key.split('/').slice(3).join('/')}</span>
            </div>
          )}
        </div>
        <div className="pdf-actions">
          <button 
            className="download-btn"
            onClick={() => window.open(pdfUrl, '_blank')}
            title="Download PDF"
          >
            📥 Download
          </button>
          <button 
            className="open-btn"
            onClick={() => window.open(pdfUrl, '_blank')}
            title="Open in new tab"
          >
            🔗 Open
          </button>
        </div>
      </div>
      
      <div className="pdf-content">
        {pdfUrl ? (
          <div className="pdf-embed-container">
            <iframe
              src={`${pdfUrl}#toolbar=1&navpanes=1&scrollbar=1`}
              title={fileInfo?.name || 'PDF Preview'}
              className="pdf-iframe"
              frameBorder="0"
              allowFullScreen
            />
          </div>
        ) : (
          <div className="no-pdf-placeholder">
            <div className="pdf-icon">📄</div>
            <p>No PDF URL available</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PDFViewer; 