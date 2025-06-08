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