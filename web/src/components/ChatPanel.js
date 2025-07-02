import React from 'react';
import Chat from './Chat';
import './ChatPanel.css';

const ChatPanel = ({ project, onClose, debugMode = false, onDebugToggle }) => {
  return (
    <div className="chat-panel">
      <div className="chat-header">
        <div className="chat-title">
          <span className="chat-icon">🤖</span>
          AI Assistant
        </div>
        <div className="chat-header-controls">
          <button className="close-chat" onClick={onClose}>
            ×
          </button>
        </div>
      </div>
      
      <div className="chat-content">
        <div className="chat-info">
          <p>Ask questions about your <strong>{project.name}</strong> project</p>
        </div>
        <Chat 
          project={project} 
          debugMode={debugMode}
          onDebugToggle={onDebugToggle}
        />
      </div>
    </div>
  );
};

export default ChatPanel; 