import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from 'react-oidc-context';
import s3Service from '../services/s3Service';
import embedService from '../services/embedService';
import CreateTab from './CreateTab';
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
  const [showCreateTab, setShowCreateTab] = useState(false);
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

  const handleProjectCreated = (newProject) => {
    // Reload projects to include the new one
    loadProjects();
    
    // Optionally auto-select the new project
    // onProjectSelect(newProject);
    
    // Close the create tab
    setShowCreateTab(false);

  };

  if (loading) {
    return (
      <div className="homepage">
        <div className="loading">Loading your projects...</div>
      </div>
    );
  }

  if (showCreateTab) {
    return (
      <div className="homepage">
        <div className="homepage-header">
          <button 
            className="back-btn"
            onClick={() => setShowCreateTab(false)}
          >
            ← Back to Projects
          </button>
          <h1>Create New Project</h1>
        </div>
        <CreateTab onProjectCreated={handleProjectCreated} />
      </div>
    );
  }

  return (
    <div className="homepage">
      <header className="homepage-header">
        <h1>StoryRAG</h1>
        <p>Your worldbuilding workspace</p>
      </header>

      <div className="homepage-content">
        <div className="projects-section">
          <div className="projects-header">
            <h2>Your Projects</h2>
            <button 
              className="new-project-btn"
              onClick={() => setShowCreateTab(true)}
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
                  onClick={() => setShowCreateTab(true)}
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
                  <div className="project-icon">📚</div>
                  <div className="project-info">
                    <h3>{project.name}</h3>
                    <p>{project.fileCount || 0} files</p>
                    <span className="project-updated">
                      Updated {formatDate(project.lastModified)}
                    </span>
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
                onClick={handleCreateProject}
                disabled={!newProjectName.trim()}
              >
                Create Project
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const formatDate = (date) => {
  if (!date) return 'Unknown';
  return new Date(date).toLocaleDateString();
};

// Simple file upload component without project selection
const SimpleFileUpload = ({ onFilesUploaded }) => {
  const [isDragActive, setIsDragActive] = useState(false);

  const processEntry = async (entry, files, path = '') => {
    if (entry.isFile) {
      const file = await new Promise((resolve) => entry.file(resolve));
      if (file.name.endsWith('.md')) {
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
    
    // Filter for markdown files only
    const markdownFiles = files.filter(file => 
      file.name.endsWith('.md') || file.type === 'text/markdown'
    );

    if (markdownFiles.length === 0) {
      alert('No .md files found. Please upload markdown files.');
      return;
    }

    // Read file contents
    const filesWithContent = await Promise.all(
      markdownFiles.map(async (file) => {
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
    
    // Filter for markdown files only
    const markdownFiles = files.filter(file => 
      file.name.endsWith('.md') || file.type === 'text/markdown'
    );

    if (markdownFiles.length === 0) {
      alert('No .md files found. Please select markdown files or folders.');
      return;
    }

    // Read file contents
    const filesWithContent = await Promise.all(
      markdownFiles.map(async (file) => {
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
            <p>Only .md files will be processed</p>
          </div>
        ) : (
          <div>
            <h4>Drag & drop files or folders</h4>
            <p>or <span className="click-text">click to browse</span></p>
            <p className="file-types">Supports .md files only</p>
            <div className="upload-options">
              <div className="option">📄 Individual .md files</div>
              <div className="option">📂 Folders with .md files</div>
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
      />
    </div>
  );
};

export default Homepage;