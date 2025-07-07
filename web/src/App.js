import React, { useState } from 'react';
import AuthWrapper from './components/AuthWrapper';
import Homepage from './components/Homepage';
import VSCodeEditor from './components/VSCodeEditor';
import DebugPanel from './components/DebugPanel';
import './App.css';

function App() {
  const [currentView, setCurrentView] = useState('homepage'); // 'homepage' or 'editor'
  const [selectedProject, setSelectedProject] = useState(null);
  const [debugMode, setDebugMode] = useState(false);
  const [debugOutput, setDebugOutput] = useState('');
  const [scoreThreshold, setScoreThreshold] = useState(0.5);

  const handleProjectSelect = (project) => {
    setSelectedProject(project);
    setCurrentView('editor');
  };

  const handleBackToHome = () => {
    setCurrentView('homepage');
    setSelectedProject(null);
  };

  const handleDebugToggle = (action) => {
    if (action === 'toggle') {
      const newDebugMode = !debugMode;
      setDebugMode(newDebugMode);
    } else if (action === 'clear') {
      setDebugOutput('');
    } else if (action && action !== 'toggle') {
      // This is a debug message
      setDebugOutput(prev => prev + (prev ? '\n' : '') + action);
    }
  };

  const handleScoreThresholdChange = (newThreshold) => {
    setScoreThreshold(newThreshold);
  };

  return (
    <AuthWrapper>
      <div className={`App vscode-app ${debugMode ? 'debug-panel-visible' : ''}`}>
        {/* Debug Toggle Button - Always visible */}
        <div className="debug-toggle-container">
          <button 
            className={`debug-toggle-btn ${debugMode ? 'active' : ''}`}
            onClick={() => handleDebugToggle('toggle')}
            title="Toggle debug mode"
          >
            🐛 Debug
          </button>
        </div>

        {currentView === 'homepage' && (
          <Homepage onProjectSelect={handleProjectSelect} />
        )}
        {currentView === 'editor' && (
          <VSCodeEditor 
            project={selectedProject} 
            onBackToHome={handleBackToHome}
            debugMode={debugMode}
            onDebugToggle={handleDebugToggle}
            scoreThreshold={scoreThreshold}
            onScoreThresholdChange={handleScoreThresholdChange}
          />
        )}
        
        {/* Debug Panel - Always available when debug mode is on */}
        <DebugPanel 
          debugOutput={debugOutput}
          isVisible={debugMode}
          onToggle={handleDebugToggle}
          scoreThreshold={scoreThreshold}
          onScoreThresholdChange={handleScoreThresholdChange}
        />
      </div>
    </AuthWrapper>
  );
}

export default App;
