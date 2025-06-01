import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AuthProvider } from 'react-oidc-context';

const cognitoAuthConfig = {
  authority: 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_3GBn9c4Qm',
  client_id: '64u7vdgfncafvd2ku35084no4d',
  redirect_uri: "http://localhost:3000",
  response_type: 'code',
  scope: 'phone openid email',
  post_logout_redirect_uri: 'http://localhost:3000',
  automaticSilentRenew: true,
  loadUserInfo: true,
};

const root = ReactDOM.createRoot(document.getElementById('root'));

root.render(
  <React.StrictMode>
    <AuthProvider {...cognitoAuthConfig}>
      <App />
    </AuthProvider>
  </React.StrictMode>
);
