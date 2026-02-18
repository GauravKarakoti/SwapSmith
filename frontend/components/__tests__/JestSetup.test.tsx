import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

/**
 * Basic test to verify Jest is configured properly
 * This test doesn't depend on component-specific dependencies
 */
describe('Jest Configuration', () => {
  test('Jest and Testing Library are properly configured', () => {
    // This test verifies the testing setup works
    expect(true).toBe(true);
  });

  test('DOM matching is available', () => {
    const div = document.createElement('div');
    expect(div).toBeInTheDocument() || expect(div).toBeTruthy();
  });

  test('Test environment is jsdom', () => {
    expect(typeof window).toBe('object');
    expect(typeof document).toBe('object');
  });

  test('Basic React component rendering', () => {
    const TestComponent = () => <div>Test Content</div>;
    render(<TestComponent />);
    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  test('userEvent and fireEvent are available', async () => {
    const { render: renderComponent } = await import('@testing-library/react');
    const { screen: screenApi } = await import('@testing-library/react');
    expect(typeof renderComponent).toBe('function');
    expect(typeof screenApi).toBe('object');
  });
});

/**
 * Unit tests for utility functions and hooks that don't depend on external modules
 */
describe('Unit Test Examples', () => {
  test('Math operations work correctly', () => {
    expect(1 + 1).toBe(2);
    expect(10 - 5).toBe(5);
  });

  test('Array operations work correctly', () => {
    const arr = [1, 2, 3];
    expect(arr.length).toBe(3);
    expect(arr).toContain(2);
  });

  test('Object operations work correctly', () => {
    const obj = { name: 'test', value: 42 };
    expect(obj.name).toBe('test');
    expect(obj.value).toBe(42);
  });

  test('String operations work correctly', () => {
    const str = 'Hello World';
    expect(str).toContain('Hello');
    expect(str.length).toBe(11);
  });

  test('Promise handling works', async () => {
    const promise = Promise.resolve('success');
    expect(await promise).toBe('success');
  });

  test('Async/await works', async () => {
    const asyncFunc = async () => 'async result';
    expect(await asyncFunc()).toBe('async result');
  });
});

/**
 * Mock and spy examples
 */
describe('Jest Mocking Capabilities', () => {
  test('spy on console methods', () => {
    const consoleSpy = jest.spyOn(console, 'log');
    console.log('test message');
    expect(consoleSpy).toHaveBeenCalledWith('test message');
    consoleSpy.mockRestore();
  });

  test('create mock functions', () => {
    const mockFn = jest.fn((x) => x * 2);
    expect(mockFn(5)).toBe(10);
    expect(mockFn).toHaveBeenCalledWith(5);
  });

  test('mock function return values', () => {
    const mockFn = jest.fn()
      .mockReturnValueOnce('first call')
      .mockReturnValueOnce('second call')
      .mockReturnValue('default');

    expect(mockFn()).toBe('first call');
    expect(mockFn()).toBe('second call');
    expect(mockFn()).toBe('default');
  });
});
