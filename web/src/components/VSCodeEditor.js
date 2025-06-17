import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from 'react-oidc-context';
import FileExplorer from './FileExplorer';
import MarkdownEditor from './MarkdownEditor';
import ChatPanel from './ChatPanel';
import s3Service from '../services/s3Service';
import './VSCodeEditor.css';

const VSCodeEditor = ({ project, onBackToHome }) => {
  const [files, setFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileContent, setFileContent] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState('saved'); // 'saved', 'saving', 'error', 'unsaved'
  const [saveTimeout, setSaveTimeout] = useState(null);
  const auth = useAuth();

  useEffect(() => {
    loadProjectFiles();
  }, [project]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeout) {
        clearTimeout(saveTimeout);
      }
    };
  }, [saveTimeout]);

  const loadProjectFiles = async () => {
    if (!project || !auth.user) return;
    
    try {
      setIsLoading(true);
      const userId = auth.user?.profile?.sub || auth.user?.profile?.username;
      
      const initialized = s3Service.initializeWithCognito(auth.user);
      if (!initialized) {
        throw new Error('Failed to initialize S3 service');
      }

      const projectFiles = await s3Service.listProjectFiles(userId, project.name);
      setFiles(projectFiles);
      
      // Auto-select the first file
      if (projectFiles.length > 0) {
        await handleFileSelect(projectFiles[0]);
      }
    } catch (error) {
      console.error('Failed to load project files:', error);
      setFiles([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileSelect = async (file) => {
    // Save current file before switching if there are unsaved changes
    if (saveStatus === 'unsaved' && selectedFile) {
      await saveFile(selectedFile, fileContent);
    }
    
    setSelectedFile(file);
    setSaveStatus('saved');
    await loadFileContent(file);
  };

  const loadFileContent = async (file) => {
    if (!file || !auth.user) return;
    
    try {
      const initialized = s3Service.initializeWithCognito(auth.user);
      if (!initialized) {
        throw new Error('Failed to initialize S3 service');
      }

      const result = await s3Service.downloadFile(file.key);
      setFileContent(result.content);
    } catch (error) {
      console.error('Failed to load file content:', error);
      setFileContent(`Error loading file content: ${error.message}`);
    }
  };

  const saveFile = async (file, content) => {
    if (!file || !auth.user) return;
    
    try {
      setSaveStatus('saving');
      const userId = auth.user?.profile?.sub || auth.user?.profile?.username;
      
      // Extract the relative file path from the full S3 key
      const projectPrefix = `users/${userId}/${project.name}/`;
      const relativePath = file.key.startsWith(projectPrefix) 
        ? file.key.substring(projectPrefix.length)
        : file.name; // fallback to just filename
      
      await s3Service.uploadFileContentToProject(
        file.name, 
        content, 
        userId, 
        project.name, 
        relativePath  // This preserves the folder structure
      );
      setSaveStatus('saved');
    } catch (error) {
      console.error('Failed to save file:', error);
      setSaveStatus('error');
      // You could show a toast notification here
    }
  };

  const debouncedSave = useCallback((file, content) => {
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }
    
    const timeout = setTimeout(() => {
      saveFile(file, content);
    }, 2000); // Save after 2 seconds of no changes
    
    setSaveTimeout(timeout);
  }, [saveTimeout]);

  const handleContentChange = (newContent) => {
    setFileContent(newContent);
    setSaveStatus('unsaved');
    
    if (selectedFile) {
      debouncedSave(selectedFile, newContent);
    }
  };

  const handleManualSave = () => {
    if (selectedFile && saveStatus !== 'saving') {
      if (saveTimeout) {
        clearTimeout(saveTimeout);
        setSaveTimeout(null);
      }
      saveFile(selectedFile, fileContent);
    }
  };

  // Handle Ctrl+S for manual save
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleManualSave();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedFile, fileContent, saveStatus]);

  const getSaveStatusDisplay = () => {
    switch (saveStatus) {
      case 'saving':
        return { text: 'Saving...', color: '#ffa500' };
      case 'saved':
        return { text: 'All changes saved', color: '#4caf50' };
      case 'unsaved':
        return { text: 'Unsaved changes', color: '#ff9800' };
      case 'error':
        return { text: 'Save failed', color: '#f44336' };
      default:
        return { text: '', color: '#d4d4d4' };
    }
  };

  const saveStatusInfo = getSaveStatusDisplay();

  return (
    <div className="vscode-editor">
      {/* Top Bar */}
      <div className="editor-header">
        <div className="header-left">
          <button className="back-btn" onClick={onBackToHome}>
            ← Back to Projects
          </button>
          <div className="project-title">
            <span className="project-icon">📚</span>
            {project.name}
          </div>
          
          {/* Save Status */}
          {selectedFile && (
            <div className="save-status" style={{ color: saveStatusInfo.color }}>
              <span className="save-indicator">●</span>
              {saveStatusInfo.text}
            </div>
          )}
        </div>
        
        <div className="header-right">
          {selectedFile && saveStatus !== 'saved' && (
            <button 
              className="save-btn"
              onClick={handleManualSave}
              disabled={saveStatus === 'saving'}
            >
              {saveStatus === 'saving' ? 'Saving...' : 'Save (Ctrl+S)'}
            </button>
          )}
          <button 
            className={`chat-toggle ${isChatOpen ? 'active' : ''}`}
            onClick={() => setIsChatOpen(!isChatOpen)}
          >
            💬 AI Assistant
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="editor-main">
        {/* File Explorer Sidebar */}
        <div className="sidebar">
          <FileExplorer 
            files={files}
            selectedFile={selectedFile}
            onFileSelect={handleFileSelect}
            isLoading={isLoading}
          />
        </div>

        {/* Editor Content */}
        <div className="editor-content">
          {isLoading ? (
            <div className="editor-loading">
              Loading project files...
            </div>
          ) : selectedFile && fileContent !== null ? (
            <MarkdownEditor
              file={selectedFile}
              content={fileContent}
              onChange={handleContentChange}
              projectFiles={files}
            />
          ) : (
            <div className="no-file-selected">
              <div className="welcome-message">
                <h3>Welcome to {project.name}</h3>
                <p>Select a file from the explorer to start editing</p>
              </div>
            </div>
          )}
        </div>

        {/* Chat Panel */}
        {isChatOpen && (
          <div className="chat-sidebar">
            <ChatPanel 
              project={project}
              onClose={() => setIsChatOpen(false)}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default VSCodeEditor; 