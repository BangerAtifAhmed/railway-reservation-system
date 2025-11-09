import axios from 'axios';

const API_BASE_URL = 'http://localhost:3000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const authService = {
  // User Authentication
  async userLogin(credentials) {
    const response = await api.post('/auth/login', credentials);
    return response.data;
  },

  async userRegister(userData) {
    const response = await api.post('/auth/register', userData);
    return response.data;
  },

  // Employee Authentication
  async employeeLogin(credentials) {
    const response = await api.post('/employees/auth/login', credentials);
    return response.data;
  },

  // Store auth data
  storeAuthData(data, userType) {
    localStorage.setItem('token', data.token);
    localStorage.setItem('userType', userType);
    if (userType === 'user') {
      localStorage.setItem('user', JSON.stringify(data.user));
    } else if (userType === 'employee') {
      localStorage.setItem('employee', JSON.stringify(data.employee));
    }
  },

  // Get current user
  getCurrentUser() {
    const userType = localStorage.getItem('userType');
    if (userType === 'user') {
      return JSON.parse(localStorage.getItem('user'));
    } else if (userType === 'employee') {
      return JSON.parse(localStorage.getItem('employee'));
    }
    return null;
  },

  // Logout
  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('userType');
    localStorage.removeItem('user');
    localStorage.removeItem('employee');
  },

  // Check if authenticated
  isAuthenticated() {
    return !!localStorage.getItem('token');
  },

  // Get user type
  getUserType() {
    return localStorage.getItem('userType');
  }
};