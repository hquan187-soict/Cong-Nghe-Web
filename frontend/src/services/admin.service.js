import axiosInstance from '../utils/axios';

export const adminService = {
  async getUsers(params = {}) {
    return await axiosInstance.get('/api/admin/users', { params });
  },

  async updateUserBan(userId, action) {
    return await axiosInstance.put(`/api/admin/users/${userId}/ban`, { action });
  },

  async getReports(params = {}) {
    return await axiosInstance.get('/api/admin/reports', { params });
  },

  async updateReportStatus(reportId, status) {
    return await axiosInstance.put(`/api/admin/reports/${reportId}/status`, { status });
  },

  async getReportContext(reportId) {
    return await axiosInstance.get(`/api/admin/reports/${reportId}/context`);
  },
};
