import React, { useState } from 'react';
import AuthWrapper from './components/AuthWrapper';
import FileUploader from './components/FileUploader';
import FileViewer from './components/FileViewer';
import './App.css';

function App() {
  const [uploadedFiles, setUploadedFiles] = useState([]);

  const handleFilesUploaded = (files) => {
    setUploadedFiles(files);
  };

  const clearFiles = () => {
    setUploadedFiles([]);
  };

  return (
    <AuthWrapper>
      <div className="App">
        <main className="App-main">
          <div className="app-content">
            <div className="intro-section">
              <h2>Markdown File Manager</h2>
              <p>Upload and manage your markdown files securely</p>
            </div>
            
            <FileUploader onFilesUploaded={handleFilesUploaded} />
            
            {uploadedFiles.length > 0 && (
              <FileViewer 
                files={uploadedFiles} 
                onClear={clearFiles}
              />
            )}
          </div>
        </main>
      </div>
    </AuthWrapper>
  );
}

export default App;
