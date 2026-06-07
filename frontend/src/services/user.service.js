import axiosInstance from '../utils/axios';

export const userService = {
  async searchUsers(query) {
    return await axiosInstance.get('/api/users/search', {
      params: { q: query },
    });
  },

  async getFriends() {
    return await axiosInstance.get('/api/users/friends');
  },

  async getFriendRequests() {
    return await axiosInstance.get('/api/users/friend-requests');
  },

  /**
   * Cập nhật thông tin profile của user hiện tại
   * PUT /api/users/profile
   * @param {Object} data - { fullName?, avatar? }
   * Response: updated user object (không bao gồm password)
   */
  async updateProfile(data) {
    return await axiosInstance.put('/api/users/profile', data);
  },

  async changePassword(data) {
    return await axiosInstance.put('/api/users/change-password', data);
  },

  async removeAvatar() {
    return await axiosInstance.put('/api/users/profile', { avatar: '' });
  },

  async getUserById(id) {
    return await axiosInstance.get(`/api/users/${id}`);
  },

  async toggleActiveStatus(enabled) {
    return await axiosInstance.put('/api/users/active-status', { enabled });
  },

  /**
   * Gửi lời mời kết bạn
   * POST /api/users/friend-requests/:userId
   */
  async sendFriendRequest(userId) {
    return await axiosInstance.post(`/api/users/friend-requests/${userId}`);
  },

  /**
   * Chấp nhận lời mời kết bạn
   * PUT /api/users/friend-requests/:userId
   */
  async acceptFriendRequest(userId) {
    return await axiosInstance.put(`/api/users/friend-requests/${userId}`);
  },

  /**
   * Từ chối lời mời kết bạn
   * DELETE /api/users/friend-requests/:userId
   */
  async rejectFriendRequest(userId) {
    return await axiosInstance.delete(`/api/users/friend-requests/${userId}`);
  },

  /**
   * Hủy kết bạn
   * DELETE /api/users/friends/:userId
   */
  async unfriend(userId) {
    return await axiosInstance.delete(`/api/users/friends/${userId}`);
  },

  /**
   * Chặn người dùng
   * POST /api/users/blocks/:userId
   */
  async blockUser(userId) {
    return await axiosInstance.post(`/api/users/blocks/${userId}`);
  },

  /**
   * Bỏ chặn người dùng
   * DELETE /api/users/blocks/:userId
   */
  async unblockUser(userId) {
    return await axiosInstance.delete(`/api/users/blocks/${userId}`);
  },

  async deleteMyAccount() {
    return await axiosInstance.delete('/api/users/account');
  },
};
