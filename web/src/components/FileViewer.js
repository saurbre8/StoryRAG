/**
 * FileViewer Component
 * 
 * A file browser and preview component that displays uploaded markdown files
 * with search functionality and detailed content viewing. This component allows
 * users to explore their uploaded files before they're processed into projects.
 * 
 * Features:
 * - File list display with metadata (size, date, upload status)
 * - Search functionality across file names and content
 * - File selection and content preview
 * - Upload status indicators (S3, local, failed)
 * - File statistics (word count, line count, etc.)
 * - Clear all functionality for starting over
 * - Responsive layout with side-by-side file list and preview
 */
import React, { useState } from 'react';
import './FileViewer.css';

const FileViewer = ({ files, onClear }) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredFiles = files.filter(file =>
    file.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    file.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (file.path && file.path.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (timestamp) => {
    return new Date(timestamp).toLocaleDateString();
  };

  const getDisplayPath = (file) => {
    if (file.path && file.path !== file.name) {
      return file.path;
    }
    return file.name;
  };

  return (
    <div className="file-viewer">
      <div className="file-viewer-header">
        <h2>Uploaded Files ({files.length})</h2>
        <div className="header-actions">
          <input
            type="text"
            placeholder="Search files..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          <button onClick={onClear} className="clear-button">
            Clear All
          </button>
        </div>
      </div>

      <div className="file-viewer-content">
        <div className="file-list">
          <h3>Files</h3>
          {filteredFiles.length === 0 ? (
            <p className="no-files">No files match your search</p>
          ) : (
            <ul>
              {filteredFiles.map((file, index) => (
                <li 
                  key={index}
                  className={`file-item ${selectedFile === file ? 'selected' : ''}`}
                  onClick={() => setSelectedFile(file)}
                >
                  <div className="file-info">
                    <div className="file-name">
                      {file.name}
                      {file.uploadedToS3 ? (
                        <span className="s3-badge">☁️ S3</span>
                      ) : file.uploadError ? (
                        <span className="error-badge">❌ Failed</span>
                      ) : (
                        <span className="local-badge">💻 Local</span>
                      )}
                    </div>
                    {file.path && file.path !== file.name && (
                      <div className="file-path">{file.path}</div>
                    )}
                    <div className="file-meta">
                      {formatFileSize(file.size)} • {formatDate(file.lastModified)}
                    </div>
                    {file.uploadError && (
                      <div className="upload-error">
                        Upload failed: {file.uploadError}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="file-preview">
          {selectedFile ? (
            <div>
              <h3>Preview: {selectedFile.name}</h3>
              {selectedFile.path && selectedFile.path !== selectedFile.name && (
                <div className="preview-path">Path: {selectedFile.path}</div>
              )}
              {selectedFile.s3Location && (
                <div className="s3-info-preview">
                  <strong>S3 Location:</strong> {selectedFile.s3Location}
                </div>
              )}
              <div className="file-stats">
                <span>Size: {formatFileSize(selectedFile.size)}</span>
                <span>Words: {selectedFile.content.split(/\s+/).length}</span>
                <span>Lines: {selectedFile.content.split('\n').length}</span>
                <span>Status: {selectedFile.uploadedToS3 ? 'Stored in S3' : 'Local only'}</span>
              </div>
              <pre className="file-content">{selectedFile.content}</pre>
            </div>
          ) : (
            <div className="no-selection">
              <p>Select a file to preview its content</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FileViewer;
