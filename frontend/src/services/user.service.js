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
};
