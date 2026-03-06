# Frontend Testing Guide - Vitest & Testing Library

This document provides a comprehensive guide for testing the SwapSmith frontend application using **Vitest** and **React Testing Library**.

## ✅ Setup Complete

- ✅ **Vitest Installed** - Modern, fast unit testing framework with Vite integration
- ✅ **Testing Library** - `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`
- ✅ **Configuration Files**:
  - `vitest.config.mts` - Complete Vitest configuration with coverage settings
  - `vitest.setup.ts` - Test environment setup with comprehensive mocks (localStorage, ResizeObserver, IntersectionObserver, etc.)

- ✅ **Example Tests Created**:
  - `__tests__/example.test.ts` - Basic unit test examples
  - `__tests__/TestButton.test.tsx` - React component test example

- ✅ **Test Scripts in package.json**:
  - `npm test` - Run all tests once
  - `npm test:watch` - Run tests in watch mode (re-run on file changes)
  - `npm test:coverage` - Generate coverage report

## Project Structure

```
frontend/
├── vitest.config.mts           # Vitest configuration
├── vitest.setup.ts             # Setup file for test environment
├── package.json                # Updated with test scripts
├── __tests__/
│   ├── example.test.ts         # Basic test examples
│   ├── TestButton.test.tsx     # React component test example
│   └── ...
├── components/
│   ├── YourComponent.tsx
│   └── __tests__/
│       └── YourComponent.test.tsx
└── ...
```

## Quick Start

### Running Tests

```bash
# Run all tests once
npm test

# Run tests in watch mode (recommended during development)
npm test:watch

# Generate coverage report
npm test:coverage

# Run specific test file
npm test -- example.test.ts

# Run tests matching a pattern
npm test -- --grep "Button"
```

## Writing Tests

### Basic Unit Test

```typescript
import { describe, it, expect, beforeEach } from 'vitest';

describe('Calculator', () => {
  let calculator: Calculator;

  beforeEach(() => {
    calculator = new Calculator();
  });

  it('should add two numbers correctly', () => {
    expect(calculator.add(2, 3)).toBe(5);
  });

  it('should subtract two numbers correctly', () => {
    expect(calculator.subtract(5, 3)).toBe(2);
  });
});
```

### React Component Test

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MyComponent from '@/components/MyComponent';

describe('MyComponent', () => {
  it('should render the component', () => {
    render(<MyComponent />);
    expect(screen.getByText('Expected Text')).toBeInTheDocument();
  });

  it('should handle button clicks', () => {
    render(<MyComponent />);
    const button = screen.getByRole('button');
    fireEvent.click(button);
    
    expect(screen.getByText('Updated Text')).toBeInTheDocument();
  });

  it('should accept props', () => {
    render(<MyComponent title="Test Title" />);
    expect(screen.getByText('Test Title')).toBeInTheDocument();
  });
});
```

## Configuration Details

### vitest.config.mts

Key features:
- **Environment**: jsdom for DOM testing
- **Globals**: true (describe, it, expect available without imports)
- **Test File Pattern**: `**/__tests__/**/*.test.{ts,tsx}` and `**/*.test.{ts,tsx}`
- **Coverage**: v8 provider with html, json, text, and lcov reporters
- **Aliases**: Path aliases (@/ and shared/) configured for clean imports
- **Timeouts**: 10 seconds for tests and hooks

### vitest.setup.ts

Setup file includes mocks for:
- **localStorage** & **sessionStorage** - Fully mocked storage APIs
- **window.matchMedia** - CSS media query mocking
- **scrollIntoView** & **scrollTo** - Scroll API mocking
- **IntersectionObserver** & **ResizeObserver** - Observer API mocking
- **Console filtering** - Suppresses non-critical warnings
- **Auto-cleanup** - Clears mocks and storage after each test

## Best Practices

### 1. Test Naming

✅ **Do:**
```typescript
it('should display user name when auth token exists', () => {
```

❌ **Don't:**
```typescript
it('works', () => {
```

### 2. Arrange-Act-Assert Pattern

```typescript
it('should update user profile', () => {
  // Arrange
  const user = { id: 1, name: 'John' };
  
  // Act
  render(<UserProfile user={user} />);
  const button = screen.getByRole('button');
  fireEvent.click(button);
  
  // Assert
  expect(screen.getByText('Profile Updated')).toBeInTheDocument();
});
```

### 3. Use Query Selectors Appropriately

Preference order (most specific to least):
```typescript
// Most specific - use these!
screen.getByRole('button', { name: /submit/i })
screen.getByLabelText(/password/i)
screen.getByPlaceholderText(/search/i)
screen.getByText(/hello/i)

// Less ideal
screen.getByTestId('submit-button')
screen.querySelector('.button')
```

### 4. Testing User Interactions

```typescript
import userEvent from '@testing-library/user-event';

it('should handle form submission', async () => {
  const user = userEvent.setup();
  render(<LoginForm />);
  
  await user.type(screen.getByLabelText(/email/i), 'test@example.com');
  await user.click(screen.getByRole('button', { name: /submit/i }));
  
  expect(screen.getByText(/success/i)).toBeInTheDocument();
});
```

## Common Testing Scenarios

### Testing Async Operations

```typescript
import { waitFor } from '@testing-library/react';

it('should load data on mount', async () => {
  render(<DataFetcher />);
  
  await waitFor(() => {
    expect(screen.getByText('Data Loaded')).toBeInTheDocument();
  });
});
```

### Mocking API Calls

```typescript
import { vi } from 'vitest';

it('should handle API errors gracefully', async () => {
  const mockFetch = vi.spyOn(global, 'fetch').mockRejectedValueOnce(
    new Error('Network error')
  );
  
  render(<DataFetcher />);
  
  await waitFor(() => {
    expect(screen.getByText(/error/i)).toBeInTheDocument();
  });
  
  mockFetch.mockRestore();
});
```

### Testing Context Providers

```typescript
import { ThemeProvider } from '@/contexts/ThemeContext';

const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider>
      {component}
    </ThemeProvider>
  );
};

it('should apply theme styles', () => {
  renderWithTheme(<ThemedComponent />);
  expect(screen.getByRole('button')).toHaveClass('dark-mode');
});
```

## Debugging Tests

### Debug Rendered Output

```typescript
import { render, screen, debug } from '@testing-library/react';

it('should render correctly', () => {
  render(<MyComponent />);
  debug(); // Prints the DOM to console
});
```

### Use screen.logTestingPlaygroundURL()

```typescript
it('should work', () => {
  render(<MyComponent />);
  screen.logTestingPlaygroundURL();
});
```

## Coverage Goals

- **Statements**: 80%+
- **Branches**: 75%+
- **Functions**: 80%+
- **Lines**: 80%+

View coverage report:
```bash
npm test:coverage
# Open coverage/index.html in browser
```

## Next Steps

1. **Write tests for existing components** - Start with critical user-facing components
2. **Setup CI/CD integration** - Run tests on each pull request
3. **Add E2E tests** - Consider Playwright for integration testing
4. **Monitor coverage** - Track coverage trends over time

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Testing Library Documentation](https://testing-library.com/)
- [React Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)

```typescript
test('renders ChatInterface component', () => {
  render(<ChatInterface />);
  expect(screen.getByText(/Hello! I can help you swap assets/i)).toBeInTheDocument();
});
```

### Unit Tests

Basic unit tests verify:
- Jest configuration is correct
- Testing library functions are available
- React component rendering works
- Mocking capabilities function properly

## Mocking Strategy

### Component Mocks

External components are mocked in test files using vi.mock():
```typescript
import { vi } from 'vitest';

vi.mock('../SwapConfirmation', () => ({
  default: function MockSwapConfirmation() {
    return <div data-testid="swap-confirmation">Swap Confirmation</div>;
  }
}));
```

### Hook Mocks

React hooks and custom hooks are mocked to isolate components:
```typescript
import { vi } from 'vitest';

vi.mock('wagmi', () => ({
  useAccount: vi.fn(() => ({
    address: '0x1234567890123456789012345678901234567890',
    isConnected: true,
  })),
}));
```

### Module Mocks

External libraries are mocked to prevent dependency issues:
```typescript
import { vi } from 'vitest';

vi.mock('@/hooks/useErrorHandler', () => ({
  useErrorHandler: vi.fn(() => ({
    handleError: vi.fn(),
  })),
}));
```

## Dependencies Installed

- **vitest** ^4.0.18 - Fast unit testing framework
- **@testing-library/react** ^16.3.2 - React component testing utilities
- **@testing-library/jest-dom** ^6.9.1 - Extended DOM matchers
- **@testing-library/user-event** ^14.6.1 - User interaction simulation
- **jsdom** ^28.1.0 - jsdom test environment
- **@vitejs/plugin-react** ^5.1.4 - Vite React plugin
- **@vitest/coverage-v8** ^4.0.18 - Coverage reporting

## Next Steps

### To write more tests:

1. **Create test file** in `__tests__/` directory or name it `*.test.ts(x)`
2. **Import testing utilities** from vitest and @testing-library/react
3. **Mock external dependencies** using vi.mock()
4. **Write test cases** using describe/it blocks
5. **Run tests** with `npm test`

### Example test file structure:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock external dependencies
vi.mock('external-library', () => ({...}));

// Import component AFTER mocks
import MyComponent from '../MyComponent';

describe('MyComponent', () => {
  it('should render correctly', () => {
    render(<MyComponent />);
    expect(screen.getByText(/expected text/i)).toBeInTheDocument();
  });
});
```

### Common Testing Patterns:

**Testing component rendering:**
```typescript
import { it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

it('should render component', () => {
  render(<Component />);
  expect(screen.getByText('expected')).toBeInTheDocument();
});
```

**Testing user input:**
```typescript
import { it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

it('should accept input', async () => {
  const user = userEvent.setup();
  render(<Component />);
  const input = screen.getByRole('textbox');
  await user.type(input, 'test');
  expect(input).toHaveValue('test');
});
```

**Testing button clicks:**
```typescript
import { it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

it('should handle click', async () => {
  const user = userEvent.setup();
  render(<Component />);
  const button = screen.getByRole('button');
  await user.click(button);
  expect(screen.getByText('result')).toBeInTheDocument();
});
```

## Troubleshooting

### Tests not found
- Ensure test files are in `__tests__/` directory or named `*.test.ts(x)` or `*.spec.ts(x)`
- Check vitest.config.mts include patterns

### Module not found errors
- Mock the module using vi.mock() in the test file or vitest.setup.ts
- Check alias configuration in vitest.config.mts for path aliases

### React hooks errors
- Ensure component is wrapped with necessary providers in test
- Mock hooks that require context/providers using vi.mock()
- Use `@testing-library/react` render function

### CSS import errors
- Vitest with jsdom handles CSS imports gracefully
- Add CSS module mock if needed using moduleNameMapper equivalent

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [Testing Library Best Practices](https://testing-library.com/docs/)

## Current Test Status

Run `npm test` to see current test results. The test suite includes:

- **Example Tests** - Basic unit test examples and patterns
- **TestButton Component Tests** - React component test examples

Tests verify:
- ✅ Vitest is properly configured
- ✅ React components render
- ✅ Testing utilities work correctly
- ✅ Mock functions are available
