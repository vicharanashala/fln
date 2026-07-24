import axios from 'axios';
import { withBase } from './apiClient';

const api = axios.create({
  // Base-relative by default (base-aware via withBase), so it works in every
  // deployment. Override with VITE_API_URL if needed.
  baseURL: import.meta.env.VITE_API_URL || withBase('/api'),
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('fln_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
