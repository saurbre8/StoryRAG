import React, { useState, useEffect } from 'react';
import './SystemPromptEditor.css';

const defaultPrompt = `You are a creative worldbuilding assistant for writers.
Here is some relevant context to help you answer:
{context_str}

Below is the conversation so far:
{chat_history}

Use that context when answering the user. Be consistent and engaging. Keep to concise answers unless asked for longer text.`;

const SystemPromptEditor = ({ systemPrompt, onSystemPromptChange, isInChatPanel = false }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [localPrompt, setLocalPrompt] = useState('');

  // Initialize localPrompt when component mounts or systemPrompt changes
  useEffect(() => {
    setLocalPrompt(systemPrompt || defaultPrompt);
  }, [systemPrompt]);

  const handleTextChange = (e) => {
    setLocalPrompt(e.target.value);
  };

  const handleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  const handleSave = () => {
    onSystemPromptChange(localPrompt);
    setIsExpanded(false);
  };

  const handleReset = () => {
    setLocalPrompt(defaultPrompt);
    onSystemPromptChange(defaultPrompt);
  };

  const handleCancel = () => {
    setLocalPrompt(systemPrompt || defaultPrompt);
    setIsExpanded(false);
  };

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
              rows="4"
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #3e3e42',
                borderRadius: '4px',
                fontFamily: 'Monaco, Menlo, Ubuntu Mono, monospace',
                fontSize: '12px',
                lineHeight: '1.3',
                resize: 'vertical',
                minHeight: '80px',
                maxHeight: '120px',
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
          <textarea
            value={localPrompt}
            onChange={handleTextChange}
            placeholder="Enter your custom system prompt..."
            rows="8"
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
          <div className="prompt-help">
            <p><strong>Available placeholders:</strong></p>
            <ul>
              <li><code>{'{context_str}'}</code> - Retrieved context from your documents</li>
              <li><code>{'{chat_history}'}</code> - Previous conversation messages</li>
              <li><code>{'{query_str}'}</code> - Current user question</li>
            </ul>
          </div>
        </div>
      ) : (
        <div className="prompt-preview">
          <p className="prompt-text">
            {systemPrompt || defaultPrompt}
          </p>
        </div>
      )}
    </div>
  );
};

export default SystemPromptEditor; 