import { useState, useRef, useCallback } from 'react';
import RecordRTC from 'recordrtc';

export interface AudioRecorderConfig {
  sampleRate?: number;
  numberOfAudioChannels?: number;
  timeSlice?: number;
}

export interface UseAudioRecorderReturn {
  isRecording: boolean;
  isSupported: boolean;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<Blob | null>;
  error: string | null;
  browserInfo: {
    browser: string;
    supportedMimeTypes: string[];
    recommendedMimeType: string;
  };
}

export const useAudioRecorder = (config: AudioRecorderConfig = {}): UseAudioRecorderReturn => {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<RecordRTC | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Browser detection and MIME type support
  const getBrowserInfo = useCallback(() => {
    const userAgent = navigator.userAgent;
    let browser = 'unknown';
    
    if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) {
      browser = 'chrome';
    } else if (userAgent.includes('Firefox')) {
      browser = 'firefox';
    } else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
      browser = 'safari';
    } else if (userAgent.includes('Edg')) {
      browser = 'edge';
    }

    // Test MIME type support
    const mimeTypes = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/wav',
      'audio/ogg;codecs=opus',
      'audio/ogg'
    ];

    const supportedMimeTypes = mimeTypes.filter(mimeType => {
      try {
        return MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(mimeType);
      } catch {
        return false;
      }
    });

    // Determine best MIME type based on browser
    let recommendedMimeType = 'audio/wav'; // Fallback to WAV (universally supported)
    
    if (browser === 'chrome' || browser === 'firefox' || browser === 'edge') {
      if (supportedMimeTypes.includes('audio/webm;codecs=opus')) {
        recommendedMimeType = 'audio/webm;codecs=opus';
      } else if (supportedMimeTypes.includes('audio/webm')) {
        recommendedMimeType = 'audio/webm';
      }
    } else if (browser === 'safari') {
      if (supportedMimeTypes.includes('audio/mp4')) {
        recommendedMimeType = 'audio/mp4';
      }
    }

    return {
      browser,
      supportedMimeTypes,
      recommendedMimeType
    };
  }, []);

  const browserInfo = getBrowserInfo();

  // Check if audio recording is supported
  const isSupported = !!(
    navigator.mediaDevices &&
    navigator.mediaDevices.getUserMedia &&
    (window.MediaRecorder || RecordRTC)
  );

  const startRecording = useCallback(async (): Promise<void> => {
    if (!isSupported) {
      setError('Audio recording is not supported in this browser');
      return;
    }

    if (isRecording) {
      return;
    }

    try {
      setError(null);
      
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: config.sampleRate || 44100,
          channelCount: config.numberOfAudioChannels || 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      
      streamRef.current = stream;

      // Configure RecordRTC options based on browser
      const recordRTCConfig: any = {
        type: 'audio',
        mimeType: browserInfo.recommendedMimeType,
        recorderType: RecordRTC.StereoAudioRecorder,
        numberOfAudioChannels: config.numberOfAudioChannels || 1,
        desiredSampRate: config.sampleRate || 16000, // Lower sample rate for better compatibility
        timeSlice: config.timeSlice || 1000,
        
        // Browser-specific optimizations
        ...(browserInfo.browser === 'safari' && {
          type: 'audio',
          mimeType: 'audio/wav',
          recorderType: RecordRTC.StereoAudioRecorder,
          desiredSampRate: 16000
        }),
        
        ...(browserInfo.browser === 'firefox' && {
          mimeType: 'audio/ogg',
          recorderType: RecordRTC.MediaStreamRecorder
        })
      };

      // Create RecordRTC instance
      const recorder = new RecordRTC(stream, recordRTCConfig);
      recorderRef.current = recorder;

      // Start recording
      recorder.startRecording();
      setIsRecording(true);
      
    } catch (err: any) {
      console.error('Failed to start recording:', err);
      
      if (err.name === 'NotAllowedError') {
        setError('Microphone access denied. Please enable microphone permissions and try again.');
      } else if (err.name === 'NotFoundError') {
        setError('No microphone found. Please connect a microphone and try again.');
      } else if (err.name === 'NotSupportedError') {
        setError('Audio recording is not supported in this browser.');
      } else {
        setError('Failed to start recording. Please try again.');
      }
      
      // Clean up on error
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    }
  }, [isSupported, isRecording, config, browserInfo]);

  const stopRecording = useCallback(async (): Promise<Blob | null> => {
    if (!isRecording || !recorderRef.current) {
      return null;
    }

    return new Promise((resolve) => {
      const recorder = recorderRef.current!;
      
      recorder.stopRecording(() => {
        const blob = recorder.getBlob();
        
        // Clean up
        setIsRecording(false);
        recorderRef.current = null;
        
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
        
        resolve(blob);
      });
    });
  }, [isRecording]);

  return {
    isRecording,
    isSupported,
    startRecording,
    stopRecording,
    error,
    browserInfo
  };
};