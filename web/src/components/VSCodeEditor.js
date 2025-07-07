import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from 'react-oidc-context';
import FileExplorer from './FileExplorer';
import MarkdownEditor from './MarkdownEditor';
import ChatPanel from './ChatPanel';
import s3Service from '../services/s3Service';
import './VSCodeEditor.css';

const VSCodeEditor = ({ project, onBackToHome, debugMode = false, onDebugToggle, scoreThreshold = 0.5, onScoreThresholdChange }) => {
  const [files, setFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileContent, setFileContent] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState('saved'); // 'saved', 'saving', 'error', 'unsaved'
  const [saveTimeout, setSaveTimeout] = useState(null);
  const [projectSettings, setProjectSettings] = useState({
    systemPrompt: null,
    scoreThreshold: 0.5
  });
  const auth = useAuth();

  useEffect(() => {
    loadProjectFiles();
    loadProjectSettings();
  }, [project]);

  // Add this new useEffect to watch for scoreThreshold prop changes from DebugPanel
  useEffect(() => {
    // Only save if the prop value differs from our local project settings
    // and we have project settings loaded (to avoid saving on initial load)
    if (projectSettings.scoreThreshold !== undefined && 
        scoreThreshold !== projectSettings.scoreThreshold) {
      console.log(`ScoreThreshold prop changed from ${projectSettings.scoreThreshold} to ${scoreThreshold}, saving to project settings`);
      saveProjectSettings({ scoreThreshold });
    }
  }, [scoreThreshold]); // Watch for changes to the scoreThreshold prop

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

  const handleFileCreate = async (fileName, content, filePath) => {
    if (!project || !auth.user) return;
    
    try {
      const userId = auth.user?.profile?.sub || auth.user?.profile?.username;
      
      const initialized = s3Service.initializeWithCognito(auth.user);
      if (!initialized) {
        throw new Error('Failed to initialize S3 service');
      }

      // Create the file in S3
      await s3Service.uploadFileContentToProject(
        fileName,
        content,
        userId,
        project.name,
        filePath
      );

      // Reload the file list to include the new file
      await loadProjectFiles();

      // Find and select the newly created file
      const newFileKey = `users/${userId}/${project.name}/${filePath}`;
      
      // Wait a moment for the file list to update, then select the new file
      setTimeout(async () => {
        const updatedFiles = await s3Service.listProjectFiles(userId, project.name);
        const foundFile = updatedFiles.find(f => f.key === newFileKey);
        if (foundFile) {
          setFiles(updatedFiles);
          await handleFileSelect(foundFile);
        }
      }, 500);
      
    } catch (error) {
      console.error('Failed to create file:', error);
      throw error;
    }
  };

  const handleFileMove = async (file, currentPath, newPath) => {
    if (!project || !auth.user) return;
    
    try {
      const userId = auth.user?.profile?.sub || auth.user?.profile?.username;
      
      const initialized = s3Service.initializeWithCognito(auth.user);
      if (!initialized) {
        throw new Error('Failed to initialize S3 service');
      }

      // Calculate new S3 key
      const newFileKey = `users/${userId}/${project.name}/${newPath}`;

      // Use S3 native move operation (copy + delete, no download)
      await s3Service.moveFile(file.key, newFileKey);

      // Reload files to reflect the change
      await loadProjectFiles();

      // If the moved file was selected, select it in its new location
      if (selectedFile?.key === file.key) {
        setTimeout(async () => {
          const updatedFiles = await s3Service.listProjectFiles(userId, project.name);
          const movedFile = updatedFiles.find(f => f.key === newFileKey);
          if (movedFile) {
            await handleFileSelect(movedFile);
          }
        }, 500);
      }

      //console.log(`Successfully moved ${file.name} to ${newPath}`);
    } catch (error) {
      console.error('Failed to move file:', error);
      throw error;
    }
  };

  const handleFileDelete = async (file) => {
    if (!file || !auth.user) return;
    
    try {
      const initialized = s3Service.initializeWithCognito(auth.user);
      if (!initialized) {
        throw new Error('Failed to initialize S3 service');
      }

      // Delete the file from S3
      await s3Service.deleteFile(file.key);

      // If the deleted file was currently selected, clear the selection
      if (selectedFile?.key === file.key) {
        setSelectedFile(null);
        setFileContent('');
        setSaveStatus('saved');
      }

      // Reload the file list to reflect the deletion
      await loadProjectFiles();

      //console.log(`Successfully deleted ${file.name}`);
    } catch (error) {
      console.error('Failed to delete file:', error);
      alert(`Failed to delete file: ${error.message}`);
    }
  };

  const handleFileUpload = async (fileName, content, filePath, fileType) => {
    if (!project || !auth.user) return;
    
    try {
      const userId = auth.user?.profile?.sub || auth.user?.profile?.username;
      
      const initialized = s3Service.initializeWithCognito(auth.user);
      if (!initialized) {
        throw new Error('Failed to initialize S3 service');
      }

      // Upload the file to S3
      await s3Service.uploadFileContentToProject(
        fileName,
        content,
        userId,
        project.name,
        filePath
      );

      // Reload the file list to include the new file
      await loadProjectFiles();

      // Find and select the newly uploaded file
      const newFileKey = `users/${userId}/${project.name}/${filePath}`;
      
      // Wait a moment for the file list to update, then select the new file
      setTimeout(async () => {
        const updatedFiles = await s3Service.listProjectFiles(userId, project.name);
        const foundFile = updatedFiles.find(f => f.key === newFileKey);
        if (foundFile) {
          setFiles(updatedFiles);
          await handleFileSelect(foundFile);
        }
      }, 500);
      
    } catch (error) {
      console.error('Failed to upload file:', error);
      throw error;
    }
  };

  const loadProjectSettings = async () => {
    if (!project || !auth.user) return;
    
    try {
      const userId = auth.user?.profile?.sub || auth.user?.profile?.username;
      const initialized = s3Service.initializeWithCognito(auth.user);
      
      if (!initialized) {
        throw new Error('Failed to initialize S3 service');
      }

      const settings = await s3Service.loadProjectSettings(userId, project.name);
      setProjectSettings(settings);
      
      // Update parent component with loaded threshold
      onScoreThresholdChange(settings.scoreThreshold);
    } catch (error) {
      console.error('Failed to load project settings:', error);
      // Use defaults on error
      setProjectSettings({
        systemPrompt: null,
        scoreThreshold: 0.5
      });
    }
  };

  const saveProjectSettings = async (newSettings) => {
    if (!project || !auth.user) return;
    
    try {
      const userId = auth.user?.profile?.sub || auth.user?.profile?.username;
      const initialized = s3Service.initializeWithCognito(auth.user);
      
      if (!initialized) {
        throw new Error('Failed to initialize S3 service');
      }

      const updatedSettings = { ...projectSettings, ...newSettings };
      await s3Service.saveProjectSettings(userId, project.name, updatedSettings);
      setProjectSettings(updatedSettings);
    } catch (error) {
      console.error('Failed to save project settings:', error);
      // You could show a toast notification here
    }
  };

  // Handlers for settings changes
  const handleSystemPromptChange = (newPrompt) => {
    saveProjectSettings({ systemPrompt: newPrompt });
  };

  const handleScoreThresholdChange = (newThreshold) => {
    saveProjectSettings({ scoreThreshold: newThreshold });
    onScoreThresholdChange(newThreshold); // Also update parent
  };

  const handleServeChat = async () => {
    if (!project || !auth.user) return;
    
    try {
      const userId = auth.user?.profile?.sub || auth.user?.profile?.username;
      
      // Get the current project settings
      const settings = await s3Service.loadProjectSettings(userId, project.name);
      
      // Create a simple HTML chat interface that uses the existing /chat endpoint
      const chatHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${project.name} - Chat</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #1e1e1e;
            color: #d4d4d4;
            height: 100vh;
            display: flex;
            flex-direction: column;
        }
        
        .header {
            background: #2d2d30;
            border-bottom: 1px solid #3e3e42;
            padding: 1rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .project-title {
            font-size: 1.2rem;
            font-weight: 600;
        }
        
        .status {
            font-size: 0.9rem;
            color: #858585;
        }
        
        .chat-container {
            flex: 1;
            display: flex;
            flex-direction: column;
            max-width: 800px;
            margin: 0 auto;
            width: 100%;
            padding: 1rem;
        }
        
        .messages {
            flex: 1;
            overflow-y: auto;
            padding: 1rem;
            background: #252526;
            border-radius: 8px;
            margin-bottom: 1rem;
            max-height: 60vh;
        }
        
        .message {
            margin-bottom: 1rem;
            padding: 0.75rem;
            border-radius: 6px;
        }
        
        .message.user {
            background: #0e639c;
            margin-left: 2rem;
        }
        
        .message.assistant {
            background: #3c3c3c;
            margin-right: 2rem;
        }
        
        .message.error {
            background: #a31515;
        }
        
        .input-container {
            display: flex;
            gap: 0.5rem;
            padding: 1rem;
            background: #252526;
            border-radius: 8px;
        }
        
        .message-input {
            flex: 1;
            background: #3c3c3c;
            border: 1px solid #565656;
            color: #d4d4d4;
            padding: 0.75rem;
            border-radius: 4px;
            font-size: 1rem;
            resize: none;
        }
        
        .message-input:focus {
            outline: none;
            border-color: #0e639c;
        }
        
        .send-btn {
            background: #0e639c;
            border: none;
            color: white;
            padding: 0.75rem 1.5rem;
            border-radius: 4px;
            cursor: pointer;
            font-size: 1rem;
            transition: background-color 0.2s;
        }
        
        .send-btn:hover:not(:disabled) {
            background: #1177bb;
        }
        
        .send-btn:disabled {
            background: #3c3c3c;
            color: #858585;
            cursor: not-allowed;
        }
        
        .loading {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            color: #858585;
            font-style: italic;
        }
        
        .typing-indicator {
            display: flex;
            gap: 0.25rem;
        }
        
        .typing-indicator span {
            width: 4px;
            height: 4px;
            background: #858585;
            border-radius: 50%;
            animation: typing 1.4s infinite ease-in-out;
        }
        
        .typing-indicator span:nth-child(1) { animation-delay: -0.32s; }
        .typing-indicator span:nth-child(2) { animation-delay: -0.16s; }
        
        @keyframes typing {
            0%, 80%, 100% { transform: scale(0); }
            40% { transform: scale(1); }
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="project-title">📚 ${project.name}</div>
        <div class="status" id="status">🟢 Connected</div>
    </div>
    
    <div class="chat-container">
        <div class="messages" id="messages">
            <div class="message assistant">
                <strong>Assistant:</strong> Hello! I'm your AI assistant for the ${project.name} project.
            </div>
        </div>
        
        <div class="input-container">
            <textarea 
                class="message-input" 
                id="messageInput" 
                placeholder="Ask about your ${project.name} project..."
                rows="3"
            ></textarea>
            <button class="send-btn" id="sendBtn">Send</button>
        </div>
    </div>

    <script>
        const API_BASE = '${process.env.REACT_APP_CHAT_API_URL || 'http://localhost:8000'}';
        const USER_ID = '${userId}';
        const PROJECT_FOLDER = '${project.name}';
        const SYSTEM_PROMPT = ${JSON.stringify(settings.systemPrompt || null)};
        const SCORE_THRESHOLD = ${settings.scoreThreshold || 0.5};
        
        let sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substring(2, 15);
        let isLoading = false;
        
        const messagesContainer = document.getElementById('messages');
        const messageInput = document.getElementById('messageInput');
        const sendBtn = document.getElementById('sendBtn');
        const statusElement = document.getElementById('status');
        
        function addMessage(content, type = 'assistant') {
            const messageDiv = document.createElement('div');
            messageDiv.className = \`message \${type}\`;
            messageDiv.innerHTML = content;
            messagesContainer.appendChild(messageDiv);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
        
        function setLoading(loading) {
            isLoading = loading;
            sendBtn.disabled = loading;
            messageInput.disabled = loading;
            
            if (loading) {
                sendBtn.textContent = 'Sending...';
                addMessage('<div class="loading"><div class="typing-indicator"><span></span><span></span><span></span></div> Thinking...</div>', 'assistant');
            } else {
                sendBtn.textContent = 'Send';
                // Remove only the loading message
                const loadingMessage = messagesContainer.querySelector('.message.assistant .loading');
                if (loadingMessage) {
                    const messageDiv = loadingMessage.closest('.message.assistant');
                    if (messageDiv) {
                        messageDiv.remove();
                    }
                }
            }
        }
        
        async function sendMessage() {
            const message = messageInput.value.trim();
            if (!message || isLoading) return;
            
            // Add user message
            addMessage(\`<strong>You:</strong> \${message}\`, 'user');
            messageInput.value = '';
            
            setLoading(true);
            
            try {
                // Build query parameters
                const params = new URLSearchParams({
                    user_id: USER_ID,
                    project_folder: PROJECT_FOLDER,
                    session_id: sessionId,
                    question: message,
                    score_threshold: SCORE_THRESHOLD.toString()
                });
                
                if (SYSTEM_PROMPT) {
                    params.append('system_prompt', SYSTEM_PROMPT);
                }
                
                console.log('Sending request to:', \`\${API_BASE}/chat?\${params}\`);
                console.log('User ID:', USER_ID);
                console.log('Project:', PROJECT_FOLDER);
                console.log('Session:', sessionId);
                
                const response = await fetch(\`\${API_BASE}/chat?\${params}\`, {
                    method: 'POST',
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/x-www-form-urlencoded',
                    }
                });
                
                console.log('Response status:', response.status);
                console.log('Response headers:', response.headers);
                
                if (!response.ok) {
                    const errorText = await response.text();
                    console.error('Error response:', errorText);
                    throw new Error(\`HTTP error! status: \${response.status} - \${errorText}\`);
                }
                
                const data = await response.json();
                console.log('Response data:', data);
                
                const responseText = data.answer || data.response || 'No response received';
                
                addMessage(\`<strong>Assistant:</strong> \${responseText}\`, 'assistant');
                statusElement.textContent = '🟢 Connected';
                
            } catch (error) {
                console.error('Error sending message:', error);
                addMessage(\`<strong>Error:</strong> \${error.message}\`, 'error');
                statusElement.textContent = '🔴 Offline';
            } finally {
                setLoading(false);
            }
        }
        
        // Event listeners
        sendBtn.addEventListener('click', sendMessage);
        messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
        
        // Focus on input when page loads
        messageInput.focus();
    </script>
</body>
</html>`;

      // Create a blob URL for the HTML content
      const blob = new Blob([chatHtml], { type: 'text/html' });
      const chatUrl = URL.createObjectURL(blob);
      
      // Open the chat webpage in a new tab
      window.open(chatUrl, '_blank');
      
    } catch (error) {
      console.error('Failed to serve chat:', error);
      alert(`Failed to serve chat: ${error.message}`);
    }
  };

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
            className="serve-chat-btn"
            onClick={handleServeChat}
            title="Serve a standalone chat webpage for this project"
          >
            🌐 Serve Chat
          </button>
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
            onFileCreate={handleFileCreate}
            onFileMove={handleFileMove}
            onFileDelete={handleFileDelete}
            onFileUpload={handleFileUpload}
            project={project}
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
              debugMode={debugMode}
              onDebugToggle={onDebugToggle}
              scoreThreshold={projectSettings.scoreThreshold}
              onScoreThresholdChange={handleScoreThresholdChange}
              systemPrompt={projectSettings.systemPrompt}
              onSystemPromptChange={handleSystemPromptChange}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default VSCodeEditor; 