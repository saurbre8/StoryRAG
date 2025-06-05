class EmbedService {
  constructor() {
    this.baseUrl = process.env.REACT_APP_CHAT_API_URL || 'http://54.226.223.245:8000';
    this.timeout = 120000; // 2 minutes timeout for embedding (can take longer)
  }

  /**
   * Trigger embedding for a user's project after file upload
   * @param {Object} params - Embed parameters
   * @param {string} params.userId - User ID
   * @param {string} params.projectFolder - Project folder name
   * @returns {Promise<Object>} API response
   */
  async embedProject({ userId, projectFolder }) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      // Build query parameters for the embed endpoint
      const queryParams = new URLSearchParams({
        user_id: userId,
        project_folder: projectFolder
      });

      const url = `${this.baseUrl}/embed?${queryParams}`;
      console.log(`Starting embedding for project: ${projectFolder}`);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Embed API Error Response:', errorText);
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('Embed API Response:', data);
      
      return data;
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('Embedding request timed out. Please try again.');
      }
      
      console.error('Embed API Error:', error);
      throw new Error(`Failed to embed project: ${error.message}`);
    }
  }

  /**
   * Embed project with user-friendly error handling
   * @param {string} userId - User ID
   * @param {string} projectFolder - Project folder name
   * @returns {Promise<{success: boolean, message: string}>}
   */
  async embedProjectSafely(userId, projectFolder) {
    try {
      const result = await this.embedProject({ userId, projectFolder });
      return {
        success: true,
        message: result.message || 'Project embedded successfully',
        data: result
      };
    } catch (error) {
      console.error('Embedding failed:', error);
      return {
        success: false,
        message: error.message || 'Embedding failed',
        error: error
      };
    }
  }
}

// Export a singleton instance
const embedService = new EmbedService();
export default embedService; 