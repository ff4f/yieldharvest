import { apiClient } from './api';

/**
 * Milestone API service for interacting with milestone endpoints
 */
export class MilestonesApi {
  /**
   * Create a new milestone
   * @param {Object} milestoneData - Milestone data
   * @param {string} milestoneData.tokenId - NFT token ID
   * @param {number} milestoneData.serial - NFT serial number
   * @param {string} milestoneData.milestone - Milestone type
   * @param {Object} milestoneData.metadata - Additional metadata
   * @returns {Promise<Object>} Created milestone
   */
  static async createMilestone(milestoneData) {
    try {
      const response = await apiClient.post('/api/milestones', milestoneData);
      return response.data;
    } catch (error) {
      console.error('Error creating milestone:', error);
      throw error;
    }
  }

  /**
   * Get milestone timeline for a specific NFT
   * @param {string} tokenId - NFT token ID
   * @param {number} serial - NFT serial number
   * @returns {Promise<Array>} Milestone timeline
   */
  static async getMilestoneTimeline(tokenId, serial) {
    try {
      const response = await apiClient.get(`/api/milestones/timeline/${tokenId}/${serial}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching milestone timeline:', error);
      throw error;
    }
  }

  /**
   * Get all milestones for a specific NFT
   * @param {string} tokenId - NFT token ID
   * @param {number} serial - NFT serial number
   * @returns {Promise<Array>} All milestones
   */
  static async getMilestones(tokenId, serial) {
    try {
      const response = await apiClient.get(`/api/milestones/${tokenId}/${serial}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching milestones:', error);
      throw error;
    }
  }

  /**
   * Get real-time milestone updates from Mirror Node
   * @param {string} tokenId - NFT token ID
   * @param {number} serial - NFT serial number
   * @returns {Promise<Array>} Real-time milestone data
   */
  static async getRealTimeMilestones(tokenId, serial) {
    try {
      const response = await apiClient.get(`/api/milestones/realtime/${tokenId}/${serial}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching real-time milestones:', error);
      throw error;
    }
  }

  /**
   * Clear milestone cache
   * @returns {Promise<Object>} Success response
   */
  static async clearCache() {
    try {
      const response = await apiClient.delete('/api/milestones/cache');
      return response.data;
    } catch (error) {
      console.error('Error clearing milestone cache:', error);
      throw error;
    }
  }

  /**
   * Get milestone service health status
   * @returns {Promise<Object>} Health status
   */
  static async getHealthStatus() {
    try {
      const response = await apiClient.get('/api/milestones/health');
      return response.data;
    } catch (error) {
      console.error('Error fetching milestone health status:', error);
      throw error;
    }
  }

  /**
   * Subscribe to milestone updates (polling-based)
   * @param {string} tokenId - NFT token ID
   * @param {number} serial - NFT serial number
   * @param {Function} callback - Callback function for updates
   * @param {number} interval - Polling interval in milliseconds (default: 5000)
   * @returns {Function} Cleanup function to stop polling
   */
  static subscribeMilestoneUpdates(tokenId, serial, callback, interval = 5000) {
    let isActive = true;
    
    const poll = async () => {
      if (!isActive) return;
      
      try {
        const milestones = await this.getRealTimeMilestones(tokenId, serial);
        callback(milestones);
      } catch (error) {
        console.error('Error polling milestone updates:', error);
      }
      
      if (isActive) {
        setTimeout(poll, interval);
      }
    };
    
    // Start polling
    poll();
    
    // Return cleanup function
    return () => {
      isActive = false;
    };
  }
}

export default MilestonesApi;