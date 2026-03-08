/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { detectBrowser, checkVoiceCapabilities, getVoiceErrorMessage } from '../browser-detection';

// Mock window properties
const mockWindow = (userAgent: string, speechRecognition = false, webkitSpeechRecognition = false) => {
  Object.defineProperty(window.navigator, 'userAgent', {
    writable: true,
    value: userAgent,
  });

  if (speechRecognition) {
    (window as any).SpeechRecognition = vi.fn();
  } else {
    delete (window as any).SpeechRecognition;
  }

  if (webkitSpeechRecognition) {
    (window as any).webkitSpeechRecognition = vi.fn();
  } else {
    delete (window as any).webkitSpeechRecognition;
  }

  // Mock MediaRecorder
  (window as any).MediaRecorder = {
    isTypeSupported: vi.fn(() => true),
  };

  // Mock navigator.mediaDevices
  Object.defineProperty(window.navigator, 'mediaDevices', {
    writable: true,
    value: {
      getUserMedia: vi.fn(),
    },
  });

  // Mock secure context
  Object.defineProperty(window, 'isSecureContext', {
    writable: true,
    value: true,
  });
};

describe('Browser Detection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('detectBrowser', () => {
    it('should detect Firefox', () => {
      mockWindow('Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:91.0) Gecko/20100101 Firefox/91.0');
      const browser = detectBrowser();
      
      expect(browser.name).toBe('Firefox');
      expect(browser.isFirefox).toBe(true);
      expect(browser.isChrome).toBe(false);
      expect(browser.isEdge).toBe(false);
      expect(browser.isSafari).toBe(false);
    });

    it('should detect Chrome', () => {
      mockWindow('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
      const browser = detectBrowser();
      
      expect(browser.name).toBe('Chrome');
      expect(browser.isChrome).toBe(true);
      expect(browser.isFirefox).toBe(false);
      expect(browser.isEdge).toBe(false);
      expect(browser.isSafari).toBe(false);
    });

    it('should detect Edge', () => {
      mockWindow('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36 Edg/91.0.864.59');
      const browser = detectBrowser();
      
      expect(browser.name).toBe('Edge');
      expect(browser.isEdge).toBe(true);
      expect(browser.isChrome).toBe(false); // Edge contains "chrome" but should be detected as Edge
      expect(browser.isFirefox).toBe(false);
      expect(browser.isSafari).toBe(false);
    });

    it('should detect Safari', () => {
      mockWindow('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15');
      const browser = detectBrowser();
      
      expect(browser.name).toBe('Safari');
      expect(browser.isSafari).toBe(true);
      expect(browser.isChrome).toBe(false);
      expect(browser.isFirefox).toBe(false);
      expect(browser.isEdge).toBe(false);
    });

    it('should detect mobile browsers', () => {
      mockWindow('Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1');
      const browser = detectBrowser();
      
      expect(browser.isMobile).toBe(true);
    });
  });

  describe('checkVoiceCapabilities', () => {
    it('should recommend speech-api for Chrome with SpeechRecognition', () => {
      mockWindow('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/91.0.4472.124 Safari/537.36', true);
      const capabilities = checkVoiceCapabilities();
      
      expect(capabilities.recommendedMethod).toBe('speech-api');
      expect(capabilities.supportLevel).toBe('full');
      expect(capabilities.hasSpeechRecognition).toBe(true);
    });

    it('should recommend media-recorder for Firefox', () => {
      mockWindow('Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:91.0) Gecko/20100101 Firefox/91.0');
      const capabilities = checkVoiceCapabilities();
      
      expect(capabilities.recommendedMethod).toBe('media-recorder');
      expect(capabilities.supportLevel).toBe('partial');
      expect(capabilities.hasSpeechRecognition).toBe(false);
      expect(capabilities.userMessage).toContain('Firefox');
    });

    it('should handle webkit SpeechRecognition', () => {
      mockWindow('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15', false, true);
      const capabilities = checkVoiceCapabilities();
      
      expect(capabilities.recommendedMethod).toBe('speech-api');
      expect(capabilities.hasSpeechRecognition).toBe(true);
    });

    it('should handle insecure context', () => {
      mockWindow('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/91.0.4472.124 Safari/537.36', true);
      
      // Override secure context after mockWindow
      Object.defineProperty(window, 'isSecureContext', {
        writable: true,
        value: false,
      });
      Object.defineProperty(window.location, 'protocol', {
        writable: true,
        value: 'http:',
      });
      Object.defineProperty(window.location, 'hostname', {
        writable: true,
        value: 'example.com',
      });
      
      const capabilities = checkVoiceCapabilities();
      
      expect(capabilities.supportLevel).toBe('none');
      expect(capabilities.recommendedMethod).toBe(null);
    });
  });

  describe('getVoiceErrorMessage', () => {
    it('should provide Firefox-specific error messages', () => {
      const firefoxBrowser = {
        name: 'Firefox',
        version: '91',
        isFirefox: true,
        isChrome: false,
        isEdge: false,
        isSafari: false,
        isMobile: false,
        isSecureContext: true,
      };

      const message = getVoiceErrorMessage('not-allowed', firefoxBrowser);
      expect(message).toContain('Firefox');
      expect(message).toContain('refresh the page');
    });

    it('should provide generic error messages for other browsers', () => {
      const chromeBrowser = {
        name: 'Chrome',
        version: '91',
        isFirefox: false,
        isChrome: true,
        isEdge: false,
        isSafari: false,
        isMobile: false,
        isSecureContext: true,
      };

      const message = getVoiceErrorMessage('not-allowed', chromeBrowser);
      expect(message).not.toContain('Firefox');
      expect(message).toContain('browser settings');
    });

    it('should handle network errors appropriately', () => {
      const firefoxBrowser = {
        name: 'Firefox',
        version: '91',
        isFirefox: true,
        isChrome: false,
        isEdge: false,
        isSafari: false,
        isMobile: false,
        isSecureContext: true,
      };

      const message = getVoiceErrorMessage('network', firefoxBrowser);
      expect(message).toContain('offline');
    });
  });
});