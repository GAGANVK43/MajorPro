import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request Interceptor: Attach JWT Bearer Token if present
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("access_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Handle errors globally
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Clear token on 401 unauthorized
      localStorage.removeItem("access_token");
      localStorage.removeItem("user");
    }
    const message =
      error.response?.data?.message ||
      error.response?.data?.detail ||
      "An unexpected network error occurred";
    return Promise.reject(new Error(message));
  }
);

// Centralized API Service Methods
export const authService = {
  register: (userData) => api.post("/api/auth/register", userData),
  login: (credentials) => api.post("/api/auth/login", credentials),
  getProfile: () => api.get("/api/auth/profile"),
  updateProfile: (data) => api.put("/api/auth/profile", data),
};

export const assessmentService = {
  createAssessment: (data) => api.post("/api/assessment", data),
  getHistory: () => api.get("/api/assessment/history"),
  getById: (id) => api.get(`/api/assessment/${id}`),
  deleteById: (id) => api.delete(`/api/assessment/${id}`),
};

export const predictionService = {
  createPrediction: (data) => api.post("/api/prediction", data),
  getLatest: () => api.get("/api/prediction/latest"),
  getHistory: () => api.get("/api/prediction/history"),
};

export const dashboardService = {
  getDashboardData: () => api.get("/api/dashboard"),
};

export const dietService = {
  getLatestDiet: () => api.get("/api/diet/latest"),
  getByPredictionId: (id) => api.get(`/api/diet/${id}`),
};

export const contactService = {
  submitContact: (data) => api.post("/api/contact", data),
};

export const reportService = {
  getById: (id) => api.get(`/api/reports/${id}`),
  getPdfUrl: (id) => `${API_BASE_URL}/api/reports/${id}/pdf`,
};

export const chatbotService = {
  query: (message, context) => api.post("/api/chatbot/query", { message, context }),
};

export const foodService = {
  analyzeText: (query) => api.post("/api/food/analyze-text", { query }),
  analyzeImage: (formData) =>
    api.post("/api/food/analyze-image", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
};

export default api;
