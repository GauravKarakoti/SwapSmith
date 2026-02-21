import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

// Mock all external dependencies BEFORE importing the component
jest.mock('wagmi', () => ({
  useAccount: jest.fn(() => ({
    address: '0x1234567890123456789012345678901234567890',
    isConnected: true,
  })),
}));

jest.mock('@/hooks/useErrorHandler', () => ({
  useErrorHandler: jest.fn(() => ({
    handleError: jest.fn((err, type, options) => 'An error occurred'),
  })),
  ErrorType: {
    VOICE_ERROR: 'VOICE_ERROR',
    NETWORK_ERROR: 'NETWORK_ERROR',
    WALLET_ERROR: 'WALLET_ERROR',
  },
}));

jest.mock('@/hooks/useAudioRecorder', () => ({
  useAudioRecorder: jest.fn(() => ({
    isRecording: false,
    isSupported: false,
    startRecording: jest.fn(),
    stopRecording: jest.fn(),
    error: null,
  })),
}));

jest.mock('@/hooks/useAuth', () => ({
  useAuth: jest.fn(() => ({
    user: null,
    isAuthenticated: false,
    isLoading: false,
  })),
}));

jest.mock('../SwapConfirmation', () => {
  return function MockSwapConfirmation() {
    return <div data-testid="swap-confirmation">Swap Confirmation</div>;
  };
});

jest.mock('../TrustIndicators', () => {
  return function MockTrustIndicators() {
    return <div data-testid="trust-indicators">Trust Indicators</div>;
  };
});

jest.mock('../IntentConfirmation', () => {
  return function MockIntentConfirmation() {
    return <div data-testid="intent-confirmation">Intent Confirmation</div>;
  };
});

// NOW import the component after mocking dependencies
import ChatInterface from '../ChatInterface';

describe('ChatInterface Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
    localStorage.clear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('renders ChatInterface component', () => {
    render(<ChatInterface />);
    expect(screen.getByText(/Hello! I can help you swap assets/i)).toBeInTheDocument();
  });

  test('displays initial greeting message', () => {
    render(<ChatInterface />);
    const greetingText = screen.getByText(/Hello! I can help you swap assets, create payment links, or scout yields/i);
    expect(greetingText).toBeInTheDocument();
  });

  test('renders input field for user messages', () => {
    render(<ChatInterface />);
    const textboxes = screen.getAllByRole('textbox');
    expect(textboxes.length).toBeGreaterThan(0);
  });

  test('allows user to type in the input field', async () => {
    render(<ChatInterface />);
    const inputElement = screen.getAllByRole('textbox')[0] as HTMLInputElement;
    
    await userEvent.type(inputElement, 'Swap 10 ETH');
    
    expect(inputElement.value).toBe('Swap 10 ETH');
  });

  test('clears input field when typing', async () => {
    render(<ChatInterface />);
    const inputElement = screen.getAllByRole('textbox')[0] as HTMLInputElement;
    
    await userEvent.type(inputElement, 'Test');
    expect(inputElement.value).toBe('Test');
    
    await userEvent.clear(inputElement);
    expect(inputElement.value).toBe('');
  });

  test('component renders with wallet connected', () => {
    render(<ChatInterface />);
    expect(screen.getByText(/Hello! I can help you swap assets/i)).toBeInTheDocument();
  });

  test('renders with message history on mount', () => {
    render(<ChatInterface />);
    const greeting = screen.getByText(/Hello! I can help you swap assets/i);
    expect(greeting).toBeInTheDocument();
    
    const tipText = screen.getByText(/Try our Telegram Bot/i);
    expect(tipText).toBeInTheDocument();
  });

  test('component has proper structure', () => {
    render(<ChatInterface />);
    
    const container = screen.getByText(/Hello! I can help you swap assets/i);
    expect(container).toBeInTheDocument();
  });

  test('accepts input without crashing', async () => {
    render(<ChatInterface />);
    const inputElement = screen.getAllByRole('textbox')[0];
    
    await userEvent.type(inputElement, 'Test message for input');
    
    expect(inputElement).toBeInTheDocument();
  });

  test('displays multiple message types', () => {
    render(<ChatInterface />);
    
    expect(screen.getByText(/Hello! I can help you swap assets/i)).toBeInTheDocument();
    expect(screen.getByText(/Tip: Try our Telegram Bot/i)).toBeInTheDocument();
  });
});
