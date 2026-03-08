import axios, { AxiosError } from 'axios';
import { toast } from 'react-hot-toast';

/**
 * Global API Client with centralized error handling
 */
const apiClient = axios.create({
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    let message = 'An unexpected error occurred';

    if (error.response) {
      // Server responded with a status code outside 2xx range
      const data = error.response.data as any;
      message =
        data?.message ||
        (typeof data?.error === 'string' ? data.error : data?.error?.message) ||
        `Error ${error.response.status}: ${error.message}`;
    } else if (error.request) {
      // The request was made but no response was received
      message = 'Network error: No response from server. Please check your connection.';
    } else {
      // Something happened in setting up the request
      message = error.message;
    }

    // Use toast to display user-friendly error
    toast.error(message, {
      id: 'api-error', // Prevent duplicate toasts
    });

    return Promise.reject(error);
  }
);

export default apiClient;
