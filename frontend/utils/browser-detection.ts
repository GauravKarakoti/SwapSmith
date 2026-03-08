/**
 * Browser detection and voice input compatibility utilities
 */

export interface BrowserInfo {
  name: string;
  version: string;
  isFirefox: boolean;
  isChrome: boolean;
  isEdge: boolean;
  isSafari: boolean;
  isMobile: boolean;
  isSecureContext: boolean;
}

export interface VoiceCapabilities {
  hasSpeechRecognition: boolean;
  hasMediaRecorder: boolean;
  hasGetUserMedia: boolean;
  isSecureContext: boolean;
  recommendedMethod: 'speech-api' | 'media-recorder' | null;
  supportLevel: 'full' | 'partial' | 'none';
  userMessage: string;
}

/**
 * Detect browser information
 */
export function detectBrowser(): BrowserInfo {
  const userAgent = navigator.userAgent.toLowerCase();
  
  const isFirefox = userAgent.includes('firefox');
  const isChrome = userAgent.includes('chrome') && !userAgent.includes('edge');
  const isEdge = userAgent.includes('edge') || userAgent.includes('edg/');
  const isSafari = userAgent.includes('safari') && !userAgent.includes('chrome');
  const isMobile = userAgent.includes('mobile') || userAgent.includes('android') || userAgent.includes('iphone');
  
  let name = 'Unknown';
  if (isFirefox) name = 'Firefox';
  else if (isEdge) name = 'Edge';  // Check Edge before Chrome since Edge UA contains "chrome"
  else if (isChrome) name = 'Chrome';
  else if (isSafari) name = 'Safari';

  // Extract version (simplified)
  let version = 'Unknown';
  const versionMatch = userAgent.match(new RegExp(`${name.toLowerCase()}[/\\s](\\d+)`));
  if (versionMatch) {
    version = versionMatch[1];
  }

  const isSecureContext = window.isSecureContext || 
                         location.protocol === 'https:' || 
                         location.hostname === 'localhost' ||
                         location.hostname === '127.0.0.1';

  return {
    name,
    version,
    isFirefox,
    isChrome,
    isEdge,
    isSafari,
    isMobile,
    isSecureContext
  };
}

/**
 * Check voice input capabilities for the current browser
 */
export function checkVoiceCapabilities(): VoiceCapabilities {
  const browser = detectBrowser();
  
  // Check Speech Recognition API
  const hasSpeechRecognition = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  
  // Check MediaRecorder API
  const hasMediaRecorder = typeof MediaRecorder !== 'undefined' && 
                           typeof MediaRecorder.isTypeSupported === 'function';
  
  // Check getUserMedia API
  const hasGetUserMedia = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  
  let recommendedMethod: 'speech-api' | 'media-recorder' | null = null;
  let supportLevel: 'full' | 'partial' | 'none' = 'none';
  let userMessage = '';

  // Determine support level and recommended method
  if (browser.isFirefox) {
    if (hasMediaRecorder && hasGetUserMedia && browser.isSecureContext) {
      recommendedMethod = 'media-recorder';
      supportLevel = 'partial';
      userMessage = 'Firefox: Voice recording available (requires server transcription)';
    } else if (!browser.isSecureContext) {
      userMessage = 'Firefox requires HTTPS for voice input. Please use a secure connection.';
    } else {
      userMessage = 'Firefox: Voice input not available. Please update your browser or type your message.';
    }
  } else if (browser.isChrome || browser.isEdge) {
    if (hasSpeechRecognition) {
      recommendedMethod = 'speech-api';
      supportLevel = 'full';
      userMessage = `${browser.name}: Real-time voice recognition available`;
    } else if (hasMediaRecorder && hasGetUserMedia && browser.isSecureContext) {
      recommendedMethod = 'media-recorder';
      supportLevel = 'partial';
      userMessage = `${browser.name}: Voice recording available (server transcription)`;
    } else {
      userMessage = `${browser.name}: Voice input disabled. Check browser permissions.`;
    }
  } else if (browser.isSafari) {
    if (hasSpeechRecognition) {
      recommendedMethod = 'speech-api';
      supportLevel = 'full';
      userMessage = 'Safari: Voice recognition available (webkit)';
    } else if (hasMediaRecorder && hasGetUserMedia && browser.isSecureContext) {
      recommendedMethod = 'media-recorder';
      supportLevel = 'partial';
      userMessage = 'Safari: Voice recording available';
    } else {
      userMessage = 'Safari: Voice recognition may require user interaction to activate';
    }
  } else {
    // Unknown browser
    if (hasSpeechRecognition) {
      recommendedMethod = 'speech-api';
      supportLevel = 'full';
      userMessage = 'Voice recognition available';
    } else if (hasMediaRecorder && hasGetUserMedia && browser.isSecureContext) {
      recommendedMethod = 'media-recorder';
      supportLevel = 'partial';
      userMessage = 'Voice recording available';
    } else {
      userMessage = 'Voice input not supported in this browser. Please use Chrome, Edge, or Safari.';
    }
  }

  // Additional context for mobile
  if (browser.isMobile && supportLevel !== 'none') {
    userMessage += ' (Mobile: May require additional permissions)';
  }

  // Security context warning
  if (!browser.isSecureContext && supportLevel !== 'none') {
    userMessage += ' (Requires HTTPS or localhost)';
    supportLevel = 'none';
    recommendedMethod = null;
  }

  return {
    hasSpeechRecognition,
    hasMediaRecorder,
    hasGetUserMedia,
    isSecureContext: browser.isSecureContext,
    recommendedMethod,
    supportLevel,
    userMessage
  };
}

/**
 * Get user-friendly error message for voice input failures
 */
export function getVoiceErrorMessage(error: string, browser?: BrowserInfo): string {
  const browserInfo = browser || detectBrowser();
  
  switch (error) {
    case 'not-allowed':
      if (browserInfo.isFirefox) {
        return 'Firefox: Microphone permission denied. Please allow access in browser settings and refresh the page.';
      }
      return 'Microphone permission denied. Please allow access in your browser settings.';
      
    case 'not-found':
      return 'No microphone found. Please connect a microphone and try again.';
      
    case 'not-readable':
      return 'Microphone is already in use by another application. Please close other apps using the microphone.';
      
    case 'network':
      if (browserInfo.isFirefox) {
        return 'Firefox: Network error. Voice recording will work offline.';
      }
      return 'Network error occurred. Switching to offline voice recording...';
      
    case 'service-not-allowed':
      return 'Speech service unavailable. Using local audio recording instead...';
      
    case 'audio-capture':
      return 'No microphone access. Please check your microphone connection and permissions.';
      
    default:
      if (browserInfo.isFirefox) {
        return `Firefox: ${error}. Try using voice recording mode instead.`;
      }
      return `Voice input error: ${error}. Please try again or type your message.`;
  }
}