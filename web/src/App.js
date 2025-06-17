import React, { useState } from 'react';
import AuthWrapper from './components/AuthWrapper';
import Homepage from './components/Homepage';
import VSCodeEditor from './components/VSCodeEditor';
import './App.css';

function App() {
  const [currentView, setCurrentView] = useState('homepage'); // 'homepage' or 'editor'
  const [selectedProject, setSelectedProject] = useState(null);

  const handleProjectSelect = (project) => {
    setSelectedProject(project);
    setCurrentView('editor');
  };

  const handleBackToHome = () => {
    setCurrentView('homepage');
    setSelectedProject(null);
  };

  return (
    <AuthWrapper>
      <div className="App vscode-app">
        {currentView === 'homepage' && (
          <Homepage onProjectSelect={handleProjectSelect} />
        )}
        {currentView === 'editor' && (
          <VSCodeEditor 
            project={selectedProject} 
            onBackToHome={handleBackToHome}
          />
        )}
      </div>
    </AuthWrapper>
  );
}

export default App;
