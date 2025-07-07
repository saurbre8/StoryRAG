import React, { useState } from 'react';
import './FileExplorer.css';

const FileExplorer = ({ files, selectedFile, onFileSelect, isLoading, onFileCreate, onFileMove, onFileDelete, onFileUpload, project }) => {
  const [expandedFolders, setExpandedFolders] = useState(new Set(['root']));
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [selectedFolder, setSelectedFolder] = useState('');
  const [draggedFile, setDraggedFile] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [fileToDelete, setFileToDelete] = useState(null);
  const [fileInputRef, setFileInputRef] = useState(null);

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

  const getAllFolderPaths = (folder, paths = [], currentPath = '') => {
    // Add current folder if it's not root
    if (currentPath) {
      paths.push(currentPath);
    }
    
    // Recursively add child folders
    Object.values(folder.children).forEach(childFolder => {
      const childPath = currentPath ? `${currentPath}/${childFolder.name}` : childFolder.name;
      getAllFolderPaths(childFolder, paths, childPath);
    });
    
    return paths;
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

  const handleCreateFile = async () => {
    if (!newFileName.trim()) {
      alert('Please enter a file name');
      return;
    }

    // Ensure file has .md extension
    const fileName = newFileName.endsWith('.md') ? newFileName : `${newFileName}.md`;
    const filePath = selectedFolder ? `${selectedFolder}/${fileName}` : fileName;

    try {
      await onFileCreate(fileName, '', filePath);
      setShowCreateModal(false);
      setNewFileName('');
      setSelectedFolder('');
    } catch (error) {
      console.error('Failed to create file:', error);
      alert('Failed to create file. Please try again.');
    }
  };

  // Drag and Drop Handlers
  const handleFileDragStart = (e, file) => {
    e.stopPropagation();
    setDraggedFile(file);
    setIsDragging(true);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', file.key);
    
    // Add some visual feedback
    e.target.classList.add('dragging');
  };

  const handleFileDragEnd = (e) => {
    e.stopPropagation();
    setDraggedFile(null);
    setIsDragging(false);
    setDropTarget(null);
    
    // Remove visual feedback
    e.target.classList.remove('dragging');
  };

  const handleFolderDragOver = (e, folderPath) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (draggedFile) {
      e.dataTransfer.dropEffect = 'move';
      setDropTarget(folderPath);
    }
  };

  const handleFolderDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Only clear drop target if we're actually leaving the folder
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDropTarget(null);
    }
  };

  const handleFolderDrop = async (e, targetFolderPath) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!draggedFile || !onFileMove) {
      setDropTarget(null);
      return;
    }

    try {
      // Get current file path
      const keyParts = draggedFile.key.split('/');
      const currentPath = keyParts.slice(3).join('/');
      const fileName = draggedFile.name;
      
      // Determine current folder
      const currentFolderPath = currentPath.includes('/') 
        ? currentPath.substring(0, currentPath.lastIndexOf('/'))
        : '';
      
      // Don't move if dropping in the same folder
      if (currentFolderPath === targetFolderPath) {
        //console.log('File is already in this folder');
        setDropTarget(null);
        return;
      }

      // Calculate new file path
      const newFilePath = targetFolderPath ? `${targetFolderPath}/${fileName}` : fileName;
      
      //console.log(`Moving file ${fileName} from "${currentFolderPath}" to "${targetFolderPath}"`);
      
      // Call the move handler
      await onFileMove(draggedFile, currentPath, newFilePath);
      
    } catch (error) {
      console.error('Failed to move file:', error);
      alert(`Failed to move file: ${error.message}`);
    } finally {
      setDropTarget(null);
      setDraggedFile(null);
      setIsDragging(false);
    }
  };

  const handleDeleteClick = (e, file) => {
    e.stopPropagation(); // Prevent file selection
    setFileToDelete(file);
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (fileToDelete && onFileDelete) {
      try {
        await onFileDelete(fileToDelete);
        setShowDeleteModal(false);
        setFileToDelete(null);
      } catch (error) {
        console.error('Failed to delete file:', error);
        alert('Failed to delete file. Please try again.');
      }
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteModal(false);
    setFileToDelete(null);
  };

  const handleFileUpload = async (event) => {
    const files = event.target.files;
    if (!files || files.length === 0 || !onFileUpload) {
      return;
    }

    try {
      for (const file of files) {
        // Read file content
        const content = await readFileContent(file);
        
        // Determine file path based on selected folder
        const filePath = selectedFolder ? `${selectedFolder}/${file.name}` : file.name;
        
        // Call the upload handler
        await onFileUpload(file.name, content, filePath, file.type);
      }
      
      // Clear the file input
      if (fileInputRef) {
        fileInputRef.value = '';
      }
    } catch (error) {
      console.error('Failed to upload file:', error);
      alert('Failed to upload file. Please try again.');
    }
  };

  const readFileContent = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(e);
      reader.readAsText(file);
    });
  };

  const triggerFileUpload = () => {
    if (fileInputRef) {
      fileInputRef.click();
    }
  };

  const renderFolderContents = (folder, depth = 0) => {
    const folderPath = folder.fullPath || 'root';
    const isExpanded = expandedFolders.has(folderPath);
    const actualFolderPath = folderPath === 'root' ? '' : folderPath;
    
    return (
      <div key={folderPath} className="folder-contents">
        {/* Render subfolders */}
        {Object.values(folder.children).map(childFolder => {
          const isChildDropTarget = dropTarget === childFolder.fullPath;
          const isChildExpanded = expandedFolders.has(childFolder.fullPath);
          const hasFiles = childFolder.files.length > 0;
          const hasSubfolders = Object.keys(childFolder.children).length > 0;
          
          return (
            <div key={childFolder.fullPath} className="folder-item">
              <div 
                className={`folder-header ${isChildDropTarget && draggedFile ? 'drop-target' : ''}`}
                style={{ paddingLeft: `${depth * 20 + 8}px` }}
                onClick={() => toggleFolder(childFolder.fullPath)}
                onDragOver={(e) => handleFolderDragOver(e, childFolder.fullPath)}
                onDragLeave={handleFolderDragLeave}
                onDrop={(e) => handleFolderDrop(e, childFolder.fullPath)}
              >
                {/* Expansion arrow */}
                <span className={`expansion-arrow ${isChildExpanded ? 'expanded' : 'collapsed'}`}>
                  {(hasFiles || hasSubfolders) ? '▶' : ''}
                </span>
                
                {/* Folder icon */}
                <span className="folder-icon">📁</span>
                
                <span className="folder-name">{childFolder.name}</span>
                
                {/* File count indicator */}
                {(hasFiles || hasSubfolders) && (
                  <span className="folder-info">
                    {hasFiles && <span className="file-count">({childFolder.files.length})</span>}
                  </span>
                )}
                
                {isChildDropTarget && draggedFile && (
                  <span className="drop-indicator">📥</span>
                )}
              </div>
              
              {/* Folder contents with simple vertical line */}
              {isChildExpanded && (hasFiles || hasSubfolders) && (
                <div className="folder-content-container">
                  {renderFolderContents(childFolder, depth + 1)}
                </div>
              )}
            </div>
          );
        })}
        
        {/* Render files - clean and simple */}
        {folder.files.map((file) => (
          <div 
            key={file.key}
            className={`file-item ${selectedFile?.key === file.key ? 'selected' : ''} ${draggedFile?.key === file.key ? 'dragging' : ''}`}
            style={{ paddingLeft: `${depth * 20 + 8}px` }}
            onClick={() => onFileSelect(file)}
            draggable={true}
            onDragStart={(e) => handleFileDragStart(e, file)}
            onDragEnd={handleFileDragEnd}
          >
            <span className="drag-handle">⋮⋮</span>
            <span className="file-icon">📄</span>
            <span className="file-name">{file.name}</span>
            {/* Add delete button */}
            <button
              className="delete-file-btn"
              onClick={(e) => handleDeleteClick(e, file)}
              title="Delete file"
            >
              🗑️
            </button>
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
  const folderPaths = getAllFolderPaths(folderStructure);

  return (
    <div className={`file-explorer ${isDragging ? 'dragging-active' : ''}`}>
      <div className="explorer-header">
        <h4>Explorer</h4>
        {project && (
          <div className="header-buttons">
            <button 
              className="upload-file-btn"
              onClick={triggerFileUpload}
              title="Upload file"
            >
              ⬆
            </button>
            <button 
              className="new-file-btn"
              onClick={() => setShowCreateModal(true)}
              title="Create new file"
            >
              ✚
            </button>
            <input
              type="file"
              ref={(ref) => setFileInputRef(ref)}
              onChange={handleFileUpload}
              style={{ display: 'none' }}
              multiple
              accept=".md,.txt,.json,.js,.jsx,.ts,.tsx,.py,.html,.css,.yml,.yaml"
            />
          </div>
        )}
      </div>
      
      <div 
        className={`explorer-content ${dropTarget === '' && draggedFile ? 'root-drop-target' : ''}`}
        onDragOver={(e) => {
          // Only handle root drop if not over a specific folder
          if (draggedFile && !e.target.closest('.folder-header')) {
            handleFolderDragOver(e, '');
          }
        }}
        onDragLeave={(e) => {
          // Only clear if leaving the entire explorer content
          if (!e.currentTarget.contains(e.relatedTarget)) {
            handleFolderDragLeave(e);
          }
        }}
        onDrop={(e) => {
          // Only handle root drop if not over a specific folder
          if (draggedFile && !e.target.closest('.folder-header')) {
            handleFolderDrop(e, '');
          }
        }}
      >
        {files.length === 0 ? (
          <div className="no-files">
            No files in this project
            {project && (
              <button 
                className="create-first-file-btn"
                onClick={() => setShowCreateModal(true)}
              >
                Create your first file
              </button>
            )}
          </div>
        ) : (
          renderFolderContents(folderStructure)
        )}
      </div>

      {/* Drag overlay */}
      {isDragging && (
        <div className="drag-overlay">
          <div className="drag-message">
            📁 Drop on a folder or in empty space to move "{draggedFile?.name}"
          </div>
        </div>
      )}

      {/* Create File Modal */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="create-file-modal">
            <div className="modal-header">
              <h3>Create New File</h3>
              <button 
                className="close-btn"
                onClick={() => setShowCreateModal(false)}
              >
                ×
              </button>
            </div>
            
            <div className="modal-content">
              <div className="form-group">
                <label>File Name</label>
                <input
                  type="text"
                  value={newFileName}
                  onChange={(e) => setNewFileName(e.target.value)}
                  placeholder="Enter file name (e.g., 'Character Notes')"
                  autoFocus
                />
                <small>.md extension will be added automatically</small>
              </div>

              <div className="form-group">
                <label>Location</label>
                <select
                  value={selectedFolder}
                  onChange={(e) => setSelectedFolder(e.target.value)}
                >
                  <option value="">📁 Root folder</option>
                  {folderPaths.map(path => (
                    <option key={path} value={path}>
                      📁 {path}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className="modal-footer">
              <button 
                className="cancel-btn"
                onClick={() => setShowCreateModal(false)}
              >
                Cancel
              </button>
              <button 
                className="create-btn"
                onClick={handleCreateFile}
                disabled={!newFileName.trim()}
              >
                Create File
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="modal-overlay">
          <div className="delete-file-modal">
            <div className="modal-header">
              <h3>Delete File</h3>
              <button 
                className="close-btn"
                onClick={handleCancelDelete}
              >
                ×
              </button>
            </div>
            
            <div className="modal-content">
              <div className="delete-warning">
                <div className="warning-icon">⚠️</div>
                <div className="warning-text">
                  <p>Are you sure you want to delete <strong>"{fileToDelete?.name}"</strong>?</p>
                  <p>This action cannot be undone.</p>
                </div>
              </div>
            </div>
            
            <div className="modal-footer">
              <button 
                className="cancel-btn"
                onClick={handleCancelDelete}
              >
                Cancel
              </button>
              <button 
                className="delete-btn"
                onClick={handleConfirmDelete}
              >
                Delete File
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FileExplorer; 