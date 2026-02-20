# Jest & Vitest Configuration for SwapSmith Frontend

This document provides an overview of the Jest testing framework configuration for the SwapSmith frontend application.

## Setup Completed

✅ **Jest Installed** - `npm install --save-dev jest @testing-library/react @testing-library/jest-dom @testing-library/user-event ts-jest jest-environment-jsdom @types/jest`

✅ **Configuration Files Created**:
- `jest.config.ts` - Main Jest configuration
- `jest.setup.ts` - Test environment setup and global mocks

✅ **Test Files Created**:
- `components/__tests__/ChatInterface.test.tsx` - Tests for ChatInterface component
- `components/__tests__/JestSetup.test.tsx` - Basic Jest setup verification tests

✅ **Test Scripts Added to package.json**:
- `npm test` - Run all tests
- `npm test:watch` - Run tests in watch mode
- `npm test:coverage` - Run tests with coverage report

## Project Structure

```
frontend/
├── jest.config.ts              # Jest configuration
├── jest.setup.ts               # Setup file for test environment
├── package.json                # Updated with test scripts
├── components/
│   ├── ChatInterface.tsx        # Component under test
│   └── __tests__/
│       ├── ChatInterface.test.tsx
│       └── JestSetup.test.tsx
└── ...
```

## Available Commands

### Run all tests
```bash
npm test
```

### Run tests in watch mode (re-run on file changes)
```bash
npm test:watch
```

### Run tests with coverage report
```bash
npm test:coverage
```

### Run specific test file
```bash
npm test -- ChatInterface.test.tsx
```

### Run tests matching a pattern
```bash
npm test -- --testNamePattern="renders"
```

## Configuration Details

### jest.config.ts

The Jest configuration includes:

- **Test Environment**: jsdom (for DOM testing)
- **Module Resolution**: Path aliases (@/) configured for project imports
- **TypeScript Support**: ts-jest transformer for .ts and .tsx files
- **Test File Patterns**: 
  - `**/__tests__/**/*.test.ts?(x)`
  - `**/?(*.)+(spec|test).ts?(x)`
- **Coverage**: Configured to collect coverage from components, hooks, etc.

### jest.setup.ts

The setup file includes:

- Import of `@testing-library/jest-dom` for extended matchers
- Suppression of non-critical console warnings
- Hook stubs for Next.js navigation (can be expanded as needed)

## Testing Strategy

### Component Tests

Component tests verify that components:
1. Render correctly
2. Accept user input
3. Display expected messages
4. Handle state changes
5. Manage message history

Example test from `ChatInterface.test.tsx`:
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

External components are mocked in test files:
```typescript
jest.mock('../SwapConfirmation', () => {
  return function MockSwapConfirmation() {
    return <div data-testid="swap-confirmation">Swap Confirmation</div>;
  };
});
```

### Hook Mocks

React hooks and custom hooks are mocked to isolate components:
```typescript
jest.mock('wagmi', () => ({
  useAccount: jest.fn(() => ({
    address: '0x1234567890123456789012345678901234567890',
    isConnected: true,
  })),
}));
```

### Module Mocks

External libraries are mocked to prevent dependency issues:
```typescript
jest.mock('@/hooks/useErrorHandler', () => ({
  useErrorHandler: jest.fn(() => ({
    handleError: jest.fn(),
  })),
}));
```

## Dependencies Installed

- **jest** ^30.2.0 - Testing framework
- **@testing-library/react** ^16.3.2 - React component testing utilities
- **@testing-library/jest-dom** - Extended DOM matchers
- **@testing-library/user-event** - User interaction simulation
- **ts-jest** ^29.4.6 - TypeScript support for Jest
- **jest-environment-jsdom** ^30.2.0 - jsdom test environment
- **@types/jest** - TypeScript types for Jest

## Next Steps

### To write more tests:

1. **Create test file** in `components/__tests__/` directory
2. **Import component** and testing utilities
3. **Mock external dependencies** at the top
4. **Write test cases** using describe/test blocks
5. **Run tests** with `npm test`

### Example test file structure:

```typescript
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock external dependencies
jest.mock('external-library', () => ({...}));

// Import component AFTER mocks
import MyComponent from '../MyComponent';

describe('MyComponent', () => {
  test('renders correctly', () => {
    render(<MyComponent />);
    expect(screen.getByText(/expected text/i)).toBeInTheDocument();
  });
});
```

### Common Testing Patterns:

**Testing component rendering:**
```typescript
test('renders component', () => {
  render(<Component />);
  expect(screen.getByText('expected')).toBeInTheDocument();
});
```

**Testing user input:**
```typescript
test('accepts input', async () => {
  render(<Component />);
  const input = screen.getByRole('textbox');
  await userEvent.type(input, 'test');
  expect(input).toHaveValue('test');
});
```

**Testing button clicks:**
```typescript
test('handles click', async () => {
  render(<Component />);
  const button = screen.getByRole('button');
  await userEvent.click(button);
  expect(screen.getByText('result')).toBeInTheDocument();
});
```

## Troubleshooting

### Tests not found
- Ensure test files are in `__tests__` directory or named `*.test.ts(x)` or `*.spec.ts(x)`
- Check jest.config.ts testMatch patterns

### Module not found errors
- Mock the module in the test file or jest.setup.ts
- Check moduleNameMapper in jest.config.ts for path aliases

### React hooks errors
- Ensure component is wrapped with necessary providers in test
- Mock hooks that require context/providers
- Use `react-dom/test-utils` or `@testing-library/react` render function

### CSS import errors
- Jest ignores CSS by default (configured in moduleNameMapper)
- Add CSS module mock if needed

## Resources

- [Jest Documentation](https://jestjs.io/)
- [React Testing Library](https://testing-library.com/react)
- [Testing Library Best Practices](https://testing-library.com/docs/)

## Current Test Status

Run `npm test` to see current test results. The test suite includes:

- **ChatInterface Component Tests** - Basic rendering and interaction tests
- **Jest Setup Tests** - Verification of testing configuration

Tests verify:
- ✅ Jest is properly configured
- ✅ React components render
- ✅ Testing utilities work correctly
- ✅ Mock functions are available
