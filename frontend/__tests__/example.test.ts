import { describe, it, expect, beforeEach } from 'vitest';

// Example test suite for basic functionality
describe('Example Test Suite', () => {
  let value: number;

  beforeEach(() => {
    value = 0;
  });

  it('should increment value', () => {
    value++;
    expect(value).toBe(1);
  });

  it('should have correct initial value', () => {
    expect(value).toBe(0);
  });

  it('should support multiple increments', () => {
    value++;
    value++;
    value += 3;
    expect(value).toBe(5);
  });
});
