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
      if (!debugMode) {
        setDebugOutput('Debug mode enabled. Send a message to see debug output.\n');
      }
    } else if (action === 'clear') {
      setDebugOutput('');
    } else if (action && action !== 'toggle') {
      // This is a debug message
      setDebugOutput(prev => prev + (prev ? '\n' : '') + action);
    }
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
          />
        )}
        
        {/* Debug Panel - Always available when debug mode is on */}
        <DebugPanel 
          debugOutput={debugOutput}
          isVisible={debugMode}
          onToggle={handleDebugToggle}
        />
      </div>
    </AuthWrapper>
  );
}

export default App;
