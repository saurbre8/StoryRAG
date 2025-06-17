import React, { useState } from 'react';
import './FileExplorer.css';

const FileExplorer = ({ files, selectedFile, onFileSelect, isLoading }) => {
  const [expandedFolders, setExpandedFolders] = useState(new Set(['root']));

  const buildFolderStructure = (files) => {
    const root = { name: 'root', children: {}, files: [] };
    
    files.forEach(file => {
      const keyParts = file.key.split('/');
      const pathInProject = keyParts.slice(3).join('/');
      
      if (!pathInProject || pathInProject === file.name) {
        root.files.push(file);
      } else {
        const pathParts = pathInProject.split('/');
        const fileName = pathParts.pop();
        
        let currentFolder = root;
        pathParts.forEach(folderName => {
          if (!currentFolder.children[folderName]) {
            currentFolder.children[folderName] = {
              name: folderName,
              children: {},
              files: [],
              fullPath: currentFolder.fullPath ? `${currentFolder.fullPath}/${folderName}` : folderName
            };
          }
          currentFolder = currentFolder.children[folderName];
        });
        
        currentFolder.files.push({ ...file, name: fileName });
      }
    });
    
    return root;
  };

  const toggleFolder = (folderPath) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderPath)) {
      newExpanded.delete(folderPath);
    } else {
      newExpanded.add(folderPath);
    }
    setExpandedFolders(newExpanded);
  };

  const renderFolderContents = (folder, depth = 0) => {
    const folderPath = folder.fullPath || 'root';
    const isExpanded = expandedFolders.has(folderPath);
    
    return (
      <div key={folderPath} className="folder-contents">
        {/* Render subfolders */}
        {Object.values(folder.children).map(childFolder => (
          <div key={childFolder.fullPath} className="folder-item">
            <div 
              className="folder-header"
              style={{ paddingLeft: `${depth * 16 + 8}px` }}
              onClick={() => toggleFolder(childFolder.fullPath)}
            >
              <span className="folder-toggle">
                {expandedFolders.has(childFolder.fullPath) ? '📂' : '📁'}
              </span>
              <span className="folder-name">{childFolder.name}</span>
            </div>
            {expandedFolders.has(childFolder.fullPath) && renderFolderContents(childFolder, depth + 1)}
          </div>
        ))}
        
        {/* Render files */}
        {folder.files.map((file) => (
          <div 
            key={file.key}
            className={`file-item ${selectedFile?.key === file.key ? 'selected' : ''}`}
            style={{ paddingLeft: `${depth * 16 + 24}px` }}
            onClick={() => onFileSelect(file)}
          >
            <span className="file-icon">📄</span>
            <span className="file-name">{file.name}</span>
          </div>
        ))}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="file-explorer">
        <div className="explorer-header">
          <h4>Explorer</h4>
        </div>
        <div className="explorer-loading">Loading files...</div>
      </div>
    );
  }

  const folderStructure = buildFolderStructure(files);

  return (
    <div className="file-explorer">
      <div className="explorer-header">
        <h4>Explorer</h4>
      </div>
      
      <div className="explorer-content">
        {files.length === 0 ? (
          <div className="no-files">No files in this project</div>
        ) : (
          renderFolderContents(folderStructure)
        )}
      </div>
    </div>
  );
};

export default FileExplorer; 