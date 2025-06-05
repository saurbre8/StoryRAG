import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from 'react-oidc-context';
import ProjectManager from './ProjectManager';
import chatApiService from '../services/chatApiService';
import './Chat.css';

const Chat = () => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [apiStatus, setApiStatus] = useState('unknown'); // 'online', 'offline', 'unknown'
  const [connectionError, setConnectionError] = useState(null);
  const messagesEndRef = useRef(null);
  const auth = useAuth();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Check API health on component mount
  useEffect(() => {
    checkApiHealth();
  }, []);

  const checkApiHealth = async () => {
    try {
      const isHealthy = await chatApiService.checkHealth();
      setApiStatus(isHealthy ? 'online' : 'offline');
      if (!isHealthy) {
        setConnectionError('Cannot connect to chat API. Please check your connection.');
      } else {
        setConnectionError(null);
      }
    } catch (error) {
      setApiStatus('offline');
      setConnectionError('Failed to check API status.');
    }
  };

  const handleProjectSelect = (project) => {
    setSelectedProject(project);
    // Clear messages when switching projects
    setMessages([]);
    console.log('Selected project for chat:', project);
  };

  const sendMessage = async () => {
    if (!inputMessage.trim()) return;
    
    if (!selectedProject) {
      alert('Please select a project before chatting.');
      return;
    }

    if (apiStatus === 'offline') {
      alert('Chat API is currently offline. Please try again later.');
      return;
    }

    const userMessage = inputMessage;
    setInputMessage('');
    setIsLoading(true);
    setConnectionError(null);

    // Add user message to chat
    setMessages(prev => [...prev, { type: 'user', content: userMessage }]);

    try {
      const userId = auth.user?.profile?.sub || auth.user?.profile?.username;
      
      const data = await chatApiService.sendMessage({
        message: userMessage,
        userId: userId,
        projectName: selectedProject.name
      });

      // Add assistant response to chat
      setMessages(prev => [...prev, { type: 'assistant', content: data.response }]);
      
      // Update API status to online if request succeeded
      if (apiStatus !== 'online') {
        setApiStatus('online');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      
      // Update API status and show appropriate error
      setApiStatus('offline');
      setConnectionError(error.message);
      
      setMessages(prev => [...prev, { 
        type: 'error', 
        content: `Error: ${error.message}` 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const retryConnection = async () => {
    await checkApiHealth();
  };

  return (
    <div className="chat-container">
      <ProjectManager 
        selectedProject={selectedProject}
        onProjectSelect={handleProjectSelect}
      />
      
      <div className="chat-header">
        <h3>AI Worldbuilding Assistant</h3>
        <div className="api-status">
          <span className={`status-indicator ${apiStatus}`}>
            {apiStatus === 'online' && '🟢 Connected'}
            {apiStatus === 'offline' && '🔴 Offline'}
            {apiStatus === 'unknown' && '🟡 Checking...'}
          </span>
          {apiStatus === 'offline' && (
            <button className="retry-btn" onClick={retryConnection}>
              Retry Connection
            </button>
          )}
        </div>
        {selectedProject ? (
          <p>Chatting about: <strong>{selectedProject.name}</strong></p>
        ) : (
          <p>Select a project above to start chatting</p>
        )}
      </div>

      {connectionError && (
        <div className="connection-error">
          <span>⚠️ {connectionError}</span>
        </div>
      )}
      
      <div className="chat-messages">
        {messages.map((message, index) => (
          <div key={index} className={`message ${message.type}`}>
            <div className="message-content">
              {message.content}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="message assistant">
            <div className="message-content">
              <div className="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input">
        <textarea
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={
            apiStatus === 'offline' 
              ? "Chat API is offline..." 
              : selectedProject 
                ? `Ask about ${selectedProject.name}...` 
                : "Select a project first..."
          }
          disabled={isLoading || !selectedProject || apiStatus === 'offline'}
          rows={3}
        />
        <button 
          onClick={sendMessage} 
          disabled={isLoading || !inputMessage.trim() || !selectedProject || apiStatus === 'offline'}
          className="send-button"
        >
          {isLoading ? 'Sending...' : 'Send'}
        </button>
      </div>
    </div>
  );
};

export default Chat; 