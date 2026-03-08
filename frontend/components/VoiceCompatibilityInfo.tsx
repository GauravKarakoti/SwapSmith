import React from 'react';
import { checkVoiceCapabilities, detectBrowser } from '@/utils/browser-detection';

interface VoiceCompatibilityInfoProps {
  className?: string;
  showDetails?: boolean;
}

export const VoiceCompatibilityInfo: React.FC<VoiceCompatibilityInfoProps> = ({ 
  className = '', 
  showDetails = false 
}) => {
  const browserInfo = detectBrowser();
  const capabilities = checkVoiceCapabilities();

  const getSupportIcon = (level: string) => {
    switch (level) {
      case 'full':
        return '✅';
      case 'partial':
        return '⚠️';
      default:
        return '❌';
    }
  };

  const getSupportColor = (level: string) => {
    switch (level) {
      case 'full':
        return 'text-green-600';
      case 'partial':
        return 'text-yellow-600';
      default:
        return 'text-red-600';
    }
  };

  return (
    <div className={`voice-compatibility-info ${className}`}>
      <div className="flex items-center gap-2 text-sm">
        <span className={getSupportColor(capabilities.supportLevel)}>
          {getSupportIcon(capabilities.supportLevel)}
        </span>
        <span className="text-gray-700">
          {capabilities.userMessage}
        </span>
      </div>
      
      {showDetails && (
        <div className="mt-2 text-xs text-gray-500 space-y-1">
          <div>Browser: {browserInfo.name} {browserInfo.version}</div>
          <div>Speech Recognition: {capabilities.hasSpeechRecognition ? '✅' : '❌'}</div>
          <div>Audio Recording: {capabilities.hasMediaRecorder ? '✅' : '❌'}</div>
          <div>Microphone Access: {capabilities.hasGetUserMedia ? '✅' : '❌'}</div>
          <div>Secure Context: {capabilities.isSecureContext ? '✅' : '❌'}</div>
          {capabilities.recommendedMethod && (
            <div>Recommended: {capabilities.recommendedMethod}</div>
          )}
        </div>
      )}
    </div>
  );
};

export default VoiceCompatibilityInfo;