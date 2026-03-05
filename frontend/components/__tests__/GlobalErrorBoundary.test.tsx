import React from 'react';
import { render, screen } from '@testing-library/react';
import GlobalErrorBoundary from '../GlobalErrorBoundary';

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

const toastError = jest.fn();

jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: {
    error: (...args: unknown[]) => toastError(...args),
  },
}));

function ThrowingComponent() {
  throw new Error('Boom');
}

describe('GlobalErrorBoundary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the fallback UI when a child throws', () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <GlobalErrorBoundary>
        <ThrowingComponent />
      </GlobalErrorBoundary>
    );

    expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument();
    expect(screen.getByText(/rendering error interrupted this screen/i)).toBeInTheDocument();
    expect(toastError).toHaveBeenCalledWith(
      'The app hit an unexpected error. You can retry without losing the whole page.'
    );

    consoleErrorSpy.mockRestore();
  });
});
