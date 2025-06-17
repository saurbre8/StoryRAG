import React from 'react';
import Chat from './Chat';
import './ChatPanel.css';

const ChatPanel = ({ project, onClose }) => {
  return (
    <div className="chat-panel">
      <div className="chat-header">
        <div className="chat-title">
          <span className="chat-icon">🤖</span>
          AI Assistant
        </div>
        <button className="close-chat" onClick={onClose}>
          ×
        </button>
      </div>
      
      <div className="chat-content">
        <div className="chat-info">
          <p>Ask questions about your <strong>{project.name}</strong> project</p>
        </div>
        <Chat project={project} />
      </div>
    </div>
  );
};

export default ChatPanel; 