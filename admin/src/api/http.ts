import axios from 'axios';

const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

export const http = axios.create({
  baseURL,
  timeout: 10000,
});

http.interceptors.request.use((config) => {
  const token = localStorage.getItem('cashier_admin_token');
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

http.interceptors.response.use(
  (response) => {
    const envelope = response.data;
    if (!envelope || typeof envelope.code !== 'number') {
      return response.data;
    }
    if (envelope.code !== 0) {
      const message = envelope.message || '请求失败';
      return Promise.reject(new Error(message));
    }
    return envelope.data;
  },
  (error) => {
    const message =
      error?.response?.data?.message ||
      error?.message ||
      '网络异常，请稍后重试';
    return Promise.reject(new Error(message));
  },
);

