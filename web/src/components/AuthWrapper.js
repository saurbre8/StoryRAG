/**
 * AuthWrapper Component
 * 
 * A higher-order component that handles all authentication logic for the StoryRAG application.
 * This component wraps the entire app and manages user authentication state using AWS Cognito
 * via the react-oidc-context library.
 * 
 * Features:
 * - Handles sign-in/sign-out flow with AWS Cognito
 * - Displays loading states during authentication
 * - Shows error handling for authentication failures
 * - Renders different UI based on authentication state (login screen vs authenticated app)
 * - Automatically cleans up URL parameters after successful authentication
 * - Provides user info display and sign-out functionality
 */

import React from 'react';
import { useAuth } from 'react-oidc-context';
import './AuthWrapper.css';

const AuthWrapper = ({ children }) => {
  const auth = useAuth();

  // Clean up URL parameters after successful authentication
  React.useEffect(() => {
    if (auth.isAuthenticated) {
      const url = new URL(window.location.href);
      if (url.searchParams.has('code') || url.searchParams.has('state')) {
        url.searchParams.delete('code');
        url.searchParams.delete('state');
        url.searchParams.delete('session_state');
        window.history.replaceState({}, document.title, url.pathname);
      }
    }
  }, [auth.isAuthenticated]);

  const handleSignOut = async () => {
    try { 
      // First try to remove the user from the OIDC context
      await auth.removeUser();
      
      // Then manually redirect to the correct Cognito logout endpoint
      const clientId = "64u7vdgfncafvd2ku35084no4d";
      const logoutUri = "http://localhost:3000";
      const cognitoDomain = "https://us-east-13gbn9c4qm.auth.us-east-1.amazoncognito.com";
      
      // Use the correct logout endpoint
      window.location.href = `${cognitoDomain}/logout?client_id=${clientId}&logout_uri=${encodeURIComponent(logoutUri)}`;
      
    } catch (error) {
      console.error('Sign-out error:', error);
      // Force reload as fallback
      window.location.href = 'http://localhost:3000';
    }
  };

  const handleSignIn = async () => {
    try {
      await auth.signinRedirect();
    } catch (error) {
      console.error('Sign-in error:', error);
    }
  };

  const handleRetry = async () => {
    try {
      // Clear any existing auth state
      await auth.removeUser();
      
      // Clear URL parameters
      const url = new URL(window.location.href);
      url.searchParams.delete('code');
      url.searchParams.delete('state');
      url.searchParams.delete('session_state');
      window.history.replaceState({}, document.title, url.pathname);
      
      // Reload page
      window.location.reload();
    } catch (error) {
      console.error('Retry error:', error);
      window.location.reload();
    }
  };

  if (auth.isLoading) {
    return (
      <div className="auth-loading">
        <div className="loading-spinner"></div>
        <h2>Loading StoryRAG...</h2>
        <p>Checking authentication status</p>
      </div>
    );
  }

  if (auth.error) {
    console.error('Auth error details:', auth.error);
    return (
      <div className="auth-error">
        <div className="error-content">
          <h2>Authentication Error</h2>
          <p>We encountered an issue while trying to authenticate you.</p>
          <details>
            <summary>Error Details</summary>
            <pre>{JSON.stringify(auth.error, null, 2)}</pre>
          </details>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '20px' }}>
            <button onClick={handleRetry} className="retry-btn">
              Try Again
            </button>
            <button onClick={() => auth.removeUser()} className="retry-btn">
              Clear Auth State
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (auth.isAuthenticated) {
    return (
      <div className="authenticated-app">
        <header className="app-header-authenticated">
          <div className="header-content">
            <h1>StoryRAG</h1>
            <div className="user-info">
              <span className="user-email">
                Welcome, {auth.user?.profile?.preferred_username || auth.user?.profile?.username || auth.user?.username || 'User'}
              </span>
              <button 
                onClick={handleSignOut} 
                className="sign-out-btn"
              >
                Sign Out
              </button>
            </div>
          </div>
        </header>
        {children}
      </div>
    );
  }

  return (
    <div className="auth-login">
      <div className="login-container">
        <div className="login-header">
          <h1>StoryRAG</h1>
          <p>Secure Markdown File Manager</p>
        </div>
        
        <div className="login-content">
          <h2>Welcome Back</h2>
          <p>Sign in to access your markdown files and manage your documents securely.</p>
          
          <button 
            onClick={handleSignIn}
            className="sign-in-btn"
          >
            Sign In
          </button>
          
          <div className="features">
            <div className="feature">
              <span className="feature-icon">📁</span>
              <span>File Management</span>
            </div>
            <div className="feature">
              <span className="feature-icon">🔒</span>
              <span>Secure Storage</span>
            </div>
            <div className="feature">
              <span className="feature-icon">📝</span>
              <span>Markdown Support</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthWrapper; 