import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from 'react-oidc-context';
import ProjectManager from './ProjectManager';
import './Chat.css';

const Chat = () => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState('');
  const [selectedProject, setSelectedProject] = useState(null);
  const messagesEndRef = useRef(null);
  const auth = useAuth();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleProjectSelect = (project) => {
    setSelectedProject(project);
    // Clear messages when switching projects
    setMessages([]);
    setSessionId('');
    console.log('Selected project for chat:', project);
  };

  const sendMessage = async () => {
    if (!inputMessage.trim()) return;
    
    if (!selectedProject) {
      alert('Please select a project before chatting.');
      return;
    }

    const userMessage = inputMessage;
    setInputMessage('');
    setIsLoading(true);

    // Add user message to chat
    setMessages(prev => [...prev, { type: 'user', content: userMessage }]);

    try {
      const userId = auth.user?.profile?.sub || auth.user?.profile?.username;
      
      const response = await fetch('http://localhost:8000/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session_id: sessionId,
          message: userMessage,
          user_id: userId,
          project_folder: selectedProject.name  // Pass the selected project
        })
      });

      const data = await response.json();
      
      // Update session ID if it's new
      if (!sessionId) {
        setSessionId(data.session_id);
      }

      // Add assistant response to chat
      setMessages(prev => [...prev, { type: 'assistant', content: data.response }]);
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => [...prev, { 
        type: 'error', 
        content: 'Sorry, I encountered an error. Please try again.' 
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

  return (
    <div className="chat-container">
      <ProjectManager 
        selectedProject={selectedProject}
        onProjectSelect={handleProjectSelect}
      />
      
      <div className="chat-header">
        <h3>AI Worldbuilding Assistant</h3>
        {selectedProject ? (
          <p>Chatting about: <strong>{selectedProject.name}</strong></p>
        ) : (
          <p>Select a project above to start chatting</p>
        )}
      </div>
      
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
          placeholder={selectedProject ? `Ask about ${selectedProject.name}...` : "Select a project first..."}
          disabled={isLoading || !selectedProject}
          rows={3}
        />
        <button 
          onClick={sendMessage} 
          disabled={isLoading || !inputMessage.trim() || !selectedProject}
          className="send-button"
        >
          Send
        </button>
      </div>
    </div>
  );
};

export default Chat; 