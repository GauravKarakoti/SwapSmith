'use client'

import { useState, useRef, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { Mic, Send, StopCircle, Copy, Check, AlertCircle } from 'lucide-react';
import SwapConfirmation from './SwapConfirmation';
import TrustIndicators from './TrustIndicators';
import IntentConfirmation from './IntentConfirmation';
import { ParsedCommand } from '@/utils/groq-client';
import { useErrorHandler, ErrorType } from '@/hooks/useErrorHandler';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  type?: 'message' | 'intent_confirmation' | 'swap_confirmation' | 'yield_info' | 'checkout_link';
  data?: any;
}

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: "Hello! I can help you swap assets, create payment links, or scout yields.\n\n💡 Tip: Try our Telegram Bot for on-the-go access!",
      timestamp: new Date(),
      type: 'message'
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [pendingCommand, setPendingCommand] = useState<ParsedCommand | null>(null);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { address, isConnected } = useAccount();
  const { handleError } = useErrorHandler();
  
  // Use cross-browser audio recorder
  const { 
    isRecording, 
    isSupported: isAudioSupported, 
    startRecording, 
    stopRecording, 
    error: audioError,
    browserInfo 
  } = useAudioRecorder({
    sampleRate: 16000, // Optimized for speech recognition
    numberOfAudioChannels: 1,
    timeSlice: 1000
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Show audio error if any
  useEffect(() => {
    if (audioError) {
      addMessage({ role: 'assistant', content: audioError, type: 'message' });
    }
  }, [audioError]);

  const addMessage = (message: Omit<Message, 'timestamp'>) => {
    setMessages(prev => [...prev, { ...message, timestamp: new Date() }]);
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedLink(text);
      setTimeout(() => setCopiedLink(null), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  const handleStartRecording = async () => {
    if (!isAudioSupported) {
      addMessage({ 
        role: 'assistant', 
        content: `Voice input is not supported in this browser (${browserInfo.browser}). Please use text input instead.`, 
        type: 'message' 
      });
      return;
    }

    try {
      await startRecording();
    } catch (err) {
      const errorMessage = handleError(err, ErrorType.VOICE_ERROR, { 
        operation: 'microphone_access',
        retryable: true 
      });
      addMessage({ role: 'assistant', content: errorMessage, type: 'message' });
    }
  };

  const handleStopRecording = async () => {
    try {
      const audioBlob = await stopRecording();
      if (audioBlob) {
        await handleVoiceInput(audioBlob);
      }
    } catch (err) {
      const errorMessage = handleError(err, ErrorType.VOICE_ERROR, { 
        operation: 'stop_recording',
        retryable: true 
      });
      addMessage({ role: 'assistant', content: errorMessage, type: 'message' });
    }
  };

  const handleVoiceInput = async (audioBlob: Blob) => {
    setIsLoading(true);
    addMessage({ role: 'user', content: '🎤 [Sending Voice...]', type: 'message' });
    
    const formData = new FormData();
    
    // Determine file extension based on blob type and browser
    let fileName = 'voice.webm';
    if (audioBlob.type.includes('mp4')) {
      fileName = 'voice.mp4';
    } else if (audioBlob.type.includes('wav')) {
      fileName = 'voice.wav';
    } else if (audioBlob.type.includes('ogg')) {
      fileName = 'voice.ogg';
    }
    
    formData.append('file', audioBlob, fileName);

    try {
        const response = await fetch('/api/transcribe', {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) throw new Error('Transcription failed');

        const data = await response.json();
        
        if (data.text) {
            setMessages(prev => {
                const newMsgs = [...prev];
                const lastIndex = newMsgs.length - 1;
                if (lastIndex >= 0 && newMsgs[lastIndex].content === '🎤 [Sending Voice...]') {
                    newMsgs[lastIndex] = {
                        ...newMsgs[lastIndex],
                        content: `🎤 "${data.text}"`
                    };
                }
                return newMsgs;
            });
            
            await processCommand(data.text);
        } else {
            addMessage({ role: 'assistant', content: "I couldn't hear anything clearly.", type: 'message' });
            setIsLoading(false);
        }

    } catch (error) {
        const errorMessage = handleError(error, ErrorType.VOICE_ERROR, { 
          operation: 'voice_transcription',
          retryable: true 
        });
        setMessages(prev => prev.filter(m => m.content !== '🎤 [Sending Voice...]'));
        addMessage({ role: 'assistant', content: errorMessage, type: 'message' });
        setIsLoading(false);
    }
  };

  const processCommand = async (text: string) => {
    if(!isLoading) setIsLoading(true); 

    try {
      const response = await fetch('/api/parse-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });
      
      const command: ParsedCommand = await response.json();
      
      if (!command.success && command.intent !== 'yield_scout') {
        addMessage({
          role: 'assistant',
          content: `I couldn't understand. ${command.validationErrors.join(', ')}`,
          type: 'message'
        });
        setIsLoading(false);
        return;
      }

      // Handle Yield Scout
      if (command.intent === 'yield_scout') {
        const yieldRes = await fetch('/api/yields');
        const yieldData = await yieldRes.json();
        addMessage({
          role: 'assistant',
          content: yieldData.message, 
          type: 'yield_info'
        });
        setIsLoading(false);
        return;
      }

      // Handle Checkout (Payment Links)
      if (command.intent === 'checkout') {
        let finalAddress = command.settleAddress;
        
        if (!finalAddress) {
            if (!isConnected || !address) {
                addMessage({
                    role: 'assistant',
                    content: "To create a receive link for yourself, please connect your wallet first.",
                    type: 'message'
                });
                setIsLoading(false);
                return;
            }
            finalAddress = address;
        }

        const checkoutRes = await fetch('/api/create-checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                settleAsset: command.settleAsset,
                settleNetwork: command.settleNetwork,
                settleAmount: command.settleAmount,
                settleAddress: finalAddress 
            })
        });
        const checkoutData = await checkoutRes.json();
        
        if (checkoutData.error) throw new Error(checkoutData.error);

        addMessage({
            role: 'assistant',
            content: `Payment Link Created for ${checkoutData.settleAmount} ${checkoutData.settleCoin} on ${command.settleNetwork}`,
            type: 'checkout_link',
            data: { url: checkoutData.url }
        });
        setIsLoading(false);
        return;
      }

      // Handle Portfolio
      if (command.intent === 'portfolio' && command.portfolio) {
         addMessage({ 
             role: 'assistant', 
             content: `📊 **Portfolio Strategy Detected**\nSplitting ${command.amount} ${command.fromAsset} into multiple assets. Generating orders...`, 
             type: 'message' 
         });

         for (const item of command.portfolio) {
             const splitAmount = (command.amount! * item.percentage) / 100;
             const subCommand: ParsedCommand = {
                 ...command,
                 intent: 'swap',
                 amount: splitAmount,
                 toAsset: item.toAsset,
                 toChain: item.toChain,
                 portfolio: undefined, 
                 confidence: 100 
             };
             
             await executeSwap(subCommand);
         }
         
         setIsLoading(false);
         return;
      }

      // Handle Swap (Standard Flow)
      if (command.requiresConfirmation || command.confidence < 80) {
        setPendingCommand(command);
        addMessage({ role: 'assistant', content: '', type: 'intent_confirmation', data: { parsedCommand: command } });
      } else {
        await executeSwap(command);
      }
      
    } catch (error: any) {
      const errorMessage = handleError(error, ErrorType.API_FAILURE, { 
        operation: 'command_processing',
        retryable: true 
      });
      addMessage({ role: 'assistant', content: errorMessage, type: 'message' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = () => {
    if (!input.trim()) return;
    const text = input;
    setInput('');
    addMessage({ role: 'user', content: text, type: 'message' });
    processCommand(text);
  };

  const executeSwap = async (command: ParsedCommand) => {
    try {
      const quoteResponse = await fetch('/api/create-swap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromAsset: command.fromAsset,
          toAsset: command.toAsset,
          amount: command.amount,
          fromChain: command.fromChain,
          toChain: command.toChain
        }),
      });
      
      const quote = await quoteResponse.json();
      if (quote.error) throw new Error(quote.error);
      
      addMessage({
        role: 'assistant',
        content: `Swap Prepared: ${quote.depositAmount} ${quote.depositCoin} → ${quote.settleAmount} ${quote.settleCoin}`,
        type: 'swap_confirmation',
        data: { quoteData: quote, confidence: command.confidence }
      });
    } catch (error: any) {
      const errorMessage = handleError(error, ErrorType.API_FAILURE, { 
        operation: 'swap_quote',
        retryable: true 
      });
      addMessage({ role: 'assistant', content: errorMessage, type: 'message' });
    }
  };

  const handleIntentConfirm = async (confirmed: boolean) => {
    if (confirmed && pendingCommand) {
        if (pendingCommand.intent === 'portfolio') {
             const confirmedCmd = { ...pendingCommand, requiresConfirmation: false, confidence: 100 };
             addMessage({ role: 'assistant', content: "Executing Portfolio Strategy...", type: 'message' });
             
             if (confirmedCmd.portfolio) {
                for (const item of confirmedCmd.portfolio) {
                    const splitAmount = (confirmedCmd.amount! * item.percentage) / 100;
                    await executeSwap({
                        ...confirmedCmd,
                        intent: 'swap',
                        amount: splitAmount,
                        toAsset: item.toAsset,
                        toChain: item.toChain
                    });
                }
             }
        } else {
            await executeSwap(pendingCommand);
        }
    } else if (!confirmed) {
        addMessage({ role: 'assistant', content: 'Cancelled.', type: 'message' });
    }
    setPendingCommand(null);
  };

  return (
    <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-lg overflow-hidden flex flex-col h-[600px]">
      <TrustIndicators />
      
      <div className="flex-1 overflow-y-auto p-4 bg-gray-50 space-y-4">
        {messages.map((msg, index) => (
          <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                
                {msg.type === 'yield_info' ? (
                    <div className="bg-gray-200 text-gray-900 p-3 rounded-lg whitespace-pre-line text-sm">
                        {msg.content}
                    </div>
                ) : msg.type === 'checkout_link' ? (
                    <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg text-center shadow-sm">
                        <p className="font-semibold text-blue-900 mb-3 text-sm">{msg.content}</p>
                        
                        <div className="flex flex-col gap-2">
                            <a href={msg.data.url} target="_blank" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 block w-full font-medium text-sm transition-colors">
                                Pay Now ↗
                            </a>
                            
                            <button 
                                onClick={() => copyToClipboard(msg.data.url)}
                                className="flex items-center justify-center gap-2 bg-white border border-blue-300 text-blue-700 px-4 py-2 rounded hover:bg-blue-50 w-full text-sm transition-colors"
                            >
                                {copiedLink === msg.data.url ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                {copiedLink === msg.data.url ? 'Copied Link!' : 'Copy Link'}
                            </button>
                        </div>
                    </div>
                ) : msg.type === 'intent_confirmation' ? (
                    <IntentConfirmation command={msg.data?.parsedCommand} onConfirm={handleIntentConfirm} />
                ) : msg.type === 'swap_confirmation' ? (
                    <SwapConfirmation quote={msg.data?.quoteData} confidence={msg.data?.confidence} />
                ) : (
                    <div className={`p-3 rounded-lg ${msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-800 shadow-sm'}`}>
                        <div className="whitespace-pre-line text-sm">{msg.content}</div>
                    </div>
                )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-gray-200 p-4 bg-white">
        <div className="flex gap-2 items-center">
          <button 
            onClick={isRecording ? handleStopRecording : handleStartRecording}
            disabled={isLoading}
            className={`p-3 rounded-full transition-all ${
              !isAudioSupported 
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                : isRecording 
                  ? 'bg-red-500 text-white animate-pulse' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            title={
              !isAudioSupported 
                ? `Voice input not supported in ${browserInfo.browser}` 
                : isRecording 
                  ? "Stop Recording" 
                  : "Start Voice Input"
            }
          >
            {!isAudioSupported ? (
              <AlertCircle className="w-5 h-5" />
            ) : isRecording ? (
              <StopCircle className="w-5 h-5" />
            ) : (
              <Mic className="w-5 h-5" />
            )}
          </button>
          
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Type or speak... 'Swap ETH for BTC' or 'Receive 10 USDC'"
            className="flex-1 p-3 border border-gray-300 text-gray-900 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50"
            disabled={isLoading}
          />
          
          <button 
            onClick={handleSend} 
            disabled={isLoading || !input.trim()}
            className="p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
        {!isConnected && <p className="text-xs text-center text-red-500 mt-2 font-medium">Please connect wallet for full features</p>}
        {!isAudioSupported && (
          <p className="text-xs text-center text-amber-600 mt-1 font-medium">
            Voice input not supported in {browserInfo.browser}. Supported formats: {browserInfo.supportedMimeTypes.join(', ') || 'none'}
          </p>
        )}
      </div>
    </div>
  );
}