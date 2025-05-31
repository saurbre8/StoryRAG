import React, { useState } from 'react';
import './FileViewer.css';

const FileViewer = ({ files, onClear }) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredFiles = files.filter(file =>
    file.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    file.content.toLowerCase().includes(searchTerm.toLowerCase())
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
                    <div className="file-name">{file.name}</div>
                    <div className="file-meta">
                      {formatFileSize(file.size)} • {formatDate(file.lastModified)}
                    </div>
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
              <div className="file-stats">
                <span>Size: {formatFileSize(selectedFile.size)}</span>
                <span>Words: {selectedFile.content.split(/\s+/).length}</span>
                <span>Lines: {selectedFile.content.split('\n').length}</span>
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
