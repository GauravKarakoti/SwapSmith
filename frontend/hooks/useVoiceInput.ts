import { useState, useEffect, useRef, useCallback } from 'react';
import { detectBrowser, checkVoiceCapabilities, getVoiceErrorMessage } from '@/utils/browser-detection';

// Web Speech API globals (e.g. SpeechRecognition) are declared in frontend/types/speech-recognition.d.ts;
// this hook still checks support dynamically and uses those globals only when available.


export type VoiceInputMethod = 'speech-api' | 'media-recorder' | null;

export interface BrowserCompatibility {
  hasSpeechAPI: boolean;
  hasMediaRecorder: boolean;
  hasGetUserMedia: boolean;
  recommendedMethod: VoiceInputMethod;
  warnings: string[];
}

export interface UseVoiceInputReturn {
  isListening: boolean;
  transcript: string;
  interimTranscript: string;
  isSupported: boolean;
  inputMethod: VoiceInputMethod;
  compatibility: BrowserCompatibility;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<Blob | null>;
  error: string | null;
  resetTranscript: () => void;
  retryCount: number;
}

interface VoiceInputConfig {
  onError?: (error: string) => void;
  onTranscriptChange?: (transcript: string) => void;
}

export const useVoiceInput = (config: VoiceInputConfig = {}): UseVoiceInputReturn => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [isSupported, setIsSupported] = useState(true);
  const [inputMethod, setInputMethod] = useState<VoiceInputMethod>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [compatibility, setCompatibility] = useState<BrowserCompatibility>({
    hasSpeechAPI: false,
    hasMediaRecorder: false,
    hasGetUserMedia: false,
    recommendedMethod: null,
    warnings: [],
  });

  // Refs for Speech Recognition
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const hasSpeechApi = useRef(false);

  // Refs for MediaRecorder
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  // Retry configuration
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 1000; // 1 second

  // Check support on mount using enhanced browser detection
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const browserInfo = detectBrowser();
    const capabilities = checkVoiceCapabilities();
    
    hasSpeechApi.current = capabilities.hasSpeechRecognition;

    const compat: BrowserCompatibility = {
      hasSpeechAPI: capabilities.hasSpeechRecognition,
      hasMediaRecorder: capabilities.hasMediaRecorder,
      hasGetUserMedia: capabilities.hasGetUserMedia,
      recommendedMethod: capabilities.recommendedMethod,
      warnings: [capabilities.userMessage],
    };

    setCompatibility(compat);
    setIsSupported(capabilities.supportLevel !== 'none');
    
    // Log browser info for debugging
    console.log('Browser detected:', browserInfo.name, browserInfo.version);
    console.log('Voice capabilities:', capabilities);
  }, []);

  // Initialize Speech Recognition
  const initSpeechRecognition = useCallback(() => {
    if (!hasSpeechApi.current) return false;

    try {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) return false;

      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'en-US';
      
      // Enhanced configuration for better compatibility
      recognitionRef.current.maxAlternatives = 1;
      
      // Set timeout to prevent hanging
      if ('grammars' in recognitionRef.current) {
        // Only set if supported (not in all browsers)
        try {
          recognitionRef.current.grammars = new (window as any).SpeechGrammarList();
        } catch (e) {
          // Ignore grammar errors - not critical
        }
      }

    recognitionRef.current.onstart = () => {
      setIsListening(true);
      setError(null);
      setInputMethod('speech-api');
    };

    recognitionRef.current.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current.onresult = (event: SpeechRecognitionEvent) => {
      let finalText = '';
      let interimText = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalText += transcript;
        } else {
          interimText += transcript;
        }
      }

      if (finalText) {
        setTranscript((prev) => {
          const newTranscript = prev + finalText;
          config.onTranscriptChange?.(newTranscript);
          return newTranscript;
        });
        setInterimTranscript('');
      } else {
        setInterimTranscript(interimText);
      }
    };

    recognitionRef.current.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Speech recognition error:', event.error);

      // Don't treat 'no-speech' as a hard error, just stop listening
      if (event.error === 'no-speech') {
        setIsListening(false);
        return;
      }

      // Use enhanced error messaging
      const browserInfo = detectBrowser();
      const errorMessage = getVoiceErrorMessage(event.error, browserInfo);
      
      // Determine if we should fallback to MediaRecorder
      const shouldFallback = [
        'network',
        'service-not-allowed', 
        'bad-grammar',
        'language-not-supported'
      ].includes(event.error) || event.error.includes('service');

      // User aborted - no error needed
      if (event.error === 'aborted') {
        setIsListening(false);
        return;
      }

      setError(errorMessage);
      config.onError?.(errorMessage);
      setIsListening(false);

      // Enhanced automatic fallback to MediaRecorder if available
      if (shouldFallback && compatibility.hasMediaRecorder && compatibility.hasGetUserMedia) {
        console.log('Attempting automatic fallback to MediaRecorder...');
        setTimeout(async () => {
          try {
            const success = await startMediaRecorder();
            if (success) {
              setError('Switched to audio recording mode - speak and click stop when finished');
            }
          } catch (fallbackError) {
            console.error('Fallback to MediaRecorder failed:', fallbackError);
            setError('Voice input unavailable. Please type your message instead.');
          }
        }, 500);
      }
    };

    return true;
    } catch (initError) {
      console.error('Failed to initialize Speech Recognition:', initError);
      return false;
    }
  }, [config]);

  // Get best MIME type for MediaRecorder with Firefox optimization
  const getBestMimeType = useCallback((): string => {
    const browserInfo = detectBrowser();
    
    let mimeTypes: string[];
    
    if (browserInfo.isFirefox) {
      // Firefox prefers OGG formats
      mimeTypes = [
        'audio/ogg;codecs=opus',
        'audio/ogg',
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/wav'
      ];
    } else {
      // Chrome/Edge/Safari prefer WebM
      mimeTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/ogg',
        'audio/mp4',
        'audio/wav'
      ];
    }

    for (const mimeType of mimeTypes) {
      if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(mimeType)) {
        console.log(`Selected MIME type: ${mimeType} for ${browserInfo.name}`);
        return mimeType;
      }
    }

    console.warn(`No supported MIME type found for ${browserInfo.name}, using default`);
    return '';
  }, []);

  // Start MediaRecorder fallback with enhanced Firefox support
  const startMediaRecorder = useCallback(async (): Promise<boolean> => {
    try {
      // Enhanced audio constraints with Firefox compatibility
      const browserInfo = detectBrowser();
      
      const audioConstraints: MediaTrackConstraints = {
        sampleRate: browserInfo.isFirefox ? { ideal: 48000, min: 16000 } : 16000,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      };

      // Firefox-specific optimizations
      if (browserInfo.isFirefox) {
        // Firefox handles these constraints better
        // Note: latency is not a standard MediaTrackConstraints property
        // Using advanced constraints for Firefox optimization
        (audioConstraints as any).latency = { ideal: 0.01 };
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: audioConstraints
      });

      streamRef.current = stream;
      audioChunksRef.current = [];

      // Validate audio stream
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) {
        throw new Error('No audio tracks available');
      }

      const audioTrack = audioTracks[0];
      const settings = audioTrack.getSettings();
      console.log(`Audio track settings for ${browserInfo.name}:`, settings);

      // Enhanced audio quality validation
      if (settings.sampleRate && settings.sampleRate < 8000) {
        console.warn('Low sample rate detected:', settings.sampleRate);
      }

      // Check if track is actually active
      if (audioTrack.readyState !== 'live') {
        throw new Error('Audio track is not active');
      }

      const mimeType = getBestMimeType();
      if (!mimeType) {
        console.warn(`No supported MIME type found for ${browserInfo.name}, using browser default`);
      }

      // Enhanced MediaRecorder options with Firefox compatibility
      const options: MediaRecorderOptions = {};
      if (mimeType) {
        options.mimeType = mimeType;
      }
      
      // Browser-specific optimizations
      if (browserInfo.isFirefox && mimeType.includes('ogg')) {
        // Firefox OGG optimization
        options.audioBitsPerSecond = 128000;
      } else if (mimeType.includes('webm')) {
        // WebM optimization for Chrome/Edge
        options.audioBitsPerSecond = 128000;
      }

      try {
        mediaRecorderRef.current = new MediaRecorder(stream, options);
      } catch (optionsError) {
        console.warn(`MediaRecorder options not supported in ${browserInfo.name}, using defaults:`, optionsError);
        // Fallback to basic MediaRecorder without options
        mediaRecorderRef.current = new MediaRecorder(stream);
      }

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstart = () => {
        setIsListening(true);
        setError(null);
        setInputMethod('media-recorder');
        setTranscript(''); // Reset transcript for media recorder mode
        setRetryCount(0); // Reset retry count on successful start
      };

      mediaRecorderRef.current.onstop = () => {
        setIsListening(false);
        // Stop all tracks to release the microphone
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.onerror = (event: Event) => {
        console.error('MediaRecorder error:', event);
        const errorMessage = 'Recording error. Please try again.';
        setError(errorMessage);
        config.onError?.(errorMessage);
        setIsListening(false);

        // Retry logic
        if (retryCount < MAX_RETRIES) {
          console.log(`Retrying MediaRecorder (attempt ${retryCount + 1}/${MAX_RETRIES})...`);
          setRetryCount(prev => prev + 1);
          setTimeout(() => {
            startMediaRecorder();
          }, RETRY_DELAY * (retryCount + 1)); // Exponential backoff
        }
      };

      // Start recording
      mediaRecorderRef.current.start(100); // Collect data every 100ms

      return true;
    } catch (err) {
      console.error('Failed to start MediaRecorder:', err);
      
      // Use enhanced error messaging
      const browserInfo = detectBrowser();
      let errorMessage = 'Could not access microphone';

      if (err instanceof Error) {
        errorMessage = getVoiceErrorMessage(err.name.toLowerCase().replace('error', ''), browserInfo);
        
        // Fallback to generic message if no specific mapping
        if (errorMessage.includes('Voice input error:')) {
          if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
            errorMessage = browserInfo.isFirefox 
              ? 'Firefox: Microphone permission denied. Please allow access in browser settings and refresh the page.'
              : 'Microphone permission denied. Please allow access in your browser settings.';
          } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
            errorMessage = 'No microphone found. Please connect a microphone and try again.';
          } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
            errorMessage = 'Microphone is already in use by another application.';
          } else {
            errorMessage = browserInfo.isFirefox 
              ? `Firefox: ${err.message}. Voice recording may not be fully supported.`
              : err.message;
          }
        }
      }

      setError(errorMessage);
      config.onError?.(errorMessage);
      return false;
    }
  }, [config, getBestMimeType, retryCount]);

  // Start recording - enhanced Firefox handling
  const startRecording = useCallback(async () => {
    setError(null);

    // Use browser detection utility
    const browserInfo = detectBrowser();

    // Firefox: Skip Speech API and go directly to MediaRecorder
    if (browserInfo.isFirefox) {
      console.log('Firefox detected: Using MediaRecorder directly');
      const success = await startMediaRecorder();
      if (!success) {
        const errorMessage = 'Firefox: Voice input is not available. Please type your message instead.';
        setError(errorMessage);
        setIsSupported(false);
        config.onError?.(errorMessage);
      }
      return;
    }

    // Other browsers: Try Web Speech API first, then fallback to MediaRecorder
    if (hasSpeechApi.current && initSpeechRecognition()) {
      try {
        recognitionRef.current.start();
        return;
      } catch (err) {
        console.warn('SpeechRecognition failed to start, trying MediaRecorder:', err);
        // Fall through to MediaRecorder
      }
    }

    // Fallback to MediaRecorder + server transcription
    const success = await startMediaRecorder();
    if (!success) {
      const errorMessage = 'Voice input is not supported in this browser. Please type your message instead.';
      setError(errorMessage);
      setIsSupported(false);
      config.onError?.(errorMessage);
    }
  }, [config, initSpeechRecognition, startMediaRecorder]);

  // Stop recording
  const stopRecording = useCallback(async (): Promise<Blob | null> => {
    if (inputMethod === 'speech-api' && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
      // Return null since we already have the transcript via Speech API
      return null;
    }

    if (inputMethod === 'media-recorder' && mediaRecorderRef.current) {
      return new Promise((resolve) => {
        if (!mediaRecorderRef.current) {
          resolve(null);
          return;
        }

        mediaRecorderRef.current.onstop = () => {
          setIsListening(false);

          // Stop all tracks
          if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
          }

          // Create audio blob
          if (audioChunksRef.current.length > 0) {
            const mimeType = getBestMimeType() || 'audio/webm';
            const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
            resolve(audioBlob);
          } else {
            resolve(null);
          }
        };

        mediaRecorderRef.current.stop();
      });
    }

    setIsListening(false);
    return null;
  }, [inputMethod, getBestMimeType]);

  // Reset transcript
  const resetTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // Ignore abort errors
        }
      }

      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  return {
    isListening,
    transcript,
    interimTranscript,
    isSupported,
    inputMethod,
    compatibility,
    startRecording,
    stopRecording,
    error,
    resetTranscript,
    retryCount
  };
};

export default useVoiceInput;
