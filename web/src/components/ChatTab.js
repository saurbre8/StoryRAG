import React from 'react';
import Chat from './Chat';

const ChatTab = () => {
  return (
    <div className="chat-tab">
      <div className="tab-header">
        <h3>Chat with AI Assistant</h3>
        <p>Ask questions about your worldbuilding projects and get AI-powered insights</p>
      </div>
      
      <Chat />
    </div>
  );
};

export default ChatTab; 