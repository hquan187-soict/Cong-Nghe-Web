import axiosInstance from '../utils/axios';

export const userService = {
  /**
   * Tìm kiếm users theo tên hoặc email
   * GET /api/users/search?q=...
   * @param {string} query - Từ khóa tìm kiếm (fullName hoặc email)
   * Response: array users (không bao gồm user hiện tại, bỏ password)
   */
  async searchUsers(query) {
    return await axiosInstance.get('/api/users/search', {
      params: { q: query },
    });
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

  /**
   * Đổi mật khẩu
   * PUT /api/users/change-password
   * @param {Object} data - { currentPassword, newPassword }
   * Response: { message: "..." }
   */
  async changePassword(data) {
    return await axiosInstance.put('/api/users/change-password', data);
  },

  async getUserById(id) {
    return await axiosInstance.get(`/api/users/${id}`);
  },

  async toggleActiveStatus(enabled) {
    return await axiosInstance.put('/api/users/active-status', { enabled });
  },
};
