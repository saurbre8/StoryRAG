import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useAuth } from 'react-oidc-context';
import s3Service from '../services/s3Service';
import embedService from '../services/embedService';
import ProjectManager from './ProjectManager';
import './FileUploader.css';

const FileUploader = ({ onFilesUploaded }) => {
  const [isDragActive, setIsDragActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isEmbedding, setIsEmbedding] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});
  const [selectedProject, setSelectedProject] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');
  const auth = useAuth();

  const handleProjectSelect = (project) => {
    setSelectedProject(project);
    console.log('Selected project:', project);
  };

  const handleProjectCreate = (project) => {
    setSelectedProject(project);
    console.log('Created and selected project:', project);
  };

  const onDrop = useCallback(async (acceptedFiles) => {
    // Check if a project is selected
    if (!selectedProject) {
      alert('Please select a project before uploading files.');
      return;
    }

    // Filter for markdown files only
    const markdownFiles = acceptedFiles.filter(file => 
      file.name.endsWith('.md') || file.type === 'text/markdown'
    );

    if (markdownFiles.length === 0) {
      alert('No .md files found in the uploaded content. Please upload folders or files containing markdown files.');
      return;
    }

    console.log(`Found ${markdownFiles.length} markdown files out of ${acceptedFiles.length} total files`);

    try {
      setIsUploading(true);
      setStatusMessage('Uploading files to S3...');
      
      // Initialize S3 service with user credentials
      const userId = auth.user?.profile?.sub || auth.user?.profile?.username;
      if (!userId) {
        throw new Error('User ID not found');
      }

      const initialized = s3Service.initializeWithCognito(auth.user);
      if (!initialized) {
        throw new Error('Failed to initialize S3 service');
      }

      // Process files with both local reading and S3 upload to project
      const filesWithContent = await Promise.all(
        markdownFiles.map(async (file, index) => {
          try {
            // Read file content for local display
            const content = await file.text();
            
            // Track upload progress for this file
            const progressKey = `file-${index}`;
            setUploadProgress(prev => ({ ...prev, [progressKey]: 0 }));

            // Upload to S3 in the selected project
            const uploadResult = await s3Service.uploadFileContentToProject(
              file.name, 
              content, 
              userId,
              selectedProject.name,
              (percent) => {
                setUploadProgress(prev => ({ ...prev, [progressKey]: percent }));
              }
            );

            // Clear progress for this file
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
              path: file.webkitRelativePath || file.name,
              s3Key: uploadResult.key,
              s3Location: uploadResult.location,
              projectName: selectedProject.name,
              uploadedToS3: true
            };
          } catch (error) {
            console.error(`Failed to upload ${file.name}:`, error);
            
            // Still return file data for local viewing, but mark S3 upload as failed
            const content = await file.text();
            return {
              name: file.name,
              size: file.size,
              content: content,
              lastModified: file.lastModified,
              path: file.webkitRelativePath || file.name,
              projectName: selectedProject.name,
              uploadedToS3: false,
              uploadError: error.message
            };
          }
        })
      );

      console.log('Files processed:', filesWithContent);
      
      // Count successful uploads
      const successCount = filesWithContent.filter(f => f.uploadedToS3).length;
      const failCount = filesWithContent.length - successCount;

      setIsUploading(false);

      // If we have successful uploads, trigger embedding
      if (successCount > 0) {
        setIsEmbedding(true);
        setStatusMessage(`Embedding ${successCount} files for better search...`);
        
        console.log(`Starting embedding for project: ${selectedProject.name}`);
        
        const embedResult = await embedService.embedProjectSafely(userId, selectedProject.name);
        
        setIsEmbedding(false);
        
        if (embedResult.success) {
          setStatusMessage(`✅ Successfully uploaded and embedded ${successCount} files!`);
          console.log('Embedding successful:', embedResult);
          
          if (failCount === 0) {
            alert(`Successfully uploaded and embedded ${successCount} files in project "${selectedProject.name}"! Files are ready for chat.`);
          } else {
            alert(`Uploaded and embedded ${successCount} files successfully in project "${selectedProject.name}". ${failCount} files failed to upload but embedded files are ready for chat.`);
          }
        } else {
          setStatusMessage(`⚠️ Files uploaded but embedding failed: ${embedResult.message}`);
          console.error('Embedding failed:', embedResult);
          
          if (failCount === 0) {
            alert(`Successfully uploaded ${successCount} files to project "${selectedProject.name}", but embedding failed: ${embedResult.message}. You can try embedding later.`);
          } else {
            alert(`Uploaded ${successCount} files to project "${selectedProject.name}" but embedding failed. ${failCount} files also failed to upload.`);
          }
        }
      } else {
        setStatusMessage('❌ No files were successfully uploaded');
        alert(`All file uploads failed. Please try again.`);
      }

      // Clear status after a delay
      setTimeout(() => setStatusMessage(''), 5000);

      onFilesUploaded(filesWithContent);

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
  }, [onFilesUploaded, auth.user, selectedProject]);

  const { getRootProps, getInputProps, isDragActive: dropzoneActive } = useDropzone({
    onDrop,
    multiple: true,
    disabled: isUploading || isEmbedding || !selectedProject,
    noClick: false,
    noKeyboard: false
  });

  const getOverallProgress = () => {
    const progresses = Object.values(uploadProgress);
    if (progresses.length === 0) return 0;
    return Math.round(progresses.reduce((a, b) => a + b, 0) / progresses.length);
  };

  const getCurrentStatus = () => {
    if (isEmbedding) return 'embedding';
    if (isUploading) return 'uploading';
    return 'ready';
  };

  return (
    <div className="file-uploader">
      <ProjectManager 
        selectedProject={selectedProject}
        onProjectSelect={handleProjectSelect}
        onProjectCreate={handleProjectCreate}
      />
      
      {statusMessage && (
        <div className={`status-message ${statusMessage.includes('✅') ? 'success' : statusMessage.includes('❌') || statusMessage.includes('⚠️') ? 'error' : 'info'}`}>
          {statusMessage}
        </div>
      )}
      
      <div 
        {...getRootProps()} 
        className={`dropzone ${dropzoneActive || isDragActive ? 'active' : ''} ${getCurrentStatus()} ${!selectedProject ? 'disabled' : ''}`}
      >
        <input 
          {...getInputProps()} 
          webkitdirectory=""
          directory=""
        />
        <div className="dropzone-content">
          {!selectedProject ? (
            <div>
              <div className="upload-icon">⚠️</div>
              <h3>Select a Project First</h3>
              <p>Please select or create a project above before uploading files</p>
              <p className="help-text">Projects help organize your markdown files in S3</p>
            </div>
          ) : isEmbedding ? (
            <div className="embedding-progress">
              <div className="upload-icon">🧠</div>
              <h3>Embedding files for search...</h3>
              <div className="embedding-spinner"></div>
              <p>Processing files to enable AI chat functionality</p>
              <p className="progress-detail">This may take a moment...</p>
            </div>
          ) : isUploading ? (
            <div className="upload-progress">
              <div className="upload-icon">⬆️</div>
              <h3>Uploading to project "{selectedProject.name}"...</h3>
              <div className="progress-bar">
                <div 
                  className="progress-fill" 
                  style={{ width: `${getOverallProgress()}%` }}
                ></div>
              </div>
              <p>{getOverallProgress()}% complete</p>
              <p className="progress-detail">
                {Object.keys(uploadProgress).length} files uploading
              </p>
            </div>
          ) : (
            <>
              <div className="upload-icon">📁</div>
              {dropzoneActive || isDragActive ? (
                <div>
                  <h3>Drop your files or folders here!</h3>
                  <p>Release to upload to "{selectedProject.name}" (only .md files will be processed)</p>
                  <p className="s3-info">Files will be securely stored and embedded for AI chat</p>
                </div>
              ) : (
                <div>
                  <h3>Drag & drop files or folders here</h3>
                  <p>or <span className="click-text">click to browse</span></p>
                  <p className="file-types">Automatically filters for .md files only</p>
                  <p className="s3-info">✅ Files will be stored in project: <strong>{selectedProject.name}</strong></p>
                  <p className="embed-info">🧠 Files will be automatically embedded for AI chat</p>
                  <div className="upload-options">
                    <div className="option">📄 Individual files</div>
                    <div className="option">📂 Entire folders</div>
                    <div className="option">🗂️ Multiple folders</div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default FileUploader;
