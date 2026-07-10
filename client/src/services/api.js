import axios from 'axios';

const API = axios.create({ baseURL: process.env.REACT_APP_API_URL || '/api' });

API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export const auth = {
  login: (data) => API.post('/auth/login', data),
  getMe: () => API.get('/auth/me'),
};

export const users = {
  list: () => API.get('/users'),
  create: (data) => API.post('/users', data),
  reviveTeacher: (id) => API.put(`/users/${id}/revive`),
  restoreSchool: (id) => API.put(`/users/${id}/restore-school`),
};

export const schools = {
  list: () => API.get('/schools'),
  get: (id) => API.get(`/schools/${id}`),
  create: (data) => API.post('/schools', data),
};

export const classesApi = {
  list: (params) => API.get('/classes', { params }),
  get: (id) => API.get(`/classes/${id}`),
  create: (data) => API.post('/classes', data),
};

export const students = {
  list: (params) => API.get('/students', { params }),
  get: (id) => API.get(`/students/${id}`),
  create: (data) => API.post('/students', data),
  getHistory: (id) => API.get(`/students/${id}/history`),
};

export const worksheets = {
  generateForClass: (data) => API.post('/worksheets/generate-class', data),
  getByStudent: (id) => API.get(`/worksheets/student/${id}`),
  get: (id) => API.get(`/worksheets/${id}`),
};

export const evaluations = {
  submit: (data) => API.post('/evaluation/submit', data),
  evaluate: (data) => API.post('/evaluation/evaluate', data),
  getLatest: (id) => API.get(`/evaluation/${id}/latest`),
  getHistory: (id) => API.get(`/evaluation/${id}/history`),
};

export const analytics = {
  national: () => API.get('/analytics/national'),
  school: (id) => API.get(`/analytics/school/${id}`),
};

export const logbook = {
  list: (params) => API.get('/logbook', { params }),
  export: () => API.get('/logbook/export'),
};

export const announcements = {
  list: () => API.get('/announcements'),
  create: (data) => API.post('/announcements', data),
};

export const tickets = {
  list: (params) => API.get('/tickets', { params }),
  create: (data) => API.post('/tickets', data),
  review: (id, data) => API.put(`/tickets/${id}/review`, data),
};

export default API;
