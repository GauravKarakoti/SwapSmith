'use client'

import { useState, useRef, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { Mic, Send, StopCircle, Copy, Check } from 'lucide-react';
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
      console.error("Error accessing microphone:", err);
      alert("Could not access microphone. Please ensure you have granted permission.");
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
        console.error('Voice processing error:', error);
        setMessages(prev => prev.filter(m => m.content !== '🎤 [Sending Voice...]'));
        addMessage({ role: 'assistant', content: "Sorry, I had trouble processing your voice message.", type: 'message' });
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
      console.error(error);
      addMessage({ role: 'assistant', content: `Error processing request: ${error.message || 'Unknown error'}`, type: 'message' });
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
    <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden flex flex-col h-[600px]">
      <TrustIndicators />
      
      <div className="flex-1 overflow-y-auto p-5 bg-gray-50 space-y-5">
        {messages.map((msg, index) => (
          <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                
                {msg.type === 'yield_info' ? (
                    <div className="bg-gray-100 border border-gray-200 text-gray-900 p-4 rounded-xl whitespace-pre-line text-sm leading-relaxed">
                        {msg.content}
                    </div>
                ) : msg.type === 'checkout_link' ? (
                    <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl text-center shadow-sm">
                        <p className="font-semibold text-blue-900 mb-3 text-sm">{msg.content}</p>
                        
                        <div className="flex flex-col gap-2">
                            <a href={msg.data.url} target="_blank" className="bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 block w-full font-medium text-sm transition-colors shadow-sm">
                                Pay Now ↗
                            </a>
                            
                            <button 
                                onClick={() => copyToClipboard(msg.data.url)}
                                className="flex items-center justify-center gap-2 bg-white border border-blue-300 text-blue-700 px-4 py-2 rounded-xl hover:bg-blue-50 w-full text-sm transition-colors"
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
                    <div className={`p-4 rounded-xl text-sm leading-relaxed ${msg.role === 'user' ? 'bg-blue-600 text-white shadow-sm' : 'bg-white border border-gray-200 text-gray-800 shadow-sm'}`}>
                        <div className="whitespace-pre-line">{msg.content}</div>
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
            className={`p-3 rounded-full transition-all hover:scale-105 ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            title={isRecording ? "Stop Recording" : "Start Voice Input"}
          >
            {isRecording ? <StopCircle className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>
          
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Type or speak... 'Swap ETH for BTC' or 'Receive 10 USDC'"
            className="flex-1 px-4 py-3 border border-gray-300 text-gray-900 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50"
            disabled={isLoading}
          />
          
          <button 
            onClick={handleSend} 
            disabled={isLoading || !input.trim()}
            className="p-3 bg-blue-600 text-white rounded-xl shadow-sm hover:bg-blue-700 disabled:opacity-50 transition-all"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
        {!isConnected && <p className="text-xs text-center text-red-500 mt-2 font-medium">Please connect wallet for full features</p>}
      </div>
    </div>
  );
}