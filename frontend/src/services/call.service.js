import axiosInstance from '../utils/axios';

export const callService = {
  async getCallHistory(page = 1, limit = 20) {
    return await axiosInstance.get('/api/calls/history', {
      params: { page, limit },
    });
  },
};
