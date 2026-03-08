# Frontend Testing Guide

This guide provides comprehensive information about testing in the SwapSmith frontend application using **Vitest** and **Jest**.

## Overview

The frontend uses **Vitest** as the primary test runner with **Jest** available as an alternative. Both include:

- **React Testing Library** for component testing
- **jsdom** environment for DOM mocking
- **Path aliases** for clean imports
- **Code coverage** reporting (70% threshold)
- **Automatic mocking** of Next.js modules and DOM APIs

## Quick Start

### Run Tests

```bash
# Watch mode (development)
npm run test:watch

# Single run (CI)
npm run test

# With coverage report
npm run test:coverage
```

## Test Structure

### File Naming

- **Test files**: `*.test.ts` or `*.test.tsx`
- **Test directories**: `__tests__/` (optional)
- **Location**: Collocate with source or in `__tests__/`

### Example Structure

```
frontend/
├── components/
│   ├── Button.tsx
│   ├── Button.test.tsx
│   └── __tests__/
│       └── Button.integration.test.tsx
├── hooks/
│   ├── useAuth.ts
│   └── useAuth.test.ts
└── __tests__/
    ├── example.test.ts
    └── TestButton.test.tsx
```

## Writing Tests

### Unit Test Example

```typescript
import { describe, it, expect } from 'vitest';

describe('Utils', () => {
  it('should add numbers correctly', () => {
    expect(2 + 3).toBe(5);
  });

  it('should handle negative numbers', () => {
    expect(-1 + 1).toBe(0);
  });
});
```

### Component Test Example

```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from '@/components/Button';

describe('Button', () => {
  it('should render with text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button')).toHaveTextContent('Click me');
  });

  it('should call onClick when clicked', async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();
    
    render(<Button onClick={handleClick}>Click</Button>);
    await user.click(screen.getByRole('button'));
    
    expect(handleClick).toHaveBeenCalledOnce();
  });
});
```

### Hook Test Example

```typescript
import { renderHook, act } from '@testing-library/react';
import { useCounter } from '@/hooks/useCounter';

describe('useCounter', () => {
  it('should increment counter', () => {
    const { result } = renderHook(() => useCounter());
    
    act(() => {
      result.current.increment();
    });
    
    expect(result.current.count).toBe(1);
  });
});
```

## Configuration

### Vitest (`vitest.config.mts`)

Key features:

- **Environment**: jsdom (browser-like)
- **Globals**: Enabled (describe, it, expect available without imports)
- **Setup Files**: `vitest.setup.ts`
- **Path Aliases**: `@/` and `shared/`
- **Coverage Threshold**: 70% minimum
- **Isolation**: Tests run in separate processes

### Vitest Setup (`vitest.setup.ts`)

Automatically mocks:

**DOM APIs:**
- `window.matchMedia` - Media queries
- `localStorage` - Full implementation
- `sessionStorage` - Full implementation
- `scrollIntoView`, `scrollTo` - Scroll APIs
- `IntersectionObserver`, `ResizeObserver` - Observer APIs

**Next.js Modules:**
- `next/router` - useRouter hook
- `next/navigation` - Navigation hooks
- `next/image` - Image component

### Jest Alternative (`jest.config.js`)

For Jest-based testing:

```bash
# Install Jest dependencies
npm install --save-dev jest ts-jest @types/jest jest-junit identity-obj-proxy

# Use Jest instead of Vitest
# Update package.json: "test": "jest"
npm test
```

Jest setup in `jest.setup.js` provides same mocks and configuration.

## Mocking

### Automatic Mocks

Already mocked in setup files - no action needed.

### Custom Module Mocks

```typescript
import { vi } from 'vitest';

// Mock entire module
vi.mock('@/lib/api', () => ({
  fetchData: vi.fn(() => Promise.resolve({ data: 'test' })),
}));

// Mock function
const mockFetch = vi.fn(() =>
  Promise.resolve({ json: () => ({ data: 'test' }) })
);
global.fetch = mockFetch;

// Mock with implementation
const mockWrite = vi.fn().mockImplementation((text) => text.length);

// Use in test
await mockWrite('Hello');
expect(mockWrite).toHaveBeenCalledWith('Hello');
expect(mockWrite).toHaveReturnedWith(5);
```

## Coverage

### Generate Coverage

```bash
npm run test:coverage
```

Generates:
- **Terminal summary** - In console
- **HTML report** - `coverage/index.html`
- **LCOV report** - `coverage/lcov.info`
- **JSON summary** - `coverage/coverage-summary.json`

### Coverage Thresholds

Set in `vitest.config.mts`:

```
lines: 70    - Minimum 70% of lines
functions: 70 - Minimum 70% of functions
branches: 70 - Minimum 70% of branches
statements: 70 - Minimum 70% of statements
```

Tests fail if coverage drops below these levels.

### Excluded Files

- `node_modules/`, `dist/`, `.next/`
- Configuration files (`*.config.*`)
- Type definitions (`*.d.ts`)
- Test files (`**/__tests__/**`, `**/*.test.*`)
- Special files: `instrumentation.ts`, `middleware.ts`

## Debugging

### VS Code Debugging

Add to `.vscode/launch.json`:

```json
{
  "type": "node",
  "request": "launch",
  "name": "Debug Vitest",
  "runtimeExecutable": "${workspaceFolder}/node_modules/.bin/vitest",
  "args": ["--inspect-brk", "--no-coverage"],
  "console": "integratedTerminal"
}
```

### Console Output

```bash
# Verbose test names and output
npm run test -- --reporter=verbose

# Show detailed coverage
npm run test -- --coverage --all

# Single test file
npm run test -- components/Button.test.tsx

# Watch single file
npm run test:watch -- components/Button.test.tsx
```

### Run Specific Tests

```typescript
// Run only this test
it.only('should test this', () => {
  expect(true).toBe(true);
});

// Skip this test
it.skip('should skip', () => {
  expect(true).toBe(true);
});
```

## Best Practices

### 1. Test Behavior, Not Implementation

```typescript
// ✅ Good - Tests observable behavior
it('should disable submit when form is invalid', async () => {
  render(<Form />);
  const submit = screen.getByRole('button', { name: /submit/i });
  expect(submit).toBeDisabled();
});

// ❌ Bad - Tests internal state
it('should set state to false', () => {
  const { result } = renderHook(() => useState(false));
  // Directly testing state is fragile
});
```

### 2. Use Semantic Queries

```typescript
// ✅ Good - Match user perspective
screen.getByRole('button', { name: /submit/i });
screen.getByLabelText(/email/i);
screen.getByPlaceholderText(/search/i);
screen.getByText(/welcome/i);

// ❌ Bad - Implementation-dependent
screen.getByTestId('submit-btn');
wrapper.find('.button');
```

### 3. Simulate User Actions

```typescript
// ✅ Good - Real user interactions
const user = userEvent.setup();
await user.click(screen.getByRole('button'));
await user.type(screen.getByRole('textbox'), 'text');

// ❌ Bad - Bypasses validation
fireEvent.click(button);
```

### 4. Wait for Async Content

```typescript
// ✅ Good - Wait for element
const element = await screen.findByText('Loaded');

// ❌ Bad - Sync query for async content
const element = screen.getByText('Loaded');
```

### 5. Cleanup Automatic

```typescript
// Vitest handles cleanup:
// - Mocks cleared and restored
// - localStorage/sessionStorage cleared
// - No manual cleanup needed
```

## Common Patterns

### Testing Form Submission

```typescript
it('should submit form with valid data', async () => {
  const user = userEvent.setup();
  const mockSubmit = vi.fn();
  
  render(<ContactForm onSubmit={mockSubmit} />);
  
  await user.type(screen.getByLabelText(/email/i), 'test@example.com');
  await user.click(screen.getByRole('button', { name: /submit/i }));
  
  expect(mockSubmit).toHaveBeenCalledWith(
    expect.objectContaining({ email: 'test@example.com' })
  );
});
```

### Testing Async API Calls

```typescript
it('should load and display user data', async () => {
  const mockUser = { id: 1, name: 'John' };
  
  vi.spyOn(global, 'fetch').mockResolvedValueOnce(
    { ok: true, json: () => mockUser } as Response
  );
  
  render(<UserProfile userId={1} />);
  
  expect(await screen.findByText('John')).toBeInTheDocument();
});
```

### Testing Error Scenarios

```typescript
it('should display error message on API failure', async () => {
  vi.spyOn(global, 'fetch').mockRejectedValueOnce(
    new Error('Network error')
  );
  
  render(<DataComponent />);
  
  expect(await screen.findByText(/error/i)).toBeInTheDocument();
});
```

### Testing Hooks with Providers

```typescript
const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <AuthProvider>
      <ThemeProvider>
        {component}
      </ThemeProvider>
    </AuthProvider>
  );
};

it('should apply theme from context', () => {
  renderWithProviders(<ThemedComponent />);
  expect(screen.getByRole('button')).toHaveClass('dark-theme');
});
```

## CI/CD Integration

Tests run automatically on pull requests via GitHub Actions:

- **PR Checks Workflow**: Runs on all PRs
- **Coverage Reports**: Generated and archived
- **Build Verification**: Tests must pass before merge

### Local CI Simulation

```bash
# Run as CI would (single run, with coverage)
npm run test -- --coverage
```

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
- [Jest Documentation](https://jestjs.io/)

## Troubleshooting

### Tests Not Found

- Verify file naming: `*.test.ts(x)` or `*.spec.ts(x)`
- Check include patterns in `vitest.config.mts`
- Ensure `__tests__/` directory is readable

### Module Not Found

```typescript
// Check vitest.config.mts path aliases
// Add missing alias or fix import path
import { Button } from '@/components/Button'; // Uses @ alias
```

### Test Timeout

```typescript
// Increase timeout in vitest.config.mts
testTimeout: 10000, // 10 seconds
hookTimeout: 10000,

// Or per-test:
it('slow test', async () => {
  // ...
}, { timeout: 20000 });
```

### Mock Not Working

```typescript
// Clear previous mock definitions
vi.clearAllMocks();

// Reset modules
vi.resetModules();
```

## Next Steps

1. **Write tests** for critical components
2. **Monitor coverage** - Aim for 80%+
3. **Add E2E tests** - Consider Playwright for integration testing
4. **Integrate with CI** - Tests run on every PR (already configured)

---

**Last Updated**: March 2026  
**Test Runner**: Vitest 4.0.18 (Jest alternative available)  
**Coverage Target**: 70% minimum threshold
