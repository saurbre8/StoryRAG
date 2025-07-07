import React, { useState, useEffect } from 'react';
import './SystemPromptEditor.css';

const defaultPrompt = `You are a creative worldbuilding assistant for writers.

Use that context when answering the user. Be consistent and engaging. Keep to concise answers unless asked for longer text.`;

// This will always be appended to the user's custom prompt
const systemSuffix = `

Here is some relevant context to help you answer:
{context_str}

Below is the conversation so far:
{chat_history}`;

const SystemPromptEditor = ({ systemPrompt, onSystemPromptChange, isInChatPanel = false }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [localPrompt, setLocalPrompt] = useState('');

  // Extract the user's custom part from the full system prompt
  const extractUserPrompt = (fullPrompt) => {
    if (!fullPrompt) return defaultPrompt;
    
    // Remove the system suffix if it exists
    const suffixIndex = fullPrompt.indexOf(systemSuffix);
    if (suffixIndex !== -1) {
      return fullPrompt.substring(0, suffixIndex).trim();
    }
    
    return fullPrompt;
  };

  // Initialize localPrompt when component mounts or systemPrompt changes
  useEffect(() => {
    setLocalPrompt(extractUserPrompt(systemPrompt) || defaultPrompt);
  }, [systemPrompt]);

  const handleTextChange = (e) => {
    setLocalPrompt(e.target.value);
  };

  const handleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  const handleSave = () => {
    // Combine user prompt with system suffix before saving
    const fullPrompt = localPrompt.trim() + systemSuffix;
    onSystemPromptChange(fullPrompt);
    setIsExpanded(false);
  };

  const handleReset = () => {
    setLocalPrompt(defaultPrompt);
    const fullPrompt = defaultPrompt + systemSuffix;
    onSystemPromptChange(fullPrompt);
  };

  const handleCancel = () => {
    setLocalPrompt(extractUserPrompt(systemPrompt) || defaultPrompt);
    setIsExpanded(false);
  };

  // Get the display prompt (user part only)
  const displayPrompt = extractUserPrompt(systemPrompt) || defaultPrompt;

  // Compact version for chat panel
  if (isInChatPanel) {
    return (
      <div className={`system-prompt-editor chat-panel-version ${isExpanded ? 'expanded' : 'collapsed'}`}>
        <button 
          className="system-prompt-toggle"
          onClick={handleExpand}
          title={isExpanded ? "Collapse system prompt" : "Expand system prompt"}
        >
          <span>⚙️</span>
          <span>System Prompt</span>
          <span>{isExpanded ? '▼' : '▶'}</span>
        </button>
        
        {isExpanded && (
          <div className="prompt-editor-compact">
            <textarea
              value={localPrompt}
              onChange={handleTextChange}
              placeholder="Enter your custom system prompt..."
              rows="16"
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #3e3e42',
                borderRadius: '4px',
                fontFamily: 'Monaco, Menlo, Ubuntu Mono, monospace',
                fontSize: '13px',
                lineHeight: '1.4',
                resize: 'vertical',
                minHeight: '320px',
                maxHeight: '500px',
                background: '#1e1e1e',
                color: '#e6e6e6'
              }}
            />
            <div className="prompt-controls-compact">
              <button onClick={handleSave} className="save-btn-compact">
                Save
              </button>
              <button onClick={handleReset} className="reset-btn-compact">
                Reset
              </button>
              <button onClick={handleCancel} className="cancel-btn-compact">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Full version for standalone use
  return (
    <div className="system-prompt-editor">
      <div className="prompt-header">
        <h4>System Prompt</h4>
        <button 
          className="expand-btn"
          onClick={handleExpand}
        >
          {isExpanded ? 'Collapse' : 'Edit'}
        </button>
      </div>
      
      {isExpanded ? (
        <div className="prompt-editor">
          <div className="prompt-info">
            <p><strong>Custom Instructions:</strong></p>
            <p className="help-text">Write your custom instructions below. Context and chat history will be automatically added.</p>
          </div>
          <textarea
            value={localPrompt}
            onChange={handleTextChange}
            placeholder="Enter your custom system prompt..."
            rows="6"
            style={{
              width: '100%',
              padding: '12px',
              border: '1px solid #3e3e42',
              borderRadius: '4px',
              fontFamily: 'Monaco, Menlo, Ubuntu Mono, monospace',
              fontSize: '14px',
              lineHeight: '1.4',
              resize: 'vertical',
              minHeight: '120px',
              background: '#1e1e1e',
              color: '#e6e6e6'
            }}
          />
          <div className="auto-appended">
            <p><strong>Automatically appended:</strong></p>
            <pre style={{
              fontSize: '12px',
              color: '#888',
              background: '#2a2a2a',
              padding: '8px',
              borderRadius: '4px',
              margin: '8px 0'
            }}>{systemSuffix}</pre>
          </div>
          <div className="prompt-controls">
            <button onClick={handleSave} className="save-btn">
              Save
            </button>
            <button onClick={handleReset} className="reset-btn">
              Reset to Default
            </button>
            <button onClick={handleCancel} className="cancel-btn">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="prompt-preview">
          <p className="prompt-text">
            {displayPrompt}
          </p>
          <p className="auto-suffix-note" style={{ fontSize: '0.85em', color: '#888', fontStyle: 'italic' }}>
            + context and chat history automatically added
          </p>
        </div>
      )}
    </div>
  );
};

export default SystemPromptEditor; 