/**
 * EditTab Component
 * 
 * Provides project management and file viewing capabilities for existing projects.
 * This tab allows users to browse their created projects, view project files,
 * and inspect the content of individual files stored in their projects.
 * 
 * Features:
 * - Project selection and management via ProjectManager
 * - Hierarchical folder structure with collapsible dropdowns
 * - File content viewer for reading uploaded markdown files
 * - File metadata display (size, date, etc.)
 * - Integration with S3 storage for file retrieval
 * - Loading states and error handling for file operations
 */

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from 'react-oidc-context';
import ProjectManager from './ProjectManager';
import s3Service from '../services/s3Service';
import './EditTab.css';

const EditTab = () => {
  const [selectedProject, setSelectedProject] = useState(null);
  const [projectFiles, setProjectFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileContent, setFileContent] = useState('');
  const [folderStructure, setFolderStructure] = useState(null);
  const [expandedFolders, setExpandedFolders] = useState(new Set());
  const auth = useAuth();
  
  const filesSectionRef = useRef(null);

  const handleProjectSelect = async (project) => {
    setSelectedProject(project);
    setSelectedFile(null);
    setFileContent('');
    await loadProjectFiles(project);
  };

  const buildFolderStructure = (files) => {
    const root = { name: '', children: {}, files: [] };
    
    files.forEach(file => {
      // Extract the relative path from the S3 key
      // Key format: users/{userId}/{projectName}/{path}
      const keyParts = file.key.split('/');
      const pathInProject = keyParts.slice(3).join('/'); // Remove users/{userId}/{projectName}/
      
      if (!pathInProject || pathInProject === file.name) {
        // File is in root directory
        root.files.push(file);
      } else {
        // File is in a subdirectory
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

  const loadProjectFiles = async (project) => {
    if (!project || !auth.user) return;
    
    try {
      const userId = auth.user?.profile?.sub || auth.user?.profile?.username;
      
      const initialized = s3Service.initializeWithCognito(auth.user);
      if (!initialized) {
        throw new Error('Failed to initialize S3 service');
      }

      const files = await s3Service.listProjectFiles(userId, project.name);
      setProjectFiles(files);
      
      // Build folder structure
      const structure = buildFolderStructure(files);
      setFolderStructure(structure);
      
      // Auto-select the first file if files exist
      if (files.length > 0) {
        await handleFileSelect(files[0]);
      }
    } catch (error) {
      console.error('Failed to load project files:', error);
      setProjectFiles([]);
      setFolderStructure(null);
    }
  };

  const handleFileSelect = async (file) => {
    setSelectedFile(file);
    await loadFileContent(file);
    
    // Scroll to the top of the files section
    if (filesSectionRef.current) {
      filesSectionRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }
  };

  const loadFileContent = async (file) => {
    if (!file || !auth.user) return;
    
    try {
      const initialized = s3Service.initializeWithCognito(auth.user);
      if (!initialized) {
        throw new Error('Failed to initialize S3 service');
      }

      const result = await s3Service.downloadFile(file.key);
      setFileContent(result.content);
    } catch (error) {
      console.error('Failed to load file content:', error);
      setFileContent(`Error loading file content: ${error.message}`);
    }
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
    const folderPath = folder.fullPath || '';
    const isExpanded = expandedFolders.has(folderPath);
    
    return (
      <div key={folderPath || 'root'} className="folder-contents">
        {/* Render subfolders */}
        {Object.values(folder.children).map(childFolder => (
          <div key={childFolder.fullPath} className="folder-item">
            <div 
              className="folder-header"
              style={{ paddingLeft: `${depth * 20 + 10}px` }}
              onClick={() => toggleFolder(childFolder.fullPath)}
            >
              <span className="folder-toggle">
                {expandedFolders.has(childFolder.fullPath) ? '📂' : '📁'}
              </span>
              <span className="folder-name">{childFolder.name}</span>
              <span className="folder-count">({Object.keys(childFolder.children).length + childFolder.files.length})</span>
            </div>
            {expandedFolders.has(childFolder.fullPath) && renderFolderContents(childFolder, depth + 1)}
          </div>
        ))}
        
        {/* Render files */}
        {folder.files.map((file, index) => (
          <div 
            key={file.key}
            className={`file-item ${selectedFile?.key === file.key ? 'selected' : ''}`}
            style={{ paddingLeft: `${depth * 20 + 30}px` }}
            onClick={() => handleFileSelect(file)}
          >
            <div className="file-icon">📄</div>
            <div className="file-details">
              <div className="file-name">{file.name}</div>
              <div className="file-meta">
                <span className="file-size">{formatFileSize(file.size || 0)}</span>
                <span className="file-date">{formatDate(file.lastModified)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
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

  // Start with all folders closed by default
  useEffect(() => {
    if (folderStructure) {
      // Reset to empty set - all folders closed
      setExpandedFolders(new Set());
    }
  }, [folderStructure]);

  return (
    <div className="edit-tab">
      <div className="tab-header">
        <h3>Edit & Manage Projects</h3>
        <p>Select a project to view and manage its files</p>
      </div>
      
      <div className="edit-content">
        <div className="project-section">
          <ProjectManager 
            selectedProject={selectedProject}
            onProjectSelect={handleProjectSelect}
          />
        </div>

        {selectedProject && (
          <div className="files-section" ref={filesSectionRef}>
            <div className="files-header">
              <h4>Files in "{selectedProject.name}"</h4>
              {projectFiles.length > 0 && (
                <div className="files-actions">
                  <button 
                    className="expand-all-btn"
                    onClick={() => {
                      const allFolderPaths = [];
                      const collectPaths = (folder) => {
                        Object.values(folder.children).forEach(child => {
                          allFolderPaths.push(child.fullPath);
                          collectPaths(child);
                        });
                      };
                      if (folderStructure) collectPaths(folderStructure);
                      setExpandedFolders(new Set(allFolderPaths));
                    }}
                  >
                    Expand All
                  </button>
                  <button 
                    className="collapse-all-btn"
                    onClick={() => setExpandedFolders(new Set())}
                  >
                    Collapse All
                  </button>
                </div>
              )}
            </div>
            
            <div className="files-content">
              <div className="files-list">
                {projectFiles.length === 0 ? (
                  <div className="no-files">
                    No files found in this project
                  </div>
                ) : folderStructure ? (
                  <div className="file-tree">
                    {renderFolderContents(folderStructure)}
                  </div>
                ) : (
                  <div className="loading-files">
                    Loading file structure...
                  </div>
                )}
              </div>

              {selectedFile && fileContent && (
                <div className="file-viewer">
                  <div className="file-viewer-header">
                    <h5>{selectedFile.name.replace(/\.md$/, '')}</h5>
                    <div className="file-path-info">
                      {selectedFile.key.split('/').slice(3).join('/')}
                    </div>
                  </div>
                  <div className="file-content">
                    <pre className="content-display">{fileContent}</pre>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EditTab; 