/**
 * ChatTab Component
 * 
 * A simple wrapper component that provides the interface for the AI chat functionality.
 * This tab allows users to interact with an AI assistant that can answer questions
 * about their worldbuilding projects using the uploaded content as context.
 * 
 * Features:
 * - Renders the Chat component with appropriate header
 * - Provides context and instructions for the AI chat feature
 * - Integrates with project selection for context-aware conversations
 */

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