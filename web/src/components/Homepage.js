import React, { useState, useEffect } from 'react';
import { useAuth } from 'react-oidc-context';
import s3Service from '../services/s3Service';
import FileUploader from './FileUploader';
import './Homepage.css';

const Homepage = ({ onProjectSelect }) => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState([]);
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
    if (!newProjectName.trim() || uploadedFiles.length === 0) return;
    
    try {
      const userId = auth.user?.profile?.sub || auth.user?.profile?.username;
      
      // First create the project
      await s3Service.createProject(userId, newProjectName, 'Created from homepage');
      
      // Then upload files to the project
      for (const file of uploadedFiles) {
        await s3Service.uploadFileContentToProject(
          file.name, 
          file.content, 
          userId, 
          newProjectName
        );
      }
      
      // Reload projects and close modal
      await loadProjects();
      setShowCreateModal(false);
      setNewProjectName('');
      setUploadedFiles([]);
      
      // Auto-select the new project
      const newProject = { name: newProjectName };
      onProjectSelect(newProject);
    } catch (error) {
      console.error('Failed to create project:', error);
    }
  };

  const handleFilesUploaded = (files) => {
    setUploadedFiles(files);
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
        <h1>StoryRAG</h1>
        <p>Your worldbuilding workspace</p>
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
                <label>Upload Files</label>
                <FileUploader 
                  onFilesUploaded={handleFilesUploaded}
                  compact={true}
                />
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
                disabled={!newProjectName.trim() || uploadedFiles.length === 0}
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

export default Homepage; 