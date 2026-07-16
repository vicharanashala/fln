import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api",
  timeout: 300000,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((cfg) => {
  const token = localStorage.getItem("fln_token");
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("fln_token");
      localStorage.removeItem("fln_user");
    }
    return Promise.reject(err);
  }
);

export default api;
