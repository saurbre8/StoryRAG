import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useAuth } from 'react-oidc-context';
import s3Service from '../services/s3Service';
import './FileUploader.css';

const FileUploader = ({ onFilesUploaded }) => {
  const [isDragActive, setIsDragActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});
  const auth = useAuth();

  const onDrop = useCallback(async (acceptedFiles) => {
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
      
      // Initialize S3 service with user credentials
      const userId = auth.user?.profile?.sub || auth.user?.profile?.username;
      if (!userId) {
        throw new Error('User ID not found');
      }

      const initialized = s3Service.initializeWithCognito(auth.user);
      if (!initialized) {
        throw new Error('Failed to initialize S3 service');
      }

      // Process files with both local reading and S3 upload
      const filesWithContent = await Promise.all(
        markdownFiles.map(async (file, index) => {
          try {
            // Read file content for local display
            const content = await file.text();
            
            // Track upload progress for this file
            const progressKey = `file-${index}`;
            setUploadProgress(prev => ({ ...prev, [progressKey]: 0 }));

            // Upload to S3
            const uploadResult = await s3Service.uploadFileContent(
              file.name, 
              content, 
              userId,
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
              uploadedToS3: false,
              uploadError: error.message
            };
          }
        })
      );

      console.log('Files processed:', filesWithContent);
      onFilesUploaded(filesWithContent);

      // Show success message
      const successCount = filesWithContent.filter(f => f.uploadedToS3).length;
      const failCount = filesWithContent.length - successCount;
      
      if (failCount === 0) {
        alert(`Successfully uploaded ${successCount} files to S3!`);
      } else {
        alert(`Uploaded ${successCount} files successfully. ${failCount} files failed to upload to S3 but are available locally.`);
      }

    } catch (error) {
      console.error('Upload process failed:', error);
      alert(`Upload failed: ${error.message}`);
    } finally {
      setIsUploading(false);
      setUploadProgress({});
    }
  }, [onFilesUploaded, auth.user]);

  const { getRootProps, getInputProps, isDragActive: dropzoneActive } = useDropzone({
    onDrop,
    multiple: true,
    disabled: isUploading,
    noClick: false,
    noKeyboard: false
  });

  const getOverallProgress = () => {
    const progresses = Object.values(uploadProgress);
    if (progresses.length === 0) return 0;
    return Math.round(progresses.reduce((a, b) => a + b, 0) / progresses.length);
  };

  return (
    <div className="file-uploader">
      <div 
        {...getRootProps()} 
        className={`dropzone ${dropzoneActive || isDragActive ? 'active' : ''} ${isUploading ? 'uploading' : ''}`}
      >
        <input 
          {...getInputProps()} 
          webkitdirectory=""
          directory=""
        />
        <div className="dropzone-content">
          {isUploading ? (
            <div className="upload-progress">
              <div className="upload-icon">⬆️</div>
              <h3>Uploading to S3...</h3>
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
                  <p>Release to upload (only .md files will be processed)</p>
                  <p className="s3-info">Files will be securely stored in your S3 bucket</p>
                </div>
              ) : (
                <div>
                  <h3>Drag & drop files or folders here</h3>
                  <p>or <span className="click-text">click to browse</span></p>
                  <p className="file-types">Automatically filters for .md files only</p>
                  <p className="s3-info">✅ Files will be securely stored in AWS S3</p>
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
