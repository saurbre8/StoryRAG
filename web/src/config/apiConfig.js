/**
 * API Configuration
 * 
 * Features:
 * - Environment variable support for flexible deployment
 * - Default fallback values for local development
 * - URL validation and formatting utilities
 * - Configurable timeouts and health check intervals
 * - Support for both HTTP and HTTPS endpoints
 * 
 * Environment Variables:
 * - REACT_APP_CHAT_API_URL: Backend API server URL
 * - REACT_APP_API_TIMEOUT: Request timeout in milliseconds
 * - REACT_APP_HEALTH_CHECK_INTERVAL: How often to check API health
 * 
 * Usage:
 * - Import in services to get consistent API configuration
 * - Use formatApiUrl() to ensure proper URL formatting
 * - Modify defaults here for different deployment environments
 */

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

/**
 * Helper function to validate and format API URL
 * Ensures URLs are properly formatted with protocol and no trailing slash
 * 
 * @param {string} url - Raw URL input
 * @returns {string|null} - Formatted URL or null if invalid
 */
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