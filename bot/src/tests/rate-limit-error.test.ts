import { RateLimitError } from '../services/sideshift-client';

describe('RateLimitError', () => {
    it('creates error with retry-after duration', () => {
        const error = new RateLimitError(120);

        expect(error).toBeInstanceOf(Error);
        expect(error.name).toBe('RateLimitError');
        expect(error.retryAfter).toBe(120);
        expect(error.message).toBe('SideShift API rate limit exceeded. Retry after 120 seconds.');
    });

    it('maintains proper stack trace', () => {
        const error = new RateLimitError(60);

        expect(error.stack).toBeDefined();
        expect(error.stack).toContain('RateLimitError');
    });

    it('handles different retry-after durations', () => {
        const shortError = new RateLimitError(30);
        expect(shortError.retryAfter).toBe(30);

        const longError = new RateLimitError(300);
        expect(longError.retryAfter).toBe(300);

        const defaultError = new RateLimitError(60);
        expect(defaultError.retryAfter).toBe(60);
    });
});
