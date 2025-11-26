'use client'

import { useState, useRef, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { Mic, Send, StopCircle } from 'lucide-react';
import SwapConfirmation from './SwapConfirmation';
import TrustIndicators from './TrustIndicators';
import IntentConfirmation from './IntentConfirmation';
import { ParsedCommand } from '@/utils/groq-client';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  type?: 'message' | 'intent_confirmation' | 'swap_confirmation' | 'yield_info' | 'checkout_link';
  data?: any;
}

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [pendingCommand, setPendingCommand] = useState<ParsedCommand | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { isConnected } = useAccount();
  
  // MediaRecorder ref
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const addMessage = (message: Omit<Message, 'timestamp'>) => {
    setMessages(prev => [...prev, { ...message, timestamp: new Date() }]);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await handleVoiceInput(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("Could not access microphone. Please ensure you have granted permission.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      // Stop all tracks to release microphone
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  const handleVoiceInput = async (audioBlob: Blob) => {
    setIsLoading(true);
    // Optimistically show that voice was sent
    addMessage({ role: 'user', content: '🎤 [Sending Voice...]', type: 'message' });
    
    const formData = new FormData();
    formData.append('file', audioBlob, 'voice.webm');

    try {
        const response = await fetch('/api/transcribe', {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) throw new Error('Transcription failed');

        const data = await response.json();
        
        // Replace the placeholder message or just continue
        // We'll process the transcribed text as a command
        if (data.text) {
            // Optionally update the UI to show what was heard
            setMessages(prev => {
                const newMsgs = [...prev];
                const lastMsg = newMsgs[newMsgs.length - 1];
                if (lastMsg.content === '🎤 [Sending Voice...]') {
                    lastMsg.content = `🎤 "${data.text}"`;
                }
                return newMsgs;
            });
            
            await processCommand(data.text);
        } else {
            addMessage({ role: 'assistant', content: "I couldn't hear anything clearly.", type: 'message' });
            setIsLoading(false);
        }

    } catch (error) {
        console.error('Voice processing error:', error);
        addMessage({ role: 'assistant', content: "Sorry, I had trouble processing your voice message.", type: 'message' });
        setIsLoading(false);
    }
  };

  const processCommand = async (text: string) => {
    // Logic matches the text input flow, but ensures isLoading is managed correctly
    if(!isLoading) setIsLoading(true); // Ensure loading state if called directly

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

      // Handle Checkout
      if (command.intent === 'checkout') {
        const checkoutRes = await fetch('/api/create-checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                settleAsset: command.settleAsset,
                settleNetwork: command.settleNetwork,
                settleAmount: command.settleAmount,
                settleAddress: command.settleAddress 
            })
        });
        const checkoutData = await checkoutRes.json();
        addMessage({
            role: 'assistant',
            content: `Payment Link Created for ${checkoutData.settleAmount} ${checkoutData.settleCoin}`,
            type: 'checkout_link',
            data: { url: checkoutData.url }
        });
        setIsLoading(false);
        return;
      }

      // Handle Portfolio
      if (command.intent === 'portfolio') {
         let msg = `📊 **Portfolio Strategy:**\nInput: ${command.amount} ${command.fromAsset}\n\n`;
         command.portfolio?.forEach(p => {
             msg += `• ${p.percentage}% → ${p.toAsset} on ${p.toChain}\n`;
         });
         addMessage({ role: 'assistant', content: msg, type: 'message' });
         addMessage({ role: 'assistant', content: "To execute this, please confirm each swap individually (multi-swap execution coming soon).", type: 'message' });
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
      
    } catch (error) {
      console.error(error);
      addMessage({ role: 'assistant', content: 'Error processing request.', type: 'message' });
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
      addMessage({ role: 'assistant', content: `Error: ${error.message}`, type: 'message' });
    }
  };

  const handleIntentConfirm = async (confirmed: boolean) => {
    if (confirmed && pendingCommand) {
      await executeSwap(pendingCommand);
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
                    <div className="bg-gray-200 text-gray-800 p-3 rounded-lg whitespace-pre-line text-sm">
                        {msg.content}
                    </div>
                ) : msg.type === 'checkout_link' ? (
                    <div className="bg-blue-100 border border-blue-300 p-4 rounded-lg text-center">
                        <p className="font-bold text-blue-800 mb-2">{msg.content}</p>
                        <a href={msg.data.url} target="_blank" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 block w-full">
                            Pay Now
                        </a>
                    </div>
                ) : msg.type === 'intent_confirmation' ? (
                    <IntentConfirmation command={msg.data?.parsedCommand} onConfirm={handleIntentConfirm} />
                ) : msg.type === 'swap_confirmation' ? (
                    <SwapConfirmation quote={msg.data?.quoteData} confidence={msg.data?.confidence} />
                ) : (
                    <div className={`p-3 rounded-lg ${msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-800'}`}>
                        {msg.content}
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
            onClick={isRecording ? stopRecording : startRecording}
            className={`p-3 rounded-full transition-all ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}
            title={isRecording ? "Stop Recording" : "Start Voice Input"}
          >
            {isRecording ? <StopCircle className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>
          
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Type or speak... 'Swap ETH for BTC' or 'Best yields on stables'"
            className="flex-1 p-3 border border-gray-300 text-gray-900 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            disabled={isLoading || !isConnected}
          />
          
          <button 
            onClick={handleSend} 
            disabled={isLoading || !input.trim() || !isConnected}
            className="p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
        {!isConnected && <p className="text-xs text-center text-red-500 mt-2">Please connect wallet first</p>}
      </div>
    </div>
  );
}