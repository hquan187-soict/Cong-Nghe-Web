import axiosInstance from '../utils/axios';

export const messageService = {
  async getMessages(conversationId, page = 1, limit = 20) {
    return await axiosInstance.get(`/api/messages/${conversationId}`, {
      params: { page, limit },
    });
  },
  async sendMessage(data) {
    return await axiosInstance.post('/api/messages', data);
  },
};
