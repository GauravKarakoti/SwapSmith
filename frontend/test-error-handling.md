# Error Handling Test Cases

This file demonstrates the unified error handling implementation for Issue #11.

## Test Scenarios

### 1. Voice Input Errors
- **Microphone Access Denied**: "Microphone access denied. Please enable microphone permissions and try again."
- **Transcription Failed**: "Couldn't hear you clearly. Please try speaking again or type your message."
- **General Voice Error**: "Voice input failed. Please try again or use text input instead."

### 2. API Failures
- **SideShift API Error**: "Unable to get swap quote. Please try again or check if the trading pair is supported."
- **Groq API Error**: "AI service temporarily unavailable. Please try typing your request instead."
- **General API Error**: "Service temporarily unavailable. Please try again."

### 3. Network Errors
- **Fetch Failed**: "Network connection issue. Please check your internet connection and try again."
- **General Network**: "Connection problem. Please check your network and retry."

### 4. Parsing Errors
- **Validation Error**: "I couldn't understand your request. Please try rephrasing or check the asset/chain names."
- **General Parsing**: "Unable to process your command. Please try a different format or check for typos."

### 5. Wallet Errors
- **Transaction Rejected**: "Transaction cancelled. Please try again when ready to sign."
- **Insufficient Balance**: "Insufficient balance. Please check your wallet balance and try again."
- **General Wallet**: "Wallet connection issue. Please check your wallet and try again."

## Implementation Details

### Before (Inconsistent)
```typescript
// executeSwap
catch (error: any) {
  addMessage({ role: 'assistant', content: `Error: ${error.message}`, type: 'message' });
}

// processCommand  
catch (error: any) {
  addMessage({ role: 'assistant', content: `Error processing request: ${error.message || 'Unknown error'}`, type: 'message' });
}

// handleVoiceInput
catch (error) {
  addMessage({ role: 'assistant', content: "Sorry, I had trouble processing your voice message.", type: 'message' });
}
```

### After (Unified)
```typescript
// All functions now use:
catch (error: any) {
  const errorMessage = handleError(error, ErrorType.API_FAILURE, { 
    operation: 'specific_operation',
    retryable: true 
  });
  addMessage({ role: 'assistant', content: errorMessage, type: 'message' });
}
```

## Benefits
- ✅ Consistent user experience across all error scenarios
- ✅ Better error categorization and handling
- ✅ Improved debugging with structured logging
- ✅ User-friendly messages instead of technical errors
- ✅ Foundation for future error handling improvements