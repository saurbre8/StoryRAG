import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from 'react-oidc-context';
import s3Service from '../services/s3Service';
import embedService from '../services/embedService';
import './Homepage.css';

const Homepage = ({ onProjectSelect }) => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isEmbedding, setIsEmbedding] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});
  const [statusMessage, setStatusMessage] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const auth = useAuth();

  useEffect(() => {
    loadProjects();
  }, [auth.user]);

  const loadProjects = async () => {
    if (!auth.user) return;
    
    try {
      const userId = auth.user?.profile?.sub || auth.user?.profile?.username;
      const initialized = s3Service.initializeWithCognito(auth.user);
      
      if (!initialized) {
        throw new Error('Failed to initialize S3 service');
      }

      const userProjects = await s3Service.listUserProjects(userId);
      setProjects(userProjects);
    } catch (error) {
      console.error('Failed to load projects:', error);
      setProjects([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) {
      alert('Project name is required');
      return;
    }

    // Validate project name (no special characters except hyphens and underscores)
    const projectNameRegex = /^[a-zA-Z0-9_-]+$/;
    if (!projectNameRegex.test(newProjectName)) {
      alert('Project name can only contain letters, numbers, hyphens, and underscores');
      return;
    }

    // Check if project already exists
    if (projects.some(p => p.name === newProjectName)) {
      alert('A project with this name already exists');
      return;
    }
    
    try {
      setIsUploading(true);
      const userId = auth.user?.profile?.sub || auth.user?.profile?.username;
      
      const initialized = s3Service.initializeWithCognito(auth.user);
      if (!initialized) {
        throw new Error('Failed to initialize S3 service');
      }
      
      setStatusMessage('Creating project...');
      
      // First create the project
      await s3Service.createProject(userId, newProjectName, 'Created from homepage');
      
      // Then upload files to the project (only if files were uploaded)
      if (uploadedFiles.length > 0) {
        setStatusMessage('Uploading files...');
        
        for (const file of uploadedFiles) {
          await s3Service.uploadFileContentToProject(
            file.name, 
            file.content, 
            userId, 
            newProjectName,
            file.path || file.name
          );
        }
        
        // Embed the files for AI chat
        setIsEmbedding(true);
        setStatusMessage('Embedding files for AI chat...');
        
        const embedResult = await embedService.embedProjectSafely(userId, newProjectName);
        
        if (embedResult.success) {
          setStatusMessage('✅ Project created and files embedded successfully!');
        } else {
          setStatusMessage('⚠️ Project created but embedding failed');
        }
      } else {
        setStatusMessage('✅ Project created successfully!');
      }
      
      // Reload projects and close modal after a delay
      await loadProjects();
      
      setTimeout(() => {
        setShowCreateModal(false);
        setNewProjectName('');
        setUploadedFiles([]);
        setStatusMessage('');
        
        // Auto-select the new project
        const newProject = { name: newProjectName };
        onProjectSelect(newProject);
      }, 1500);
      
    } catch (error) {
      console.error('Failed to create project:', error);
      alert(`Failed to create project: ${error.message}`);
      setStatusMessage('');
    } finally {
      setIsUploading(false);
      setIsEmbedding(false);
    }
  };

  // Delete a project
  const handleDeleteProject = async (projectName) => {
    if (!projectName) return;
    
    try {
      setIsDeleting(true);
      const userId = auth.user?.profile?.sub || auth.user?.profile?.username;
      
      const initialized = s3Service.initializeWithCognito(auth.user);
      if (!initialized) {
        throw new Error('Failed to initialize S3 service');
      }

      // Delete from S3 (embeddings will be auto-deleted)
      console.log('Deleting project from S3:', projectName);
      const s3Result = await s3Service.deleteProject(userId, projectName);

      // Reload projects
      await loadProjects();
      
      setShowDeleteModal(false);
      setProjectToDelete(null);
      
      const message = s3Result.deletedFiles > 0 
        ? `Project "${projectName}" and ${s3Result.deletedFiles} files deleted successfully!`
        : `Project "${projectName}" deleted successfully!`;
      
      alert(message);
      
    } catch (error) {
      console.error('Failed to delete project:', error);
      alert(`Failed to delete project: ${error.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteClick = (project, e) => {
    e.stopPropagation(); // Prevent project selection
    setProjectToDelete(project);
    setShowDeleteModal(true);
  };

  const handleCancelDelete = () => {
    setShowDeleteModal(false);
    setProjectToDelete(null);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown';
    return new Date(dateString).toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="homepage">
        <div className="loading">Loading your projects...</div>
      </div>
    );
  }

  return (
    <div className="homepage">
      <header className="homepage-header">
        <h1>ChatRAG</h1>
      </header>

      <div className="homepage-content">
        <div className="projects-section">
          <div className="projects-header">
            <h2>Your Projects</h2>
            <button 
              className="new-project-btn"
              onClick={() => setShowCreateModal(true)}
            >
              <span>+</span> New Project
            </button>
          </div>

          <div className="projects-grid">
            {projects.length === 0 ? (
              <div className="no-projects">
                <div className="no-projects-icon">📁</div>
                <p>No projects yet</p>
                <button 
                  className="create-first-project"
                  onClick={() => setShowCreateModal(true)}
                >
                  Create your first project
                </button>
              </div>
            ) : (
              projects.map((project) => (
                <div 
                  key={project.name}
                  className="project-card"
                  onClick={() => onProjectSelect(project)}
                >
                  <div className="project-info">
                    <h3>{project.name}</h3>
                    <p>{project.fileCount || 0} files</p>
                    <span className="project-updated">
                      Updated {formatDate(project.lastModified)}
                    </span>
                  </div>
                  {/* ADD DELETE BUTTON HERE */}
                  <div className="project-actions">
                    <button 
                      className="delete-project-btn"
                      onClick={(e) => handleDeleteClick(project, e)}
                      disabled={isDeleting}
                      title="Delete project"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>Create New Project</h3>
              <button 
                className="close-btn"
                onClick={() => setShowCreateModal(false)}
              >
                ×
              </button>
            </div>
            
            <div className="modal-content">
              <div className="form-group">
                <label>Project Name</label>
                <input
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="Enter project name..."
                />
              </div>
              
              <div className="form-group">
                <label>Upload Files (Optional)</label>
                <SimpleFileUpload onFilesUploaded={setUploadedFiles} />
              </div>
              
              {uploadedFiles.length > 0 && (
                <div className="uploaded-files-preview">
                  <p>{uploadedFiles.length} file(s) ready to upload</p>
                  <ul>
                    {uploadedFiles.map((file, index) => (
                      <li key={index}>{file.name}</li>
                    ))}
                  </ul>
                </div>
              )}
              
              {statusMessage && (
                <div className={`status-message ${statusMessage.includes('✅') ? 'success' : statusMessage.includes('⚠️') ? 'warning' : 'info'}`}>
                  {statusMessage}
                </div>
              )}
              
              <div className="modal-actions">
                <button 
                  className="cancel-btn"
                  onClick={() => setShowCreateModal(false)}
                  disabled={isUploading || isEmbedding}
                >
                  Cancel
                </button>
                <button 
                  className="create-btn"
                  onClick={handleCreateProject}
                  disabled={isUploading || isEmbedding || !newProjectName.trim()}
                >
                  {isUploading ? 'Creating...' : isEmbedding ? 'Embedding...' : 'Create Project'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ADD DELETE MODAL */}
      {showDeleteModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>Delete Project</h3>
              <button 
                className="close-btn"
                onClick={handleCancelDelete}
              >
                ×
              </button>
            </div>
            
            <div className="modal-content">
              <div className="warning-message">
                <div className="warning-icon">⚠️</div>
                <div>
                  <p><strong>Are you sure you want to delete "{projectToDelete?.name}"?</strong></p>
                  <p>This action cannot be undone. All files will be permanently deleted.</p>
                  <p className="file-count">
                    This project contains {projectToDelete?.fileCount || 0} files.
                  </p>
                </div>
              </div>
              
              <div className="modal-actions">
                <button 
                  className="cancel-btn"
                  onClick={handleCancelDelete}
                  disabled={isDeleting}
                >
                  Cancel
                </button>
                <button 
                  className="delete-confirm-btn"
                  onClick={() => handleDeleteProject(projectToDelete?.name)}
                  disabled={isDeleting}
                >
                  {isDeleting ? 'Deleting...' : 'Delete Project'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Simple file upload component without project selection
const SimpleFileUpload = ({ onFilesUploaded }) => {
  const [isDragActive, setIsDragActive] = useState(false);

  const processEntry = async (entry, files, path = '') => {
    if (entry.isFile) {
      const file = await new Promise((resolve) => entry.file(resolve));
      if (file.name.endsWith('.md') || file.name.toLowerCase().endsWith('.pdf')) {
        Object.defineProperty(file, 'webkitRelativePath', {
          value: path + file.name,
          writable: false
        });
        files.push(file);
      }
    } else if (entry.isDirectory) {
      const reader = entry.createReader();
      const entries = await new Promise((resolve) => reader.readEntries(resolve));
      for (const childEntry of entries) {
        await processEntry(childEntry, files, path + entry.name + '/');
      }
    }
  };

  const handleDrop = useCallback(async (e) => {
    e.preventDefault();
    setIsDragActive(false);
    
    const items = Array.from(e.dataTransfer.items);
    const files = [];
    
    // Process dropped items (files and folders)
    for (const item of items) {
      if (item.kind === 'file') {
        const entry = item.webkitGetAsEntry();
        if (entry) {
          await processEntry(entry, files);
        }
      }
    }
    
    // Filter for markdown and PDF files
    const supportedFiles = files.filter(file => 
      file.name.endsWith('.md') || 
      file.type === 'text/markdown' ||
      file.name.toLowerCase().endsWith('.pdf')
    );

    if (supportedFiles.length === 0) {
      alert('No supported files found. Please upload .md or .pdf files.');
      return;
    }

    // Read file contents
    const filesWithContent = await Promise.all(
      supportedFiles.map(async (file) => {
        const content = await file.text();
        return {
          name: file.name,
          size: file.size,
          content: content,
          lastModified: file.lastModified,
          path: file.webkitRelativePath || file.name
        };
      })
    );

    onFilesUploaded(filesWithContent);
  }, [onFilesUploaded]);

  const handleFileInput = useCallback(async (e) => {
    const files = Array.from(e.target.files);
    
    // Filter for markdown and PDF files
    const supportedFiles = files.filter(file => 
      file.name.endsWith('.md') || 
      file.type === 'text/markdown' ||
      file.name.toLowerCase().endsWith('.pdf')
    );

    if (supportedFiles.length === 0) {
      alert('No supported files found. Please select .md or .pdf files or folders.');
      return;
    }

    // Read file contents
    const filesWithContent = await Promise.all(
      supportedFiles.map(async (file) => {
        const content = await file.text();
        return {
          name: file.name,
          size: file.size,
          content: content,
          lastModified: file.lastModified,
          path: file.webkitRelativePath || file.name
        };
      })
    );

    onFilesUploaded(filesWithContent);
  }, [onFilesUploaded]);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragActive(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setIsDragActive(false);
    }
  };

  const handleClick = () => {
    document.getElementById('folder-input').click();
  };

  return (
    <div 
      className={`simple-file-upload ${isDragActive ? 'drag-active' : ''}`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onClick={handleClick}
    >
      <div className="upload-content">
        <div className="upload-icon">📁</div>
        {isDragActive ? (
          <div>
            <h4>Drop your files or folders here!</h4>
            <p>Only .md and .pdf files will be processed</p>
          </div>
        ) : (
          <div>
            <h4>Drag & drop files or folders</h4>
            <p>or <span className="click-text">click to browse</span></p>
            <p className="file-types">Supports .md and .pdf files</p>
            <div className="upload-options">
              <div className="option">📄 Individual .md or .pdf files</div>
              <div className="option">📂 Folders with .md or .pdf files</div>
            </div>
          </div>
        )}
      </div>
      
      {/* Folder input that can also select individual files */}
      <input
        id="folder-input"
        type="file"
        webkitdirectory=""
        directory=""
        onChange={handleFileInput}
        style={{ display: 'none' }}
        accept=".md,application/pdf"
      />
    </div>
  );
};

export default Homepage;