/**
 * Chat Component
 * 
 * The main AI chat interface that allows users to have conversations with an AI assistant about their worldbuilding projects. The AI uses the uploaded project files as context to provide relevant and informed responses about characters, locations, plot elements, etc.
 * 
 * Features:
 * - Real-time chat interface with message history
 * - Project selection for context-aware conversations
 * - API health monitoring and connection status
 * - Message sending with loading states and error handling
 * - Auto-scrolling chat messages
 * - Integration with backend chat API service
 * - Retry mechanisms for connection issues
 */

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
  const [sessionId, setSessionId] = useState(null);
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

  // Generate a new session ID when component mounts or project changes
  const generateSessionId = () => {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    return `session_${timestamp}_${random}`;
  };

  // Initialize session ID on component mount
  useEffect(() => {
    if (!sessionId) {
      const newSessionId = generateSessionId();
      setSessionId(newSessionId);
      console.log('Generated new session ID:', newSessionId);
    }
  }, [sessionId]);

  const handleProjectSelect = (project) => {
    setSelectedProject(project);
    // Clear messages and generate new session when switching projects
    setMessages([]);
    const newSessionId = generateSessionId();
    setSessionId(newSessionId);
    console.log('Selected project for chat:', project);
    console.log('Generated new session ID for project:', newSessionId);
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

    if (!sessionId) {
      console.error('No session ID available');
      alert('Session not initialized. Please refresh the page.');
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
        projectName: selectedProject.name,
        sessionId: sessionId
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

  // Add a function to start a new conversation
  const startNewConversation = () => {
    const newSessionId = generateSessionId();
    setSessionId(newSessionId);
    setMessages([]);
    console.log('Started new conversation with session ID:', newSessionId);
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
          <div>
            <p>Chatting about: <strong>{selectedProject.name}</strong></p>
            <div className="session-controls">
              <span className="session-info">Session: {sessionId?.substring(8, 16)}...</span>
              <button className="new-conversation-btn" onClick={startNewConversation}>
                New Conversation
              </button>
            </div>
          </div>
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