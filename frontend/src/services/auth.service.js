import axiosInstance from '../utils/axios';

export const authService = {
  async signup(data) {
    return await axiosInstance.post('/api/auth/signup', data);
  },

  async login(data) {
    return await axiosInstance.post('/api/auth/login', data);
  },

  async loginWithGoogle(data) {
    return await axiosInstance.post('/api/auth/google', data);
  },

  async logout() {
    return await axiosInstance.post('/api/auth/logout');
  },

  // Gửi OTP xác thực email (đăng ký)
  async sendSignupOtp(data) {
    return await axiosInstance.post('/api/auth/send-otp', data);
  },

  // Gửi OTP quên mật khẩu
  async sendForgotPasswordOtp(data) {
    return await axiosInstance.post('/api/auth/send-otp', data);
  },

  // Đặt lại mật khẩu bằng OTP
  async resetPassword(data) {
    return await axiosInstance.post('/api/auth/reset-password', data);
  },

  async getMe() {
    return await axiosInstance.get('/api/auth/me');
  },
};
