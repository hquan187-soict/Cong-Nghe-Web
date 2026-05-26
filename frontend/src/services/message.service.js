import axiosInstance from '../utils/axios';

export const messageService = {
  /**
   * Lấy tin nhắn theo conversationId (phân trang)
   * GET /api/messages/:conversationId?page=1&limit=20
   * Response: { messages: [...], pagination: { page, limit, total, hasMore } }
   */
  async getMessages(conversationId, page = 1, limit = 20) {
    return await axiosInstance.get(`/api/messages/${conversationId}`, {
      params: { page, limit },
    });
  },

  /**
   * Gửi tin nhắn mới
   * POST /api/messages
   * @param {Object} data - { conversationId, text, image? }
   * Response: message object (đã lưu DB)
   */
  async sendMessage(data) {
    return await axiosInstance.post('/api/messages', data);
  },

  /**
   * Đánh dấu tất cả tin nhắn trong conversation là đã đọc
   * POST /api/messages/:conversationId/read
   * Response: { message, modifiedCount, messages }
   */
  async markAsRead(conversationId) {
    return await axiosInstance.post(`/api/messages/${conversationId}/read`);
  },

  async toggleReaction(messageId, emoji) {
    return await axiosInstance.post(`/api/messages/${messageId}/reaction`, { emoji });
  },

  async togglePinMessage(messageId) {
    return await axiosInstance.put(`/api/messages/${messageId}/pin`);
  },

  async editMessage(messageId, newText) {
    return await axiosInstance.put(`/api/messages/${messageId}/edit`, { text: newText });
  },

  async deleteMessage(messageId, type = 'me') {
    return await axiosInstance.put(`/api/messages/${messageId}/delete`, { type });
  },

  async getPinnedMessages(conversationId) {
    return await axiosInstance.get(`/api/messages/${conversationId}/pinned`);
  },

  async forwardMessage(messageId, conversationIds) {
    return await axiosInstance.post(`/api/messages/${messageId}/forward`, { conversationIds });
  },

  async getMediaAndFiles(conversationId) {
    return await axiosInstance.get(`/api/messages/${conversationId}/media-files`);
  },

  async searchMessages(conversationId, q) {
    return await axiosInstance.get(`/api/messages/${conversationId}/search`, {
      params: { q },
    });
  },
};
