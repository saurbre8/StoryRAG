import React, { useState, useEffect } from 'react';
import './ScoreThresholdEditor.css';

const ScoreThresholdEditor = ({ scoreThreshold, onScoreThresholdChange, isInChatPanel = false }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [localThreshold, setLocalThreshold] = useState(0.5);

  // Initialize localThreshold when component mounts or scoreThreshold changes
  useEffect(() => {
    setLocalThreshold(scoreThreshold || 0.5);
  }, [scoreThreshold]);

  const handleInputChange = (e) => {
    const value = parseFloat(e.target.value) || 0.5;
    setLocalThreshold(value);
  };

  const handleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  const handleSave = () => {
    onScoreThresholdChange(localThreshold);
    setIsExpanded(false);
  };

  const handleReset = () => {
    setLocalThreshold(0.5);
    onScoreThresholdChange(0.5);
  };

  const handleCancel = () => {
    setLocalThreshold(scoreThreshold || 0.5);
    setIsExpanded(false);
  };

  const getThresholdDescription = (threshold) => {
    if (threshold <= 0.3) return "Very loose - includes many documents";
    if (threshold <= 0.5) return "Balanced - moderate relevance";
    if (threshold <= 0.7) return "Strict - high relevance only";
    return "Very strict - only highly relevant documents";
  };

  // Compact version for chat panel
  if (isInChatPanel) {
    return (
      <div className={`score-threshold-editor chat-panel-version ${isExpanded ? 'expanded' : 'collapsed'}`}>
        <button 
          className="score-threshold-toggle"
          onClick={handleExpand}
          title={isExpanded ? "Collapse score threshold" : "Expand score threshold"}
        >
          <span>Score Threshold 🎯</span>
          <span>Threshold: {localThreshold.toFixed(2)}</span>
          <span>{isExpanded ? '▼' : '▶'}</span>
        </button>
        
        {isExpanded && (
          <div className="threshold-editor-compact">
            <div className="threshold-input-container">
              <label htmlFor="threshold-input" className="threshold-label">
                Minimum Similarity Score: {localThreshold.toFixed(2)}
              </label>
              <input
                id="threshold-input"
                type="number"
                min="0.0"
                max="1.0"
                step="0.05"
                value={localThreshold}
                onChange={handleInputChange}
                className="threshold-input"
              />
              <div className="threshold-description">
                {getThresholdDescription(localThreshold)}
              </div>
            </div>
            <div className="threshold-controls-compact">
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
    <div className="score-threshold-editor">
      <div className="threshold-header">
        <h4>Score Threshold</h4>
        <button 
          className="expand-btn"
          onClick={handleExpand}
        >
          {isExpanded ? 'Collapse' : 'Edit'}
        </button>
      </div>
      
      {isExpanded ? (
        <div className="threshold-editor">
          <div className="threshold-input-container">
            <label htmlFor="threshold-input-full" className="threshold-label">
              Minimum Similarity Score: {localThreshold.toFixed(2)}
            </label>
            <input
              id="threshold-input-full"
              type="number"
              min="0.0"
              max="1.0"
              step="0.05"
              value={localThreshold}
              onChange={handleInputChange}
              className="threshold-input"
            />
            <div className="threshold-description">
              {getThresholdDescription(localThreshold)}
            </div>
          </div>
          <div className="threshold-controls">
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
          <div className="threshold-help">
            <p><strong>How it works:</strong></p>
            <ul>
              <li><strong>Lower values (0.0-0.3):</strong> Include more documents, may be less relevant</li>
              <li><strong>Medium values (0.4-0.6):</strong> Balanced approach, moderate relevance</li>
              <li><strong>Higher values (0.7-1.0):</strong> Only highly relevant documents</li>
            </ul>
          </div>
        </div>
      ) : (
        <div className="threshold-preview">
          <p className="threshold-text">
            Current threshold: <strong>{localThreshold.toFixed(2)}</strong> - {getThresholdDescription(localThreshold)}
          </p>
        </div>
      )}
    </div>
  );
};

export default ScoreThresholdEditor; 