import axiosInstance from '../utils/axios';

export const conversationService = {
  /**
   * Lấy danh sách conversations của user hiện tại
   * GET /api/conversations
   * Response: array conversations (populated members + lastMessage, sort updatedAt desc)
   */
  async getConversations() {
    return await axiosInstance.get('/api/conversations');
  },

  /**
   * Tạo conversation mới (hoặc trả về conversation cũ nếu đã tồn tại)
   * POST /api/conversations
   * @param {string} userId - ID của người dùng muốn trò chuyện
   * Response: conversation object (populated members + lastMessage)
   */
  async createConversation(userId) {
    return await axiosInstance.post('/api/conversations', { userId });
  },
};
