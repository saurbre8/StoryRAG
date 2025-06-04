import React, { useState } from 'react';
import AuthWrapper from './components/AuthWrapper';
import FileUploader from './components/FileUploader';
import FileViewer from './components/FileViewer';
import Chat from './components/Chat';
import './App.css';

function App() {
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [activeTab, setActiveTab] = useState('files'); // 'files' or 'chat'

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
              <h2>Project Hub</h2>
              <p>Manage your files and chat with the worldbuilding assistant</p>
              
              <div className="tab-navigation">
                <button 
                  className={activeTab === 'files' ? 'active' : ''}
                  onClick={() => setActiveTab('files')}
                >
                  File Manager
                </button>
                <button 
                  className={activeTab === 'chat' ? 'active' : ''}
                  onClick={() => setActiveTab('chat')}
                >
                  Chat Assistant
                </button>
              </div>
            </div>
            
            {activeTab === 'files' ? (
              <>
                <FileUploader onFilesUploaded={handleFilesUploaded} />
                {uploadedFiles.length > 0 && (
                  <FileViewer 
                    files={uploadedFiles} 
                    onClear={clearFiles}
                  />
                )}
              </>
            ) : (
              <Chat />
            )}
          </div>
        </main>
      </div>
    </AuthWrapper>
  );
}

export default App;
