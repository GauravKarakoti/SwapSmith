const DEFAULT_TIMEOUT_MS = 15000;

type RequestErrorKind = 'timeout' | 'network' | 'http';

interface FetchWithTimeoutOptions extends RequestInit {
  timeoutMs?: number;
}

interface RequestJsonOptions extends FetchWithTimeoutOptions {
  throwOnErrorField?: boolean;
}

export class RequestError extends Error {
  kind: RequestErrorKind;
  status?: number;
  details?: unknown;

  constructor(message: string, options: { kind: RequestErrorKind; status?: number; details?: unknown }) {
    super(message);
    this.name = 'RequestError';
    Object.setPrototypeOf(this, RequestError.prototype);
    this.kind = options.kind;
    this.status = options.status;
    this.details = options.details;
  }
}

function getPayloadMessage(payload: unknown): string | null {
  if (typeof payload === 'string' && payload.trim()) {
    return payload;
  }

  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    const candidates = [record.error, record.message, record.details];

    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim()) {
        return candidate;
      }
    }
  }

  return null;
}

function linkAbortSignal(signal: AbortSignal | null | undefined, controller: AbortController) {
  if (!signal) return () => {};

  if (signal.aborted) {
    controller.abort(signal.reason);
    return () => {};
  }

  const abortListener = () => controller.abort(signal.reason);
  signal.addEventListener('abort', abortListener);
  return () => signal.removeEventListener('abort', abortListener);
}

async function parseResponseBody(response: Response): Promise<unknown> {
  if (response.status === 204) return null;

  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    try {
      return await response.json();
    } catch (error) {
      throw new RequestError('Invalid response from server.', {
        kind: 'http',
        status: response.status,
        details: error,
      });
    }
  }

  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function fetchWithTimeout(
  url: string,
  options: FetchWithTimeoutOptions = {}
): Promise<Response> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, signal, ...fetchOptions } = options;
  const controller = new AbortController();
  const unlinkAbortSignal = linkAbortSignal(signal, controller);
  let timedOut = false;
  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort(new Error('Request timeout'));
  }, timeoutMs);

  try {
    return await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof RequestError) {
      throw error;
    }

    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new RequestError(
        timedOut ? 'Request timed out. Please try again.' : 'Request was interrupted.',
        { kind: timedOut ? 'timeout' : 'network' }
      );
    }

    throw new RequestError('Network request failed. Please check your connection and try again.', {
      kind: 'network',
      details: error,
    });
  } finally {
    unlinkAbortSignal();
    clearTimeout(timeoutId);
  }
}

export async function requestJson<T>(
  url: string,
  options: RequestJsonOptions = {}
): Promise<T> {
  const { throwOnErrorField = false, ...requestOptions } = options;
  const response = await fetchWithTimeout(url, requestOptions);
  let payload: unknown;

  try {
    payload = await parseResponseBody(response);
  } catch (error) {
    if (error instanceof RequestError) {
      throw error;
    }

    throw new RequestError('Invalid response from server.', {
      kind: 'http',
      status: response.status,
      details: error,
    });
  }

  if (!response.ok) {
    throw new RequestError(
      getPayloadMessage(payload) || `Request failed with status ${response.status}.`,
      {
        kind: 'http',
        status: response.status,
        details: payload,
      }
    );
  }

  if (throwOnErrorField && payload && typeof payload === 'object' && 'error' in (payload as Record<string, unknown>)) {
    const errorMessage = getPayloadMessage(payload) || 'Request failed.';
    throw new RequestError(errorMessage, {
      kind: 'http',
      status: response.status,
      details: payload,
    });
  }

  return payload as T;
}

/**
 * Helper function to make authenticated API calls
 */
export async function authenticatedFetch(
  url: string,
  options: FetchWithTimeoutOptions = {}
): Promise<Response> {
  // Get user ID from localStorage or session
  let userId = localStorage.getItem('user-db-id');

  // If no DB user ID, try to fetch/create one
  if (!userId) {
    const firebaseUid = localStorage.getItem('firebase-uid');
    if (firebaseUid) {
      try {
        const response = await fetchWithTimeout('/api/user/ensure', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            firebaseUid,
            walletAddress: localStorage.getItem('wallet-address')
          }),
        });

        if (response.ok) {
          const data = await response.json();
          userId = data.userId.toString();
          if (userId) {
            localStorage.setItem('user-db-id', userId);
          }
        }
      } catch (error) {
        console.error('Error ensuring user:', error);
      }
    }
  }

  const headers = new Headers(options.headers);

  if (userId) {
    headers.set('x-user-id', userId);
  }

  return fetchWithTimeout(url, {
    ...options,
    headers,
  });
}

/**
 * Set user ID in storage (call this after login/register)
 */
export function setUserId(userId: string | number) {
  localStorage.setItem('user-db-id', userId.toString());
}

/**
 * Set Firebase UID
 */
export function setFirebaseUid(uid: string) {
  localStorage.setItem('firebase-uid', uid);
}

/**
 * Get stored user ID
 */
export function getUserId(): string | null {
  return localStorage.getItem('user-db-id');
}

/**
 * Clear stored user ID (call on logout)
 */
export function clearUserId() {
  localStorage.removeItem('user-db-id');
  localStorage.removeItem('firebase-uid');
}

/**
 * Ensure user exists in database and return user ID
 */
export async function ensureUser(firebaseUid: string, walletAddress?: string): Promise<number | null> {
  try {
    const response = await fetchWithTimeout('/api/user/ensure', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firebaseUid, walletAddress }),
    });
    
    if (response.ok) {
      const data = await response.json();
      setUserId(data.userId);
      return data.userId;
    }
    
    return null;
  } catch (error) {
    console.error('Error ensuring user:', error);
    return null;
  }
}
