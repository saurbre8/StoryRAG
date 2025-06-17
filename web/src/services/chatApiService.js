/**
 * Chat API Service
 * 
 * Features:
 * - Sends user messages to the AI bot with project context
 * - Handles API health monitoring and connection status
 * - Manages request timeouts and error handling
 * - Formats requests with user ID, project context, session ID, and questions
 * - Normalizes bot responses for frontend consumption
 * - Provides fallback mechanisms for connection issues
 * - Configurable API endpoint via environment variables
 * 
 * API Endpoints:
 * - POST /chat - Send messages to the AI bot
 * - GET /health - Check if the bot server is online
 * - GET /info - Get API configuration information
 */
class ChatApiService {
  constructor() {
    // Use the EC2 instance URL as default
    this.baseUrl = process.env.REACT_APP_CHAT_API_URL || 'http://54.226.223.245:8000';
    this.timeout = 30000; // 30 seconds timeout
  }

  /**
   * Send a chat message to the EC2 API
   * @param {Object} params - Chat parameters
   * @param {string} params.message - User message
   * @param {string} params.userId - User ID
   * @param {string} params.projectName - Selected project name
   * @param {string} params.sessionId - Chat session ID for conversation continuity
   * @returns {Promise<Object>} API response
   */
  async sendMessage({ message, userId, projectName, sessionId }) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      // Build query parameters as your server expects
      const queryParams = new URLSearchParams({
        user_id: userId,
        project_folder: projectName,
        session_id: sessionId,
        question: message
      });

      const url = `${this.baseUrl}/chat?${queryParams}`;
      console.log(`Sending message to: ${url}`);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      console.log('Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error Response:', errorText);
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('Full API Response:', data);
      
      // Your server returns 'answer' field, but Chat component expects 'response'
      // So we'll normalize it here
      const responseText = data.answer || data.response || 'No response received';
      
      return {
        ...data,
        response: responseText,  // Ensure Chat component gets the content
        answer: data.answer      // Keep original for debugging
      };
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('Request timed out. Please try again.');
      }
      
      console.error('Chat API Error:', error);
      throw new Error(`Failed to send message: ${error.message}`);
    }
  }

  /**
   * Check if the API is available
   * @returns {Promise<boolean>} API health status
   */
  async checkHealth() {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const url = `${this.baseUrl}/health`;
      console.log(`Checking health at: ${url}`);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      console.log('Health check response:', response.status);
      return response.ok;
    } catch (error) {
      console.error('Health check failed:', error);
      
      // If /health endpoint doesn't exist, try to ping the base URL
      try {
        const response = await fetch(this.baseUrl || '/', {
          method: 'GET',
          mode: 'no-cors' // This allows us to check if server is reachable
        });
        return true; // If we get here, server is reachable
      } catch (fallbackError) {
        console.error('Fallback health check also failed:', fallbackError);
        return false;
      }
    }
  }

  /**
   * Get API configuration/info
   * @returns {Promise<Object>} API info
   */
  async getApiInfo() {
    try {
      const url = `${this.baseUrl}/info`;
      console.log(`Getting API info from: ${url}`);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        }
      });

      if (response.ok) {
        const info = await response.json();
        console.log('API Info:', info);
        return info;
      }
      return null;
    } catch (error) {
      console.error('Failed to get API info:', error);
      return null;
    }
  }

  /**
   * Update the base URL for the API
   * @param {string} newUrl - New API base URL
   */
  setBaseUrl(newUrl) {
    this.baseUrl = newUrl;
    console.log('API base URL updated to:', newUrl);
  }

  /**
   * Get the current base URL
   * @returns {string} Current API base URL
   */
  getBaseUrl() {
    return this.baseUrl || 'http://54.226.223.245:8000';
  }
}

// Export a singleton instance
const chatApiService = new ChatApiService();
export default chatApiService; 