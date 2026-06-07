import axiosInstance from '../utils/axios';

export const reportService = {
  async createReport(data) {
    return await axiosInstance.post('/api/reports', data);
  },
};
