import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { getCSRFToken } from './csrf-client'; 
import { auth } from './firebase'; 

const apiClient = axios.create({
  timeout: 30000,
  withCredentials: true, 
  headers: {
    'Content-Type': 'application/json',
    // Use strictly lowercase to prevent Axios/Node normalization drops
    'x-requested-with': 'XMLHttpRequest', 
  },
});

apiClient.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  // 1. Force the custom header on every request using proper AxiosHeaders API
  config.headers.set('x-requested-with', 'XMLHttpRequest');

  // --- A. Attach CSRF Token ---
  if (['post', 'put', 'delete', 'patch'].includes(config.method?.toLowerCase() || '')) {
    try {
      const token = await getCSRFToken();
      if (token) {
        config.headers.set('x-csrf-token', token);
      } else {
        // Fallback: If async fetcher fails or returns empty, grab directly from document
        if (typeof document !== 'undefined') {
          const match = document.cookie.match(/(?:^|;\s*)csrf-token=([^;]*)/);
          if (match && match[1]) {
            config.headers.set('x-csrf-token', match[1]);
          }
        }
      }
    } catch (e) {
      console.warn('Failed to retrieve CSRF token via fetcher, skipping header assignment:', e);
    }
  }

  // --- B. Attach User DB ID ---
  if (typeof window !== 'undefined') {
    const userId = localStorage.getItem('user-db-id');
    if (userId) {
      config.headers.set('x-user-id', userId);
    }
  }

  // --- C. Attach Firebase Auth Token ---
  if (auth?.currentUser) {
    try {
      const idToken = await auth.currentUser.getIdToken();
      config.headers.set('Authorization', `Bearer ${idToken}`);
    } catch (error) {
      console.error('Failed to attach Firebase token to request:', error);
    }
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    let message = 'An unexpected error occurred';

    if (error.response) {
      const data = error.response.data as any;
      message =
        data?.message ||
        (typeof data?.error === 'string' ? data.error : data?.error?.message) ||
        `Error ${error.response.status}: ${error.message}`;
    } else if (error.request) {
      message = 'Network error: No response from server. Please check your connection.';
    } else {
      message = error.message;
    }

    if (typeof window !== 'undefined') {
      const { toast } = await import('react-hot-toast');
      toast.error(message, {
        id: 'api-error',
      });
    }

    return Promise.reject(error);
  }
);

export default apiClient;