import axios from 'axios';
// Axios instance — cấu hình interceptor cho toàn app
// - Request: tự gắn token vào header Authorization
// - Response: intercept 401 → gọi logout callback
// Biến lưu hàm logout — sẽ được AuthContext đăng ký qua setLogoutCallback()
let _logoutCallback = null;

/*
  Đăng ký hàm logout từ AuthContext.
  Khi response 401 xảy ra, axios sẽ gọi hàm này để logout user.
 */
export function setLogoutCallback(fn) {
  _logoutCallback = fn;
}

// Create an Axios instance
const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor — tự gắn token vào header Authorization
axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    // Handle request error
    return Promise.reject(error);
  }
);

// Response interceptor — intercept 401 để tự động logout
axiosInstance.interceptors.response.use(
  (response) => {
    // Return just the data part of the response if desired
    return response.data;
  },
  (error) => {
    // Handle response error
    if (error.response) {
      if (error.response.status === 401) {
        console.error('Unauthorized (401), tự động logout...');
        // Gọi logout callback nếu đã được đăng ký từ AuthContext
        if (_logoutCallback) {
          _logoutCallback();
        }
      }
    }
    return Promise.reject(error);
  }
);

export default axiosInstance;
