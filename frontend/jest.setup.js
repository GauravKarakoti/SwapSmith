/* eslint-disable no-var */
import '@testing-library/jest-dom';

// ============================================================================
// DOM API Mocks
// ============================================================================

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock localStorage with working implementation
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    key: (index: number) => {
      const keys = Object.keys(store);
      return keys[index] || null;
    },
    get length() {
      return Object.keys(store).length;
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

// Mock sessionStorage with working implementation
const sessionStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    key: (index: number) => {
      const keys = Object.keys(store);
      return keys[index] || null;
    },
    get length() {
      return Object.keys(store).length;
    },
  };
})();

Object.defineProperty(window, 'sessionStorage', {
  value: sessionStorageMock,
  writable: true,
});

// Mock scrollIntoView and window.scrollTo
window.HTMLElement.prototype.scrollIntoView = jest.fn();
window.scrollTo = jest.fn();

// Mock IntersectionObserver
declare const global: any;
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  takeRecords() {
    return [];
  }
  unobserve() {}
};

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
};

// ============================================================================
// Next.js Specific Mocks
// ============================================================================

jest.mock('next/router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    pathname: '/',
    query: {},
    asPath: '/',
    events: {
      on: jest.fn(),
      off: jest.fn(),
      emit: jest.fn(),
    },
  }),
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

jest.mock('next/image', () => ({
  default: ({ src, alt, ...props }: any) => {
    // eslint-disable-next-line jsx-a11y/alt-text
    return <img src={src} alt={alt} {...props} />;
  },
}));

// ============================================================================
// Console Output Management
// ============================================================================

const originalError = console.error;
const originalWarn = console.warn;

beforeAll(() => {
  // Suppress Next.js and React known warnings in test output
  console.error = (...args: any[]) => {
    const message = typeof args[0] === 'string' ? args[0] : '';
    const suppressedErrors = [
      'Warning: useLayoutEffect does nothing on the server',
      'Warning: ReactDOM.render',
      'Not implemented: HTMLFormElement.prototype.submit',
      'You provided a `checked` prop to a form field without an `onChange` handler',
      'Warning: ReactDOM.unmountComponentAtNode',
      'Warning: useId',
    ];

    if (suppressedErrors.some(err => message.includes(err))) {
      return;
    }
    originalError.call(console, ...args);
  };

  console.warn = (...args: any[]) => {
    const message = typeof args[0] === 'string' ? args[0] : '';
    const suppressedWarnings = [
      'componentWillReceiveProps',
      'findDOMNode',
      'Warning: ReactDOM.render',
      'Warning: useId',
    ];

    if (suppressedWarnings.some(warn => message.includes(warn))) {
      return;
    }
    originalWarn.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
  console.warn = originalWarn;
});

// ============================================================================
// Test Cleanup
// ============================================================================

afterEach(() => {
  jest.clearAllMocks();
  localStorageMock.clear();
  sessionStorageMock.clear();
});
