import axios from 'axios';

// Create an Axios instance
const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
axiosInstance.interceptors.request.use(
  (config) => {
    // You can attach a token here if you have auth
    // const token = localStorage.getItem('token');
    // if (token) {
    //   config.headers.Authorization = `Bearer ${token}`;
    // }
    return config;
  },
  (error) => {
    // Handle request error
    return Promise.reject(error);
  }
);

// Response interceptor
axiosInstance.interceptors.response.use(
  (response) => {
    // Return just the data part of the response if desired
    return response.data;
  },
  (error) => {
    // Handle response error
    if (error.response) {
      // Examples: handle 401 Unauthorized or 403 Forbidden
      if (error.response.status === 401) {
        console.error('Unauthorized, please login again.');
        // optionally: window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default axiosInstance;
