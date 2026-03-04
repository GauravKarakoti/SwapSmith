import { useCallback, useEffect, useState } from 'react';

/**
 * Hook for CSRF token management
 * Automatically includes CSRF token in API requests
 */
export function useCsrfToken() {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    // Read CSRF token from cookie
    const cookies = document.cookie.split(';');
    const csrfCookie = cookies.find(c => c.trim().startsWith('csrf-token='));
    
    if (csrfCookie) {
      const tokenValue = csrfCookie.split('=')[1];
      setToken(tokenValue);
    }
  }, []);

  const getHeaders = useCallback(() => {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers['x-csrf-token'] = token;
    }

    return headers;
  }, [token]);

  return { token, getHeaders };
}

/**
 * Enhanced fetch wrapper with CSRF protection
 * Usage: const response = await csrfFetch('/api/route', { method: 'POST', body: {...} });
 */
export async function csrfFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  // Read CSRF token from cookie
  const cookies = document.cookie.split(';');
  const csrfCookie = cookies.find(c => c.trim().startsWith('csrf-token='));
  
  const token = csrfCookie?.split('=')[1];

  const headers = new Headers(options.headers || {});

  // Set content type if not already set
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  // Add CSRF token for state-changing requests
  const method = options.method?.toUpperCase() || 'GET';
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method) && token) {
    headers.set('x-csrf-token', token);
  }

  return fetch(url, {
    ...options,
    headers,
  });
}

/**
 * Axios interceptor configuration for CSRF protection
 * Usage: import axios from 'axios';
 *        setupCsrfInterceptor(axios);
 */
export function setupCsrfInterceptor(axiosInstance: any) {
  axiosInstance.interceptors.request.use((config: any) => {
    // Read CSRF token from cookie
    const cookies = document.cookie.split(';');
    const csrfCookie = cookies.find(c => c.trim().startsWith('csrf-token='));
    
    if (csrfCookie) {
      const token = csrfCookie.split('=')[1];
      config.headers['x-csrf-token'] = token;
    }

    return config;
  });

  return axiosInstance;
}
