import axiosInstance from '../utils/axios';

export const notificationService = {
  async getNotifications(page = 1, limit = 20) {
    return await axiosInstance.get('/api/notifications', {
      params: { page, limit },
    });
  },

  async getUnreadCount() {
    return await axiosInstance.get('/api/notifications/unread-count');
  },

  async markAsRead(notificationId) {
    return await axiosInstance.put(`/api/notifications/${notificationId}/read`);
  },

  async markAllAsRead() {
    return await axiosInstance.put('/api/notifications/read-all');
  },
};
