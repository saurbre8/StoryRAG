import React, { useState, useRef, useEffect } from 'react';
import ScoreThresholdEditor from './ScoreThresholdEditor';
import './DebugPanel.css';

const DebugPanel = ({ 
  debugOutput = '', 
  isVisible = false, 
  onToggle, 
  scoreThreshold = 0.5, 
  onScoreThresholdChange 
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [output, setOutput] = useState('');
  const outputRef = useRef(null);

  // Update output when debugOutput prop changes
  useEffect(() => {
    if (debugOutput === 'clear') {
      setOutput('');
    } else if (debugOutput && debugOutput !== 'toggle') {
      setOutput(prev => prev + (prev ? '\n' : '') + debugOutput);
    }
  }, [debugOutput]);

  // Auto-scroll to bottom when new output is added
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output]);

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  const clearOutput = () => {
    setOutput('');
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div className={`debug-panel ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="debug-panel-header">
        <div className="debug-panel-title">
          <span className="debug-icon">🐛</span>
          <span>Debug Output</span>
        </div>
        <div className="debug-panel-controls">
          {/* Score Threshold Input */}
          <div className="score-threshold-input-container">
            <label htmlFor="score-threshold-input" className="score-threshold-label">
              🎯 Document Score Threshold:
            </label>
            <input
              id="score-threshold-input"
              type="number"
              min="0.0"
              max="1.0"
              step="0.05"
              value={scoreThreshold}
              onChange={(e) => onScoreThresholdChange?.(parseFloat(e.target.value) || 0.5)}
              className="score-threshold-input"
              title="Document score threshold (0.0-1.0)"
            />
          </div>
          <button 
            className="debug-panel-btn clear-btn"
            onClick={clearOutput}
            title="Clear output"
          >
            🗑️
          </button>
          <button 
            className="debug-panel-btn toggle-btn"
            onClick={toggleCollapse}
            title={isCollapsed ? "Expand" : "Collapse"}
          >
            {isCollapsed ? '⬆️' : '⬇️'}
          </button>
          <button 
            className="debug-panel-btn close-btn"
            onClick={() => onToggle?.('toggle')}
            title="Close debug panel"
          >
            ✕
          </button>
        </div>
      </div>
      
      {!isCollapsed && (
        <div className="debug-panel-content">
          {/* Debug Output */}
          <div className="debug-output" ref={outputRef}>
            {output ? (
              <pre>{output}</pre>
            ) : (
              <div className="debug-placeholder">
                Debug mode enabled. Send a message to see debug output.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DebugPanel;