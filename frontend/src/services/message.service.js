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
};
