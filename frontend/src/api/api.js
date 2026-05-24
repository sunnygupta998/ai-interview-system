import axios from 'axios';

const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor to inject JWT token in every request
API.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('ai_interview_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor to handle authentication failures
API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Clear token and user details if token is expired or invalid
      localStorage.removeItem('ai_interview_token');
      localStorage.removeItem('ai_interview_user');
      // If we are on a protected page, redirect to login
      if (!window.location.pathname.includes('/login') && !window.location.pathname.includes('/register')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  register: (name, email, password, role, adminSecret) => API.post('/auth/register', { name, email, password, role, adminSecret }),
  login: (email, password) => API.post('/auth/login', { email, password }),
  getMe: () => API.get('/auth/me'),
  verifyEmail: (email, code) => API.post('/auth/verify-email', { email, code }),
  resendVerification: (email) => API.post('/auth/resend-verification', { email }),
  googleLogin: (token, role) => API.post('/auth/google', { token, role }),
};

export const resumeAPI = {
  upload: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return API.post('/resume/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  getMyResumes: () => API.get('/resume/my-resumes'),
  getAnalysis: (resumeId) => API.get(`/resume/analysis/${resumeId}`),
  delete: (resumeId) => API.delete(`/resume/${resumeId}`),
};

export const testAPI = {
  generate: (resumeId) => API.post(`/test/generate/${resumeId}`),
  start: (testId) => API.post(`/test/start/${testId}`),
  submit: (id, answers, proctoringData) => API.post(`/test/submit/${id}`, { answers, proctoring: proctoringData }),
  getResults: (testId) => API.get(`/test/results/${testId}`),
  getMyTests: () => API.get('/test/my-tests'),
};

export const adminAPI = {
  getSettings: () => API.get('/admin/settings'),
  updateSettings: (settings) => API.put('/admin/settings', settings),
  getResults: (page = 1, perPage = 10) => API.get(`/admin/results?page=${page}&per_page=${perPage}`),
  getCandidateResults: (candidateId) => API.get(`/admin/results/candidate/${candidateId}`),
  getDashboard: () => API.get('/admin/dashboard'),
};

export const interviewAPI = {
  start: (testId) => API.post(`/interview/start/${testId}`),
  respond: (interviewId, message) => API.post(`/interview/respond/${interviewId}`, { message }),
  transcribe: (audioBlob) => {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.webm');
    return API.post('/interview/transcribe', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  getTTS: (text, lang) => API.get('/interview/tts', { 
    params: { text, lang }, 
    responseType: 'blob' 
  }),
  end: (interviewId, proctoringData = {}) => API.post(`/interview/end/${interviewId}`, { proctoring: proctoringData }),
  startPractice: (resumeId) => API.post(`/interview/practice/start/${resumeId}`)
};

export default API;
