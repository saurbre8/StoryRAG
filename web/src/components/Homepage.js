import React, { useState, useEffect } from 'react';
import { useAuth } from 'react-oidc-context';
import s3Service from '../services/s3Service';
import CreateTab from './CreateTab';
import './Homepage.css';

const Homepage = ({ onProjectSelect }) => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
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
    </div>
  );
};

const formatDate = (date) => {
  if (!date) return 'Unknown';
  return new Date(date).toLocaleDateString();
};

export default Homepage; 