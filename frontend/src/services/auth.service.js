import axiosInstance from '../utils/axios';

export const authService = {
  async signup(data) {
    return await axiosInstance.post('/api/auth/signup', data);
  },

  async login(data) {
    return await axiosInstance.post('/api/auth/login', data);
  },

  async logout() {
    return await axiosInstance.post('/api/auth/logout');
  }
};
