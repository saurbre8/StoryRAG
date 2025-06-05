// API Configuration
const getApiConfig = () => {
  // You can set these as environment variables in your deployment
  const config = {
    // Default to localhost for development
    chatApiUrl: process.env.REACT_APP_CHAT_API_URL || 'http://localhost:8000',
    
    // Request timeout in milliseconds
    requestTimeout: parseInt(process.env.REACT_APP_API_TIMEOUT) || 30000,
    
    // Health check interval in milliseconds
    healthCheckInterval: parseInt(process.env.REACT_APP_HEALTH_CHECK_INTERVAL) || 60000,
  };

  return config;
};

// Helper function to validate and format API URL
export const formatApiUrl = (url) => {
  if (!url) return null;
  
  // Remove trailing slash
  const cleanUrl = url.replace(/\/$/, '');
  
  // Add protocol if missing
  if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
    return `https://${cleanUrl}`;
  }
  
  return cleanUrl;
};

export default getApiConfig; 