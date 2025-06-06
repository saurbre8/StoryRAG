/**
 * CreateTab Component
 * 
 * The main interface for creating new projects and uploading worldbuilding files.
 * This tab allows users to start new projects by uploading markdown files that contain
 * their worldbuilding content (characters, locations, plot notes, etc.).
 * 
 * Features:
 * - Integrates FileUploader for drag-and-drop file uploads
 * - Displays uploaded files using FileViewer component
 * - Manages the flow from file upload to project creation
 * - Shows file preview and management capabilities
 */

import React, { useState } from 'react';
import FileUploader from './FileUploader';
import FileViewer from './FileViewer';

const CreateTab = () => {
  const [uploadedFiles, setUploadedFiles] = useState([]);

  const handleFilesUploaded = (files) => {
    setUploadedFiles(files);
  };

  const clearFiles = () => {
    setUploadedFiles([]);
  };

  return (
    <div className="create-tab">
      <div className="tab-header">
        <h3>Create New Project</h3>
        <p>Start by creating a project and uploading your worldbuilding files</p>
      </div>
      
      <FileUploader onFilesUploaded={handleFilesUploaded} />
      
      {uploadedFiles.length > 0 && (
        <FileViewer 
          files={uploadedFiles} 
          onClear={clearFiles}
        />
      )}
    </div>
  );
};

export default CreateTab; 