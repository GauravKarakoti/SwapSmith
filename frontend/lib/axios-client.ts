import axios, { AxiosError } from 'axios';
// 1. Change the import to use the async getCSRFToken
import { getCSRFToken } from './csrf-client'; 
// 2. Import your firebase auth (adjust path if necessary)
import { auth } from './firebase'; 

const apiClient = axios.create({
  timeout: 30000,
  withCredentials: true, 
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest', // <--- ADD THIS LINE
  },
});

// 3. Make the interceptor async
apiClient.interceptors.request.use(async (config) => {
  // --- A. Attach CSRF Token ---
  if (['post', 'put', 'delete', 'patch'].includes(config.method?.toLowerCase() || '')) {
    const token = await getCSRFToken(); // <--- Awaits the smart token fetcher
    if (token) {
      config.headers['x-csrf-token'] = token; 
    }
  }

  // --- B. Attach User DB ID ---
  if (typeof window !== 'undefined') {
    const userId = localStorage.getItem('user-db-id');
    if (userId) {
      config.headers['x-user-id'] = userId;
    }
  }

  // --- C. Attach Firebase Auth Token ---
  if (auth && auth.currentUser) {
    try {
      const idToken = await auth.currentUser.getIdToken();
      config.headers['Authorization'] = `Bearer ${idToken}`;
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