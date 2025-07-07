/**
 * Chat Component with On-Demand Embedding
 * 
 * The main AI chat interface that allows users to have conversations with an AI assistant about their worldbuilding projects. The AI uses the uploaded project files as context to provide relevant and informed responses about characters, locations, plot elements, etc.
 * 
 * Features:
 * - Real-time chat interface with message history
 * - Context-aware conversations using the current project
 * - API health monitoring and connection status
 * - Message sending with loading states and error handling
 * - Auto-scrolling chat messages
 * - Integration with backend chat API service
 * - Retry mechanisms for connection issues
 * - Debug mode toggle for development and troubleshooting
 */

import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from 'react-oidc-context';
import ProjectManager from './ProjectManager';
import chatApiService from '../services/chatApiService';
import embedService from '../services/embedService';
import SystemPromptEditor from './SystemPromptEditor';
import './Chat.css';

const Chat = ({ 
  project = null, 
  onDebugToggle, 
  debugMode = false, 
  scoreThreshold = 0.5,
  onScoreThresholdChange,
  systemPrompt: initialSystemPrompt = null,
  onSystemPromptChange
  }) => {
  // Remove redundant local systemPrompt state - use prop directly
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isEmbedding, setIsEmbedding] = useState(false);
  const [apiStatus, setApiStatus] = useState('unknown');
  const [connectionError, setConnectionError] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [embeddingStatus, setEmbeddingStatus] = useState({});
  const messagesEndRef = useRef(null);
  const auth = useAuth();

  // For standalone usage (when no project prop is provided)
  const [selectedProject, setSelectedProject] = useState(null);
  const currentProject = project || selectedProject;

  // Use the prop value directly
  const systemPrompt = initialSystemPrompt || '';

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

  // Initialize session ID on component mount only
  useEffect(() => {
    if (!sessionId) {
      const newSessionId = generateSessionId();
      setSessionId(newSessionId);
      //console.log('Generated initial session ID:', newSessionId);
    }
  }, []); // Empty dependency array - only run once on mount

  // Generate new session when project changes (for prop-based usage)
  useEffect(() => {
    if (project && !sessionId) {
      const newSessionId = generateSessionId();
      setSessionId(newSessionId);
      setMessages([]);
      //console.log('Project changed, generated new session ID:', newSessionId);
    }
  }, [project]); // Only depend on project, not sessionId

  const handleProjectSelect = (selectedProj) => {
    setSelectedProject(selectedProj);
    // Clear messages and generate new session when switching projects
    setMessages([]);
    const newSessionId = generateSessionId();
    setSessionId(newSessionId);
    //console.log('Selected project for chat:', selectedProj);
    //console.log('Generated new session ID for project:', newSessionId);
  };

  const checkAndEmbedProject = async (userId, projectName) => {
    // Check if we've already embedded this project in this session
    const embeddingKey = `${userId}_${projectName}`;
    
    if (embeddingStatus[embeddingKey] === 'completed') {
      //console.log(`Project ${projectName} already embedded in this session`);
      return { success: true, wasAlreadyEmbedded: true };
    }

    if (embeddingStatus[embeddingKey] === 'in_progress') {
      //console.log(`Project ${projectName} is currently being embedded`);
      return { success: false, message: 'Embedding already in progress' };
    }

    try {
      setIsEmbedding(true);
      setEmbeddingStatus(prev => ({ ...prev, [embeddingKey]: 'in_progress' }));
      
      // Add a system message to show embedding is happening
      setMessages(prev => [...prev, { 
        type: 'system', 
        content: `🧠 Preparing your project files for chat... This may take a moment.` 
      }]);

      //console.log(`Starting embedding for project: ${projectName}`);
      const embedResult = await embedService.embedProjectSafely(userId, projectName);
      
      if (embedResult.success) {
        setEmbeddingStatus(prev => ({ ...prev, [embeddingKey]: 'completed' }));
        
        // Update the system message to show success
        setMessages(prev => {
          const newMessages = [...prev];
          const lastMessage = newMessages[newMessages.length - 1];
          if (lastMessage && lastMessage.type === 'system') {
            lastMessage.content = `✅ Project files ready for chat!`;
          }
          return newMessages;
        });
        
        return { success: true, message: embedResult.message };
      } else {
        setEmbeddingStatus(prev => ({ ...prev, [embeddingKey]: 'failed' }));
        
        // Update system message to show error
        setMessages(prev => {
          const newMessages = [...prev];
          const lastMessage = newMessages[newMessages.length - 1];
          if (lastMessage && lastMessage.type === 'system') {
            lastMessage.content = `⚠️ Couldn't prepare files for chat: ${embedResult.message}. Chat may not have full context.`;
          }
          return newMessages;
        });
        
        return { success: false, message: embedResult.message };
      }
    } catch (error) {
      console.error('Embedding failed:', error);
      setEmbeddingStatus(prev => ({ ...prev, [embeddingKey]: 'failed' }));
      
      setMessages(prev => {
        const newMessages = [...prev];
        const lastMessage = newMessages[newMessages.length - 1];
        if (lastMessage && lastMessage.type === 'system') {
          lastMessage.content = `❌ Failed to prepare files: ${error.message}. Chat will continue without full context.`;
        }
        return newMessages;
      });
      
      return { success: false, message: error.message };
    } finally {
      setIsEmbedding(false);
    }
  };

  const sendMessage = async () => {
    //console.log('sendMessage called with inputMessage:', inputMessage);
    
    if (!inputMessage.trim()) {
      //console.log('sendMessage: empty message, returning');
      return;
    }
    
    if (!currentProject) {
      //console.log('sendMessage: no currentProject, alerting');
      alert('Please select a project before chatting.');
      return;
    }

    if (apiStatus === 'offline') {
      //console.log('sendMessage: API offline, alerting');
      alert('Chat API is currently offline. Please try again later.');
      return;
    }

    if (!sessionId) {
      //console.log('sendMessage: no sessionId, alerting');
      alert('Session not initialized. Please refresh the page.');
      return;
    }

    const userMessage = inputMessage;
    //console.log('sendMessage: setting inputMessage to empty');
    setInputMessage('');
    setIsLoading(true);
    setConnectionError(null);

    // Add user message to chat
    //console.log('sendMessage: adding user message to state');
    setMessages(prev => {
      const newMessages = [...prev, { type: 'user', content: userMessage }];
      //console.log('Added user message:', userMessage, 'Total messages:', newMessages.length);
      return newMessages;
    });

    try {
      const userId = auth.user?.profile?.sub || auth.user?.profile?.username;
      
      // Check and embed project if needed BEFORE sending the chat message
      await checkAndEmbedProject(userId, currentProject.name);
      
      // Continue with chat regardless of embedding result
      const data = await chatApiService.sendMessage({
        message: userMessage,
        userId: userId,
        projectName: currentProject.name,
        sessionId: sessionId,
        system_prompt: systemPrompt,
        debug: debugMode, // Pass debug mode to API
        score_threshold: scoreThreshold, // Pass score threshold to API
      });

      /* 
      console.log('API Response received:', data);
      console.log('Response text:', data.response);
      console.log('Answer field:', data.answer);
      console.log('Debug output field:', data.debug_output);
      console.log('Full response object keys:', Object.keys(data));
      */

      // Handle different possible response formats
      let responseText = '';
      if (data.response) {
        responseText = data.response;
      } else if (data.answer) {
        responseText = data.answer;
      } else if (typeof data === 'string') {
        responseText = data;
      } else {
        responseText = 'Received response but could not parse content.';
      }

      /* 
      console.log('Final response text to display:', responseText);
      console.log('Response text type:', typeof responseText);
      console.log('Response text length:', responseText.length);
      */
      
      // Add assistant response to chat
      setMessages(prev => {
        const newMessages = [...prev, { type: 'assistant', content: responseText }];
        //console.log('Updated messages:', newMessages);
        return newMessages;
      });
      
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

  // Reset embedding status when project changes
  useEffect(() => {
    if (currentProject) {
      const userId = auth.user?.profile?.sub || auth.user?.profile?.username;
      const embeddingKey = `${userId}_${currentProject.name}`;
      
      /* If we don't have embedding status for this project, it needs to be checked
      if (!embeddingStatus[embeddingKey]) {
        console.log(`New project ${currentProject.name} - will check embedding on first chat`);
      }
      */
    }
  }, [currentProject, auth.user, embeddingStatus]);

  // Add a function to start a new conversation
  const startNewConversation = () => {
    const newSessionId = generateSessionId();
    setSessionId(newSessionId);
    setMessages([]);
    // Notify parent to clear debug output
    onDebugToggle?.('clear');
    //console.log('Started new conversation with session ID:', newSessionId);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="chat-container">
      {/* Only show ProjectManager if no project prop is provided */}
      {!project && (
        <ProjectManager 
          selectedProject={selectedProject}
          onProjectSelect={handleProjectSelect}
        />
      )}
      
      <div className="chat-header">
        <h3>AI Worldbuilding Assistant</h3>
        <div className="status-indicators">
          <div className="api-status">
            <span className={`status-indicator ${apiStatus}`}>
              {apiStatus === 'online' && '🟢 Connected'}
              {apiStatus === 'offline' && '🔴 Offline'}
              {apiStatus === 'unknown' && '🟡 Checking...'}
            </span>
          </div>
          
          {isEmbedding && (
            <div className="embedding-status">
              <span className="status-indicator embedding">
                🧠 Preparing files...
              </span>
            </div>
          )}
        </div>
        {currentProject ? (
          <div>
            <p>Chatting about: <strong>{currentProject.name}</strong></p>
            <div className="session-controls">
              <span className="session-info">Session: {sessionId?.substring(8, 16)}...</span>
              <button className="new-conversation-btn" onClick={startNewConversation}>
                New Conversation
              </button>
            </div>
          </div>
        ) : (
          <div>
            <p>Select a project above to start chatting</p>
          </div>
        )}
      </div>

      {/* System Prompt Editor - now uses prop directly */}
      {currentProject && (
        <div className="system-prompt-section">
          <SystemPromptEditor 
            systemPrompt={systemPrompt}
            onSystemPromptChange={onSystemPromptChange}
            isInChatPanel={!!project}
          />
        </div>
      )}

      {connectionError && (
        <div className="connection-error">
          <span>⚠️ {connectionError}</span>
        </div>
      )}
      
      <div className="chat-messages">
        {messages.length === 0 ? (
          <div style={{ padding: '1rem', color: '#858585', textAlign: 'center' }}>
            No messages yet. Send a message to start chatting!
          </div>
        ) : (
          messages.map((message, index) => {
            return (
              <div key={index} className={`message ${message.type}`}>
                {message.type === 'user' && (
                  <div className="message-content user-message">
                    <strong>You:</strong> {message.content}
                  </div>
                )}
                {message.type === 'assistant' && (
                  <div className="message-content assistant-message">
                    <strong>Assistant:</strong> {message.content}
                  </div>
                )}
                {message.type === 'system' && (
                  <div className="message-content system-message">
                    {message.content}
                  </div>
                )}
                {message.type === 'error' && (
                  <div className="message-content error-message">
                    {message.content}
                  </div>
                )}
              </div>
            );
          })
        )}
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
          onKeyDown={handleKeyPress}
          placeholder={
            !currentProject 
              ? "Select a project to start chatting..." 
              : isEmbedding 
                ? "Preparing files for chat..."
                : "Ask about your worldbuilding project..."
          }
          disabled={isLoading || isEmbedding || !currentProject || apiStatus === 'offline'}
          rows="3"
        />
        <button 
          onClick={() => {
            sendMessage();
          }}
          disabled={isLoading || isEmbedding || !inputMessage.trim() || !currentProject || apiStatus === 'offline'}
          className={`send-btn ${(isLoading || isEmbedding) ? 'loading' : ''}`}
        >
          {isEmbedding ? '🧠' : isLoading ? '⏳' : '🚀'} 
          {isEmbedding ? 'Preparing...' : isLoading ? 'Thinking...' : 'Send'}
        </button>
      </div>
    </div>
  );
};

export default Chat; 