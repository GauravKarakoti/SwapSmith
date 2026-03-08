# Voice Input Browser Compatibility

This document outlines the voice input compatibility improvements made to support Firefox and other browsers.

## Browser Support Matrix

| Browser | Speech Recognition | Audio Recording | Support Level | Notes |
|---------|-------------------|-----------------|---------------|-------|
| Chrome | ✅ Real-time | ✅ Fallback | Full | Best experience |
| Edge | ✅ Real-time | ✅ Fallback | Full | Same as Chrome |
| Safari | ⚠️ Webkit | ✅ Fallback | Full | Requires user gesture |
| Firefox | ❌ Not supported | ✅ Primary method | Partial | Audio recording only |
| Mobile | ⚠️ Limited | ✅ Available | Partial | Requires permissions |

## Implementation Details

### Firefox Compatibility
- **Issue**: Firefox doesn't support the SpeechRecognition API
- **Solution**: Automatically uses MediaRecorder API for audio recording
- **User Experience**: Users record audio, then it's transcribed server-side
- **Fallback**: Graceful degradation with clear messaging

### Chrome/Edge/Safari
- **Primary**: SpeechRecognition API for real-time transcription
- **Fallback**: MediaRecorder API if speech recognition fails
- **Auto-retry**: Automatic fallback on network/service errors

### Security Requirements
- **HTTPS**: Required for microphone access (except localhost)
- **Permissions**: User must grant microphone access
- **Secure Context**: All voice features require secure context

## Components and Hooks

### `useVoiceInput` Hook
- **Full-featured**: Handles both speech recognition and audio recording
- **Auto-detection**: Automatically selects best method per browser
- **Error handling**: Browser-specific error messages
- **Fallback logic**: Seamless switching between methods

### `useSpeechRecognition` Hook
- **Simple**: Speech recognition only (no audio recording)
- **Firefox aware**: Shows appropriate message for Firefox users
- **Lightweight**: For basic speech-to-text needs

### `VoiceCompatibilityInfo` Component
- **User feedback**: Shows browser compatibility status
- **Debug info**: Optional detailed capability information
- **Visual indicators**: Clear icons for support levels

## Browser Detection Utilities

### `detectBrowser()`
Returns detailed browser information:
```typescript
{
  name: 'Firefox' | 'Chrome' | 'Edge' | 'Safari' | 'Unknown',
  version: string,
  isFirefox: boolean,
  isChrome: boolean,
  isEdge: boolean,
  isSafari: boolean,
  isMobile: boolean,
  isSecureContext: boolean
}
```

### `checkVoiceCapabilities()`
Returns voice input capabilities:
```typescript
{
  hasSpeechRecognition: boolean,
  hasMediaRecorder: boolean,
  hasGetUserMedia: boolean,
  isSecureContext: boolean,
  recommendedMethod: 'speech-api' | 'media-recorder' | null,
  supportLevel: 'full' | 'partial' | 'none',
  userMessage: string
}
```

## Error Handling

### Enhanced Error Messages
- **Browser-specific**: Tailored messages for each browser
- **Actionable**: Clear instructions for users
- **Fallback aware**: Mentions alternative methods when available

### Common Error Scenarios
1. **Permission Denied**: Clear instructions for enabling microphone
2. **No Microphone**: Hardware detection and troubleshooting
3. **Network Issues**: Automatic fallback to offline recording
4. **Service Unavailable**: Graceful degradation to audio recording

## Usage Examples

### Basic Voice Input
```typescript
import { useVoiceInput } from '@/hooks/useVoiceInput';

const { 
  isListening, 
  transcript, 
  isSupported, 
  compatibility,
  startRecording, 
  stopRecording 
} = useVoiceInput({
  onError: (error) => console.error(error),
  onTranscriptChange: (text) => console.log(text)
});
```

### Compatibility Display
```typescript
import VoiceCompatibilityInfo from '@/components/VoiceCompatibilityInfo';

<VoiceCompatibilityInfo showDetails={true} />
```

## Testing

### Browser Testing
- Test in Chrome, Firefox, Edge, Safari
- Verify fallback behavior
- Check error messages
- Test permission flows

### Network Conditions
- Test offline audio recording
- Verify network error handling
- Check service unavailable scenarios

## Future Improvements

1. **Server Transcription**: Implement Whisper API integration for Firefox
2. **Progressive Enhancement**: Better mobile support
3. **Accessibility**: Screen reader compatibility
4. **Performance**: Optimize audio quality and file sizes