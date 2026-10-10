import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

// Attach access token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Refresh token on 401 (single-flight)
let refreshPromise = null;
const tryRefresh = () => {
  if (!refreshPromise) {
    refreshPromise = api
      .post('/auth/refresh-token')
      .then((res) => {
        localStorage.setItem('accessToken', res.data.accessToken);
        if (res.data.user) {
          localStorage.setItem('user', JSON.stringify(res.data.user));
        }
        return res.data.accessToken;
      })
      .catch((err) => {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('user');
        window.dispatchEvent(new CustomEvent('auth:logout'));
        throw err;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (
      error.response?.status === 401 &&
      !originalRequest?._retry &&
      originalRequest &&
      !originalRequest.url?.includes('/auth/login') &&
      !originalRequest.url?.includes('/auth/change-password') &&
      !originalRequest.url?.includes('/auth/refresh-token')
    ) {
      originalRequest._retry = true;
      try {
        const newToken = await tryRefresh();
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (refreshErr) {
        return Promise.reject(refreshErr);
      }
    }
    return Promise.reject(error);
  }
);

export default api;
