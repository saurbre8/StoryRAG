import React, { useState } from 'react';
import AuthWrapper from './components/AuthWrapper';
import CreateTab from './components/CreateTab';
import ChatTab from './components/ChatTab';
import EditTab from './components/EditTab';
import './App.css';

function App() {
  const [activeTab, setActiveTab] = useState('create');

  return (
    <AuthWrapper>
      <div className="App">
        <main className="App-main">
          <div className="app-content">
            <div className="intro-section">
              <h2>StoryRAG Project Hub</h2>
              <p>Create projects, chat with AI, and manage your worldbuilding files</p>
              
              <div className="tab-navigation">
                <button 
                  className={activeTab === 'create' ? 'active' : ''}
                  onClick={() => setActiveTab('create')}
                >
                  📁 Create
                </button>
                <button 
                  className={activeTab === 'chat' ? 'active' : ''}
                  onClick={() => setActiveTab('chat')}
                >
                  💬 Chat
                </button>
                <button 
                  className={activeTab === 'edit' ? 'active' : ''}
                  onClick={() => setActiveTab('edit')}
                >
                  ✏️ Edit
                </button>
              </div>
            </div>
            
            {activeTab === 'create' && <CreateTab />}
            {activeTab === 'chat' && <ChatTab />}
            {activeTab === 'edit' && <EditTab />}
          </div>
        </main>
      </div>
    </AuthWrapper>
  );
}

export default App;
