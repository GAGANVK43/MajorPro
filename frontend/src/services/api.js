import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request Interceptor: Attach JWT Bearer Token & Active Language if present
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("access_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    const currentLang = localStorage.getItem("diasense_language") || "en";
    config.headers["Accept-Language"] = currentLang;
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
      (typeof error.response?.data?.detail === "string" ? error.response.data.detail : null) ||
      error.message ||
      "An unexpected network error occurred";
    return Promise.reject(new Error(message));
  }
);

// Centralized API Service Methods
export const authService = {
  register: (userData) => api.post("/api/auth/register", userData),
  login: (credentials) => api.post("/api/auth/login", credentials),
  getProfile: () => api.get("/api/user/profile"),
  updateProfile: (data) => api.put("/api/user/profile", data),
};

export const userService = {
  getProfile: () => api.get("/api/user/profile"),
  updateProfile: (data) => api.put("/api/user/profile", data),
  changePassword: (data) => api.put("/api/user/change-password", data),
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
  getPdfUrl: (id) => {
    const token = localStorage.getItem("access_token") || "";
    const base = API_BASE_URL || window.location.origin;
    const path = (id && id !== 1) ? `/api/reports/${id}/pdf` : `/api/reports/latest/pdf`;
    return token
      ? `${base}${path}?token=${encodeURIComponent(token)}`
      : `${base}${path}`;
  },
  downloadLatestPdf: async () => {
    const token = localStorage.getItem("access_token");
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const base = API_BASE_URL || "";
    const res = await axios.get(`${base}/api/reports/latest/pdf`, {
      headers,
      responseType: "blob",
    });
    const blob = new Blob([res.data], { type: "application/pdf" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `DiaSense_Health_Report.pdf`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },
  downloadPdf: async (id) => {
    if (!id || id === 1) {
      return reportService.downloadLatestPdf();
    }
    const token = localStorage.getItem("access_token");
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const base = API_BASE_URL || "";
    const res = await axios.get(`${base}/api/reports/${id}/pdf`, {
      headers,
      responseType: "blob",
    });
    const blob = new Blob([res.data], { type: "application/pdf" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `DiaSense_Health_Report_${id}.pdf`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },
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

export const nearbyCareService = {
  getNearbyCare: (params) => api.get("/api/nearby-care", { params }),
  geocodeLocation: (query) => api.get("/api/nearby-care/geocode", { params: { query } }),
};

export const smartAssessmentService = {
  extractReport: (formData) =>
    api.post("/api/smart-assessment/extract-report", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
};

export default api;
