'use client'

import { useState, useRef, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { Mic, Send, StopCircle, Copy, Check, Sparkles, Command } from 'lucide-react';
import SwapConfirmation from './SwapConfirmation';
import TrustIndicators from './TrustIndicators';
import IntentConfirmation from './IntentConfirmation';
import { ParsedCommand } from '@/utils/groq-client';
import { useErrorHandler, ErrorType } from '@/hooks/useErrorHandler';

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
  const [isRecording, setIsRecording] = useState(false);
  const [pendingCommand, setPendingCommand] = useState<ParsedCommand | null>(null);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { address, isConnected } = useAccount();
  const { handleError } = useErrorHandler();
  
  // MediaRecorder ref
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
      const errorMessage = handleError(err, ErrorType.VOICE_ERROR, { 
        operation: 'microphone_access',
        retryable: true 
      });
      addMessage({ role: 'assistant', content: errorMessage, type: 'message' });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  const handleVoiceInput = async (audioBlob: Blob) => {
    setIsLoading(true);
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
    <div className="flex flex-col h-[700px] bg-[#0B0E11] border border-white/10 rounded-3xl overflow-hidden shadow-2xl relative">
      
      {/* 1. Header / Status Bar */}
      <div className="px-6 py-4 bg-white/[0.02] border-b border-white/5 flex justify-between items-center backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/10 rounded-lg">
            <Sparkles className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white tracking-tight">SwapSmith AI</h3>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] text-emerald-500/80 font-bold uppercase tracking-widest">System Ready</span>
            </div>
          </div>
        </div>
        <TrustIndicators />
      </div>

      {/* 2. Message Feed */}
      <div className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-thin scrollbar-thumb-white/10">
        {messages.map((msg, index) => (
          <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2`}>
            <div className={`max-w-[85%] ${msg.role === 'user' ? 'order-1' : 'order-2'}`}>
              
              {/* User Message: Clean & Right-aligned */}
              {msg.role === 'user' ? (
                <div className="bg-blue-600 text-white px-5 py-3 rounded-2xl rounded-tr-none shadow-lg shadow-blue-600/20 text-sm font-medium">
                  {msg.content}
                </div>
              ) : (
                /* Assistant Message: Subtle & Framed */
                <div className="space-y-3">
                  <div className="bg-white/[0.04] border border-white/10 text-gray-200 px-5 py-4 rounded-2xl rounded-tl-none text-sm leading-relaxed backdrop-blur-sm">
                    {/* Render different types (yield, swap, etc) within this styled frame */}
                    {msg.type === 'message' && <div className="whitespace-pre-line">{msg.content}</div>}
                    {msg.type === 'yield_info' && <div className="font-mono text-xs text-blue-300">{msg.content}</div>}
                    
                    {/* Inject your Custom Components (SwapConfirmation etc) here */}
                    {msg.type === 'intent_confirmation' && <IntentConfirmation command={msg.data?.parsedCommand} onConfirm={handleIntentConfirm} />}
                    {msg.type === 'swap_confirmation' && <SwapConfirmation quote={msg.data?.quoteData} confidence={msg.data?.confidence} />}
                  </div>
                </div>
              )}
              
              <p className={`text-[10px] text-gray-500 mt-2 px-1 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* 3. Input Console */}
      <div className="p-6 bg-gradient-to-t from-[#0B0E11] via-[#0B0E11] to-transparent">
        <div className="relative group transition-all duration-300">
          {/* Subtle glow effect on focus */}
          <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-2xl blur opacity-0 group-focus-within:opacity-100 transition duration-500" />
          
          <div className="relative flex items-center gap-3 bg-[#161A1E] border border-white/10 p-2 rounded-2xl group-focus-within:border-blue-500/50 transition-all">
            <button 
              onClick={isRecording ? stopRecording : startRecording}
              className={`p-3 rounded-xl transition-all ${
                isRecording ? 'bg-red-500 text-white animate-pulse shadow-lg shadow-red-500/40' : 'bg-white/5 text-gray-400 hover:bg-white/10'
              }`}
            >
              {isRecording ? <StopCircle className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>
            
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Send a command (e.g., 'Swap 1 ETH to USDC')"
              className="flex-1 bg-transparent border-none focus:ring-0 text-sm text-white placeholder:text-gray-500 py-3"
            />
            
            <div className="flex items-center gap-2 pr-2">
              <button 
                onClick={handleSend} 
                disabled={isLoading || !input.trim()}
                className="p-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-20 text-white rounded-xl transition-all shadow-lg shadow-blue-600/20"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
        
        {/* Footer Warning */}
        {!isConnected && (
          <div className="flex justify-center mt-4">
            <div className="px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20">
              <p className="text-[10px] text-amber-500 font-bold uppercase tracking-widest text-center">
                Wallet Not Connected • Read Only Mode
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}