/**
 * EditTab Component
 * 
 * Provides project management and file viewing capabilities for existing projects.
 * This tab allows users to browse their created projects, view project files,
 * and inspect the content of individual files stored in their projects.
 * 
 * Features:
 * - Project selection and management via ProjectManager
 * - Lists all files within a selected project
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
  const auth = useAuth();
  
  const filesSectionRef = useRef(null);

  const handleProjectSelect = async (project) => {
    setSelectedProject(project);
    setSelectedFile(null);
    setFileContent('');
    await loadProjectFiles(project);
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
      
      // Auto-select the first file if files exist
      if (files.length > 0) {
        await handleFileSelect(files[0]);
      }
    } catch (error) {
      console.error('Failed to load project files:', error);
      setProjectFiles([]);
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
            </div>
            
            <div className="files-content">
              <div className="files-list">
                {projectFiles.length === 0 ? (
                  <div className="no-files">
                    No files found in this project
                  </div>
                ) : (
                  <div className="file-items">
                    {projectFiles.map((file, index) => (
                      <div 
                        key={index}
                        className={`file-item ${selectedFile?.name === file.name ? 'selected' : ''}`}
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
                )}
              </div>

              {selectedFile && fileContent && (
                <div className="file-viewer">
                  <div className="file-viewer-header">
                    <h5>{selectedFile.name}</h5>
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