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

  /**
   * Tạo nhóm trò chuyện mới
   * POST /api/conversations
   * @param {string} name - Tên nhóm
   * @param {Array<string>} memberIds - Danh sách các userId thành viên
   * @param {string} [avatar] - URL ảnh đại diện nhóm
   * Response: conversation object
   */
  async createGroup(name, memberIds, avatar) {
    return await axiosInstance.post('/api/conversations', { name, memberIds, avatar });
  },

  /**
   * Cập nhật thông tin nhóm (Tên nhóm, ảnh nhóm)
   * PUT /api/conversations/:id
   * @param {string} id - ID của cuộc trò chuyện
   * @param {object} data - Dữ liệu cần cập nhật (name và/hoặc avatar)
   * Response: conversation object
   */
  async updateGroup(id, data) {
    return await axiosInstance.put(`/api/conversations/${id}`, data);
  },

  async addMember(conversationId, userId) {
    return await axiosInstance.post(`/api/conversations/${conversationId}/members`, { userId });
  },

  async leaveGroup(conversationId) {
    return await axiosInstance.post(`/api/conversations/${conversationId}/leave`);
  },

  async removeMember(conversationId, userId) {
    return await axiosInstance.post(`/api/conversations/${conversationId}/remove-member`, { userId });
  },

  async updateAddMemberPermission(conversationId, permission) {
    return await axiosInstance.put(`/api/conversations/${conversationId}/add-member-permission`, { permission });
  },

  async requestAddMember(conversationId, userId) {
    return await axiosInstance.post(`/api/conversations/${conversationId}/request-add-member`, { userId });
  },

  async approveRequest(conversationId, userId) {
    return await axiosInstance.post(`/api/conversations/${conversationId}/approve-request`, { userId });
  },

  async rejectRequest(conversationId, userId) {
    return await axiosInstance.post(`/api/conversations/${conversationId}/reject-request`, { userId });
  },
};
