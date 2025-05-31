import React, { useState } from 'react';
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
    <div className="App">
      <header className="App-header">
        <h1>StoryRAG - Markdown File Manager</h1>
        <p>Upload and manage your markdown files</p>
      </header>
      
      <main className="App-main">
        <FileUploader onFilesUploaded={handleFilesUploaded} />
        
        {uploadedFiles.length > 0 && (
          <FileViewer 
            files={uploadedFiles} 
            onClear={clearFiles}
          />
        )}
      </main>
    </div>
  );
}

export default App;
