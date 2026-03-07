import { useState, useEffect, useRef, useCallback } from 'react';
import { detectBrowser, checkVoiceCapabilities, getVoiceErrorMessage } from '@/utils/browser-detection';

export interface UseSpeechRecognitionReturn {
  isListening: boolean;
  transcript: string;
  isSupported: boolean;
  startRecording: () => void;
  stopRecording: () => void;
  error: string | null;
}

export const useSpeechRecognition = (): UseSpeechRecognitionReturn => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isSupported, setIsSupported] = useState(true); // Optimistic initially, checked in useEffect
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const browserInfo = detectBrowser();
      const capabilities = checkVoiceCapabilities();

      // Firefox doesn't support Speech Recognition API well
      if (browserInfo.isFirefox) {
        setIsSupported(false);
        setError("Firefox: Voice input requires audio recording mode. Please use the advanced voice input feature.");
        return;
      }

      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

      if (!SpeechRecognition || !capabilities.hasSpeechRecognition) {
        setIsSupported(false);
        setError(capabilities.userMessage || "Voice input is not supported in this browser.");
      } else {
        setIsSupported(true);
        
        try {
          const recognition = new SpeechRecognition();
          recognitionRef.current = recognition;

          recognition.continuous = false; // We want single command
          recognition.interimResults = true; // Show results as they come
          recognition.lang = 'en-US';
          recognition.maxAlternatives = 1;

          recognition.onstart = () => {
            setIsListening(true);
            setError(null);
          };

          recognition.onend = () => {
            setIsListening(false);
          };

          recognition.onresult = (event: SpeechRecognitionEvent) => {
            let finalTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
              if (event.results[i].isFinal) {
                finalTranscript += event.results[i][0].transcript;
              } else {
                // Handle interim results if needed, but for now we focus on final
                // You might want to update a live preview here
                finalTranscript += event.results[i][0].transcript;
              }
            }
            setTranscript(finalTranscript);
          };

          recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
            console.error("Speech recognition error", event.error);
            
            // Don't treat 'no-speech' as a hard error
            if (event.error === 'no-speech') {
              setError("No speech was detected. Please try again.");
              setIsListening(false);
              return;
            }

            // Use enhanced error messaging
            const errorMessage = getVoiceErrorMessage(event.error, browserInfo);
            setError(errorMessage);
            setIsListening(false);
          };
        } catch (initError) {
          console.error('Failed to initialize Speech Recognition:', initError);
          setIsSupported(false);
          setError(`${browserInfo.name}: Speech recognition initialization failed. Please try refreshing the page.`);
        }
      }
    }

    return () => {
        if (recognitionRef.current) {
            try {
              recognitionRef.current.abort();
            } catch (e) {
              // Ignore cleanup errors
            }
        }
    };
  }, []);

  const startRecording = useCallback(() => {
    const browserInfo = detectBrowser();
    
    if (!isSupported || !recognitionRef.current) {
        const errorMessage = browserInfo.isFirefox 
          ? "Firefox: Please use the advanced voice input feature for audio recording."
          : "Voice input is not supported in this browser.";
        setError(errorMessage);
        return;
    }
    
    try {
        setTranscript('');
        setError(null);
        recognitionRef.current.start();
    } catch (err) {
        // Handle case where start() is called while already running
        console.warn("Speech recognition already started or failed to start", err);
        const errorMessage = browserInfo.isFirefox
          ? "Firefox: Speech recognition failed. Please use audio recording mode."
          : "Speech recognition failed to start. Please try again.";
        setError(errorMessage);
    }
  }, [isSupported]);

  const stopRecording = useCallback(() => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
    }
  }, [isListening]);

  return {
    isListening,
    transcript,
    isSupported,
    startRecording,
    stopRecording,
    error
  };
};
