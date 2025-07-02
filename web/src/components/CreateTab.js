/**
 * CreateTab Component - Streamlined Project Creation
 * 
 * A simplified interface for creating new projects with an optional file upload step.
 * This redesign eliminates the double naming issue and makes it easy to create
 * projects with or without files.
 * 
 * Features:
 * - Single-step project creation with name and description
 * - Optional file upload after project creation
 * - Clear, intuitive flow
 * - Support for empty projects
 * - Integrated file upload and embedding
 */

import React, { useState } from 'react';
import { useAuth } from 'react-oidc-context';
import { useDropzone } from 'react-dropzone';
import s3Service from '../services/s3Service';
import embedService from '../services/embedService';
import './CreateTab.css';

const CreateTab = ({ onProjectCreated }) => {
  const [step, setStep] = useState('create'); // 'create' or 'upload'
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isEmbedding, setIsEmbedding] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});
  const [statusMessage, setStatusMessage] = useState('');
  const [createdProject, setCreatedProject] = useState(null);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const auth = useAuth();

  const handleCreateProject = async (e) => {
    e.preventDefault();
    
    if (!projectName.trim()) {
      alert('Project name is required');
      return;
    }

    // Validate project name (no special characters except hyphens and underscores)
    const projectNameRegex = /^[a-zA-Z0-9_-]+$/;
    if (!projectNameRegex.test(projectName)) {
      alert('Project name can only contain letters, numbers, hyphens, and underscores');
      return;
    }

    try {
      setIsCreating(true);
      const userId = auth.user?.profile?.sub || auth.user?.profile?.username;
      
      if (!userId) {
        throw new Error('User ID not found');
      }

      const initialized = s3Service.initializeWithCognito(auth.user);
      if (!initialized) {
        throw new Error('Failed to initialize S3 service');
      }

      console.log('Creating project:', projectName);
      await s3Service.createProject(userId, projectName, projectDescription);
      
      const newProject = { 
        name: projectName, 
        description: projectDescription,
        createdAt: new Date().toISOString(),
        fileCount: 0
      };
      
      setCreatedProject(newProject);
      setStatusMessage(`✅ Project "${projectName}" created successfully!`);
      
      // Call the callback to notify parent component
      if (onProjectCreated) {
        onProjectCreated(newProject);
      }
      
      // Move to upload step
      setStep('upload');
      
    } catch (error) {
      console.error('Failed to create project:', error);
      alert(`Failed to create project: ${error.message}`);
    } finally {
      setIsCreating(false);
    }
  };

  const handleFilesUploaded = async (acceptedFiles) => {
    if (!createdProject) {
      alert('No project selected for upload');
      return;
    }

    // Filter for markdown files only
    const markdownFiles = acceptedFiles.filter(file => 
      file.name.endsWith('.md') || file.type === 'text/markdown'
    );

    if (markdownFiles.length === 0) {
      alert('No .md files found. Please upload markdown files.');
      return;
    }

    try {
      setIsUploading(true);
      setStatusMessage('Uploading files to S3...');
      
      const userId = auth.user?.profile?.sub || auth.user?.profile?.username;
      
      // Process files with both local reading and S3 upload
      const filesWithContent = await Promise.all(
        markdownFiles.map(async (file, index) => {
          try {
            const content = await file.text();
            
            const progressKey = `file-${index}`;
            setUploadProgress(prev => ({ ...prev, [progressKey]: 0 }));

            const uploadResult = await s3Service.uploadFileContentToProject(
              file.name, 
              content, 
              userId,
              createdProject.name,
              file.name,
              (percent) => {
                setUploadProgress(prev => ({ ...prev, [progressKey]: percent }));
              }
            );

            setUploadProgress(prev => {
              const newProgress = { ...prev };
              delete newProgress[progressKey];
              return newProgress;
            });

            return {
              name: file.name,
              size: file.size,
              content: content,
              lastModified: file.lastModified,
              path: file.name,
              s3Key: uploadResult.key,
              s3Location: uploadResult.location,
              projectName: createdProject.name,
              uploadedToS3: true
            };
          } catch (error) {
            console.error(`Failed to upload ${file.name}:`, error);
            const content = await file.text();
            
            return {
              name: file.name,
              size: file.size,
              content: content,
              lastModified: file.lastModified,
              path: file.name,
              projectName: createdProject.name,
              uploadedToS3: false,
              uploadError: error.message
            };
          }
        })
      );

      const successCount = filesWithContent.filter(f => f.uploadedToS3).length;
      setUploadedFiles(filesWithContent);
      setIsUploading(false);

      if (successCount > 0) {
        setIsEmbedding(true);
        setStatusMessage(`Embedding ${successCount} files for better search...`);
        
        const embedResult = await embedService.embedProjectSafely(userId, createdProject.name);
        
        setIsEmbedding(false);
        
        if (embedResult.success) {
          setStatusMessage(`✅ Successfully uploaded and embedded ${successCount} files!`);
          alert(`Successfully uploaded and embedded ${successCount} files in project "${createdProject.name}"! Files are ready for chat.`);
        } else {
          setStatusMessage(`⚠️ Files uploaded but embedding failed: ${embedResult.message}`);
          alert(`Successfully uploaded ${successCount} files to project "${createdProject.name}", but embedding failed: ${embedResult.message}. You can try embedding later.`);
        }
      } else {
        setStatusMessage('❌ No files were successfully uploaded');
        alert(`All file uploads failed. Please try again.`);
      }

      setTimeout(() => setStatusMessage(''), 5000);

    } catch (error) {
      console.error('Upload process failed:', error);
      alert(`Upload failed: ${error.message}`);
      setStatusMessage('❌ Upload failed');
      setTimeout(() => setStatusMessage(''), 5000);
    } finally {
      setIsUploading(false);
      setIsEmbedding(false);
      setUploadProgress({});
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: handleFilesUploaded,
    multiple: true,
    disabled: isUploading || isEmbedding,
    noClick: false,
    noKeyboard: false
  });

  const getOverallProgress = () => {
    const progresses = Object.values(uploadProgress);
    if (progresses.length === 0) return 0;
    return Math.round(progresses.reduce((a, b) => a + b, 0) / progresses.length);
  };

  const startNewProject = () => {
    setStep('create');
    setProjectName('');
    setProjectDescription('');
    setCreatedProject(null);
    setUploadedFiles([]);
    setStatusMessage('');
  };

  const skipFileUpload = () => {
    alert(`Project "${createdProject.name}" created successfully! You can add files later from the chat interface.`);
    // Optionally redirect to chat or reset
    startNewProject();
  };

  return (
    <div className="create-tab">
      <div className="tab-header">
        <h3>Create New Project</h3>
        <p>Start a new worldbuilding project and optionally add your markdown files</p>
      </div>

      {statusMessage && (
        <div className={`status-message ${statusMessage.includes('✅') ? 'success' : statusMessage.includes('❌') || statusMessage.includes('⚠️') ? 'error' : 'info'}`}>
          {statusMessage}
        </div>
      )}

      {step === 'create' ? (
        <div className="create-project-section">
          <div className="create-form-container">
            <h4>Step 1: Create Your Project</h4>
            <form onSubmit={handleCreateProject} className="create-project-form">
              <div className="form-group">
                <label htmlFor="projectName">Project Name *</label>
                <input
                  id="projectName"
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="my-worldbuilding-project"
                  disabled={isCreating}
                  required
                />
                <small>Use letters, numbers, hyphens, and underscores only</small>
              </div>
              
              <div className="form-group">
                <label htmlFor="projectDescription">Description (Optional)</label>
                <textarea
                  id="projectDescription"
                  value={projectDescription}
                  onChange={(e) => setProjectDescription(e.target.value)}
                  placeholder="Describe your worldbuilding project..."
                  disabled={isCreating}
                  rows={3}
                />
              </div>
              
              <div className="form-actions">
                <button 
                  type="submit" 
                  className="create-btn"
                  disabled={isCreating || !projectName.trim()}
                >
                  {isCreating ? 'Creating...' : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : (
        <div className="upload-section">
          <div className="upload-header">
            <h4>Step 2: Add Files (Optional)</h4>
            <p>Project "{createdProject.name}" created! You can now add your markdown files or skip for now.</p>
            <div className="upload-actions">
              <button onClick={skipFileUpload} className="skip-btn">
                Skip for Now
              </button>
              <button onClick={startNewProject} className="new-project-btn">
                Create Another Project
              </button>
            </div>
          </div>

          <div 
            {...getRootProps()} 
            className={`dropzone ${isDragActive ? 'active' : ''} ${isUploading || isEmbedding ? 'disabled' : ''}`}
          >
            <input {...getInputProps()} />
            <div className="dropzone-content">
              {isEmbedding ? (
                <div className="embedding-progress">
                  <div className="upload-icon">🧠</div>
                  <h3>Embedding files for search...</h3>
                  <div className="embedding-spinner"></div>
                  <p>Processing files to enable AI chat functionality</p>
                </div>
              ) : isUploading ? (
                <div className="upload-progress">
                  <div className="upload-icon">⬆️</div>
                  <h3>Uploading to project "{createdProject.name}"...</h3>
                  <div className="progress-bar">
                    <div 
                      className="progress-fill" 
                      style={{ width: `${getOverallProgress()}%` }}
                    ></div>
                  </div>
                  <p>{getOverallProgress()}% complete</p>
                </div>
              ) : (
                <>
                  <div className="upload-icon">📁</div>
                  {isDragActive ? (
                    <div>
                      <h3>Drop your files here!</h3>
                      <p>Release to upload to "{createdProject.name}"</p>
                    </div>
                  ) : (
                    <div>
                      <h3>Drag & drop markdown files here</h3>
                      <p>or <span className="click-text">click to browse</span></p>
                      <p className="file-types">Only .md files will be processed</p>
                      <p className="s3-info">✅ Files will be stored in project: <strong>{createdProject.name}</strong></p>
                      <p className="embed-info">🧠 Files will be automatically embedded for AI chat</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {uploadedFiles.length > 0 && (
            <div className="uploaded-files">
              <h4>Uploaded Files ({uploadedFiles.length})</h4>
              <div className="files-list">
                {uploadedFiles.map((file, index) => (
                  <div key={index} className={`file-item ${file.uploadedToS3 ? 'success' : 'error'}`}>
                    <span className="file-name">{file.name}</span>
                    <span className="file-status">
                      {file.uploadedToS3 ? '✅ Uploaded' : '❌ Failed'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CreateTab; 