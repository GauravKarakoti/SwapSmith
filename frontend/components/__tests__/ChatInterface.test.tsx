import React from 'react';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock all external dependencies BEFORE importing the component
vi.mock('wagmi', () => ({
  useAccount: vi.fn(() => ({
    address: '0x1234567890123456789012345678901234567890',
    isConnected: true,
  })),
}));

vi.mock('@/hooks/useErrorHandler', () => ({
  useErrorHandler: vi.fn(() => ({
    handleError: vi.fn((_err, _type, _options) => 'An error occurred'),
  })),
  ErrorType: {
    VOICE_ERROR: 'VOICE_ERROR',
    NETWORK_ERROR: 'NETWORK_ERROR',
    WALLET_ERROR: 'WALLET_ERROR',
  },
}));

vi.mock('@/hooks/useAudioRecorder', () => ({
  useAudioRecorder: vi.fn(() => ({
    isRecording: false,
    isSupported: false,
    startRecording: vi.fn(),
    stopRecording: vi.fn(),
    error: null,
  })),
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(() => ({
    user: null,
    isAuthenticated: false,
    isLoading: false,
  })),
}));

vi.mock('../SwapConfirmation', () => ({
  default: function MockSwapConfirmation() {
    return <div data-testid="swap-confirmation">Swap Confirmation</div>;
  }
}));

vi.mock('../TrustIndicators', () => ({
  default: function MockTrustIndicators() {
    return <div data-testid="trust-indicators">Trust Indicators</div>;
  }
}));

vi.mock('../IntentConfirmation', () => ({
  default: function MockIntentConfirmation() {
    return <div data-testid="intent-confirmation">Intent Confirmation</div>;
  }
}));

// NOW import the component after mocking dependencies
import ChatInterface from '../ChatInterface';

describe('ChatInterface Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
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
    const user = userEvent.setup();
    render(<ChatInterface />);
    const inputElement = screen.getAllByRole('textbox')[0] as HTMLInputElement;
    
    await act(async () => {
      await user.type(inputElement, 'Swap 10 ETH');
    });
    
    expect(inputElement.value).toBe('Swap 10 ETH');
  });

  test('clears input field when typing', async () => {
    const user = userEvent.setup();
    render(<ChatInterface />);
    const inputElement = screen.getAllByRole('textbox')[0] as HTMLInputElement;
    
    await act(async () => {
      await user.type(inputElement, 'Test');
    });
    expect(inputElement.value).toBe('Test');
    
    await act(async () => {
      await user.clear(inputElement);
    });
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
    
    expect(screen.getByText(/Try our Telegram Bot/i)).toBeInTheDocument();
  });

  test('component has proper structure', () => {
    render(<ChatInterface />);
    
    const container = screen.getByText(/Hello! I can help you swap assets/i);
    expect(container).toBeInTheDocument();
  });

  test('accepts input without crashing', async () => {
    const user = userEvent.setup();
    render(<ChatInterface />);
    const inputElement = screen.getAllByRole('textbox')[0];
    
    await act(async () => {
      await user.type(inputElement, 'Test message for input');
    });
    
    expect(inputElement).toBeInTheDocument();
  });

  test('displays multiple message types', () => {
    render(<ChatInterface />);
    
    expect(screen.getByText(/Hello! I can help you swap assets/i)).toBeInTheDocument();
    expect(screen.getByText(/Tip: Try our Telegram Bot/i)).toBeInTheDocument();
  });
});
