/**
 * ProjectManager Component
 * 
 * A comprehensive project management interface that handles project creation, selection,
 * and organization within the StoryRAG application. This component serves as the central
 * hub for managing worldbuilding projects stored in AWS S3.
 * 
 * Features:
 * - Project listing and selection dropdown
 * - New project creation with name and description
 * - Integration with AWS S3 for project storage
 * - Project validation and naming rules
 * - Real-time project loading from cloud storage
 * - Project metadata display (creation date, file count)
 * - Form validation and error handling
 * - Auto-selection of newly created projects
 * - User-specific project isolation
 */
import React, { useState, useEffect } from 'react';
import { useAuth } from 'react-oidc-context';
import s3Service from '../services/s3Service';
import './ProjectManager.css';

const ProjectManager = ({ selectedProject, onProjectSelect, onProjectCreate }) => {
  const [projects, setProjects] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const auth = useAuth();

  useEffect(() => {
    if (auth.user) {
      loadProjectsFromS3();
    }
  }, [auth.user]);

  const loadProjectsFromS3 = async () => {
    try {
      setIsLoading(true);
      const userId = auth.user?.profile?.sub || auth.user?.profile?.username;
      
      if (!userId) {
        console.log('No user ID found, skipping project load');
        return;
      }

      const initialized = s3Service.initializeWithCognito(auth.user);
      if (!initialized) {
        throw new Error('Failed to initialize S3 service');
      }

      console.log('Loading projects from S3 for user:', userId);
      const userProjects = await s3Service.listUserProjects(userId);
      console.log('Loaded projects:', userProjects);
      setProjects(userProjects);

      // If no project is selected but we have projects, optionally select the first one
      if (!selectedProject && userProjects.length > 0) {
        // onProjectSelect(userProjects[0]); // Uncomment if you want to auto-select first project
      }
    } catch (error) {
      console.error('Failed to load projects from S3:', error);
      // Don't show alert on load failure, just log it
      setProjects([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateProject = async (e) => {
    e.preventDefault();
    
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
      setIsCreating(true);
      const userId = auth.user?.profile?.sub || auth.user?.profile?.username;
      
      console.log('Creating project:', newProjectName);
      await s3Service.createProject(userId, newProjectName, newProjectDescription);
      
      // Reload projects from S3
      await loadProjectsFromS3();
      
      // Select the new project
      const newProject = { 
        name: newProjectName, 
        description: newProjectDescription,
        createdAt: new Date().toISOString(),
        fileCount: 0
      };
      onProjectSelect(newProject);
      onProjectCreate?.(newProject);
      
      // Reset form
      setNewProjectName('');
      setNewProjectDescription('');
      setShowCreateForm(false);
      
      alert(`Project "${newProjectName}" created successfully!`);
    } catch (error) {
      console.error('Failed to create project:', error);
      alert(`Failed to create project: ${error.message}`);
    } finally {
      setIsCreating(false);
    }
  };

  const handleProjectChange = (e) => {
    const projectName = e.target.value;
    if (projectName === '') {
      onProjectSelect(null);
    } else {
      const project = projects.find(p => p.name === projectName);
      if (project) {
        onProjectSelect(project);
      }
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown';
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <div className="project-manager">
      <div className="project-header">
        <h3>Projects</h3>
        <button 
          className="create-project-btn"
          onClick={() => setShowCreateForm(!showCreateForm)}
          disabled={isLoading || !auth.user}
        >
          + New Project
        </button>
      </div>

      {showCreateForm && (
        <form className="create-project-form" onSubmit={handleCreateProject}>
          <div className="form-group">
            <label htmlFor="projectName">Project Name *</label>
            <input
              id="projectName"
              type="text"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              placeholder="my-awesome-project"
              disabled={isCreating}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="projectDescription">Description</label>
            <textarea
              id="projectDescription"
              value={newProjectDescription}
              onChange={(e) => setNewProjectDescription(e.target.value)}
              placeholder="Optional project description"
              disabled={isCreating}
              rows={3}
            />
          </div>
          <div className="form-actions">
            <button 
              type="button" 
              className="cancel-btn"
              onClick={() => {
                setShowCreateForm(false);
                setNewProjectName('');
                setNewProjectDescription('');
              }}
              disabled={isCreating}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="create-btn"
              disabled={isCreating || !newProjectName.trim()}
            >
              {isCreating ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        </form>
      )}

      <div className="project-selector">
        {isLoading ? (
          <div className="loading">Loading projects from S3...</div>
        ) : !auth.user ? (
          <div className="no-auth">Please log in to view projects</div>
        ) : (
          <div className="dropdown-container">
            <label htmlFor="project-select" className="dropdown-label">
              Select Project:
            </label>
            <select
              id="project-select"
              className="project-dropdown"
              value={selectedProject?.name || ''}
              onChange={handleProjectChange}
              disabled={projects.length === 0}
            >
              <option value="">
                {projects.length === 0 ? 'No projects available' : 'Choose a project...'}
              </option>
              {projects.map((project) => (
                <option key={project.name} value={project.name}>
                  {project.name} ({project.fileCount || 0} files)
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {selectedProject && (
        <div className="selected-project-info">
          <div className="selected-badge">
            <div className="project-details">
              <h4>📁 {selectedProject.name}</h4>
              {selectedProject.description && (
                <p className="description">{selectedProject.description}</p>
              )}
              <div className="project-meta">
                <span>Created: {formatDate(selectedProject.createdAt)}</span>
                <span>Files: {selectedProject.fileCount || 0}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectManager; 