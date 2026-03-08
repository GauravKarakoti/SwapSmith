/**
 * Client-side CSRF Token Management
 * 
 * Provides utilities for handling CSRF tokens in the browser
 * Uses the unified CSRF config from csrf-middleware
 */

import { CSRF_CONFIG } from './csrf-middleware';

/**
 * Get CSRF token from cookie
 */
export function getCSRFTokenFromCookie(): string | null {
  if (typeof document === 'undefined') return null;
  
  const cookies = document.cookie.split(';');
  const csrfCookie = cookies.find(cookie => 
    cookie.trim().startsWith(`${CSRF_CONFIG.tokenCookie}=`)
  );
  
  return csrfCookie ? csrfCookie.split('=')[1] : null;
}

/**
 * Fetch CSRF token from API
 */
export async function fetchCSRFToken(): Promise<string | null> {
  try {
    const response = await fetch('/api/csrf-token', {
      method: 'GET',
      credentials: 'same-origin',
    });
    
    if (!response.ok) {
      console.error('Failed to fetch CSRF token:', response.statusText);
      return null;
    }
    
    const data = await response.json();
    return data.token || null;
  } catch (error) {
    console.error('Error fetching CSRF token:', error);
    return null;
  }
}

/**
 * Get CSRF token (from cookie or API)
 */
export async function getCSRFToken(): Promise<string | null> {
  // Try to get from cookie first
  let token = getCSRFTokenFromCookie();
  
  // If not in cookie, fetch from API
  if (!token) {
    token = await fetchCSRFToken();
  }
  
  return token;
}

/**
 * Create headers with CSRF token for state-changing requests
 */
export async function createCSRFHeaders(additionalHeaders: Record<string, string> = {}): Promise<Record<string, string>> {
  const token = await getCSRFToken();
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
    ...additionalHeaders,
  };
  
  if (token) {
    headers[CSRF_CONFIG.tokenHeader] = token;
  }
  
  return headers;
}

/**
 * Enhanced fetch with CSRF protection
 */
export async function csrfFetch(
  url: string, 
  options: RequestInit = {}
): Promise<Response> {
  const method = options.method?.toUpperCase() || 'GET';
  
  // Add CSRF headers for state-changing methods
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
    const csrfHeaders = await createCSRFHeaders();
    options.headers = {
      ...csrfHeaders,
      ...options.headers,
    };
  }
  
  // Ensure credentials are included
  options.credentials = options.credentials || 'same-origin';
  
  return fetch(url, options);
}

/**
 * Utility for making secure API calls
 */
export class SecureAPIClient {
  private baseURL: string;
  
  constructor(baseURL: string = '/api') {
    this.baseURL = baseURL;
  }
  
  private async request<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    
    try {
      const response = await csrfFetch(url, options);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error(`API request failed: ${options.method || 'GET'} ${url}`, error);
      throw error;
    }
  }
  
  async get<T>(endpoint: string, headers?: Record<string, string>): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'GET',
      headers,
    });
  }
  
  async post<T>(
    endpoint: string, 
    data?: unknown, 
    headers?: Record<string, string>
  ): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      headers,
      body: data ? JSON.stringify(data) : undefined,
    });
  }
  
  async put<T>(
    endpoint: string, 
    data?: unknown, 
    headers?: Record<string, string>
  ): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      headers,
      body: data ? JSON.stringify(data) : undefined,
    });
  }
  
  async delete<T>(
    endpoint: string, 
    headers?: Record<string, string>
  ): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'DELETE',
      headers,
    });
  }
  
  async patch<T>(
    endpoint: string, 
    data?: unknown, 
    headers?: Record<string, string>
  ): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      headers,
      body: data ? JSON.stringify(data) : undefined,
    });
  }
}

// Default API client instance
export const apiClient = new SecureAPIClient();

/**
 * Hook for React components to use CSRF-protected API calls
 */
export function useSecureAPI() {
  return {
    apiClient,
    csrfFetch,
    getCSRFToken,
    createCSRFHeaders,
  };
}