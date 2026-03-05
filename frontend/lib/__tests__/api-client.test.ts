import { requestJson } from '@/lib/api-client';

describe('api-client requestJson', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    global.fetch = originalFetch;
  });

  it('returns parsed JSON for successful responses', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      new Response(JSON.stringify({ ok: true, value: 42 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    await expect(requestJson<{ ok: boolean; value: number }>('/api/test')).resolves.toEqual({
      ok: true,
      value: 42,
    });
  });

  it('throws a RequestError with the API message for non-ok responses', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      new Response(JSON.stringify({ error: 'Backend unavailable' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    await expect(requestJson('/api/test')).rejects.toEqual(
      expect.objectContaining({
        name: 'RequestError',
        kind: 'http',
        status: 503,
        message: 'Backend unavailable',
      })
    );
  });

  it('throws when the response payload contains an error field and throwOnErrorField is enabled', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      new Response(JSON.stringify({ error: 'Quote not found' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    await expect(requestJson('/api/test', { throwOnErrorField: true })).rejects.toEqual(
      expect.objectContaining({
        kind: 'http',
        status: 200,
        message: 'Quote not found',
      })
    );
  });

  it('wraps invalid json responses in a RequestError', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      new Response('{"broken"', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    await expect(requestJson('/api/test')).rejects.toEqual(
      expect.objectContaining({
        name: 'RequestError',
        kind: 'http',
        status: 200,
        message: 'Invalid response from server.',
      })
    );
  });
});
