'use client'

import { useEffect, useState, useRef } from 'react';
import { useAccount } from 'wagmi';
import Link from 'next/link';
import WalletConnector from '@/components/WalletConnector';
import ClaudeChatInput from '@/components/ClaudeChatInput';
import SwapConfirmation from '@/components/SwapConfirmation';
import IntentConfirmation from '@/components/IntentConfirmation';
import { ParsedCommand } from '@/utils/groq-client';
import { useErrorHandler, ErrorType } from '@/hooks/useErrorHandler';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { MessageCircle, Zap, Plus, Clock, Settings, HelpCircle, PanelLeftClose, PanelLeft } from 'lucide-react';

interface QuoteData {
  depositAmount: string;
  depositCoin: string;
  depositNetwork: string;
  rate: string;
  settleAmount: string;
  settleCoin: string;
  settleNetwork: string;
  memo?: string;
  expiry?: string;
  id?: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  type?: 'message' | 'intent_confirmation' | 'swap_confirmation' | 'yield_info' | 'checkout_link';
  data?: ParsedCommand | { quoteData: unknown; confidence: number } | { url: string } | { parsedCommand: ParsedCommand };
}

export default function TerminalPage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [chatHistory, setChatHistory] = useState([
    { id: 1, title: "Swap ETH to USDC", timestamp: "2 hours ago" },
    { id: 2, title: "Check yield opportunities", timestamp: "Yesterday" },
    { id: 3, title: "Create payment link", timestamp: "2 days ago" },
    { id: 4, title: "Swap BTC to ETH", timestamp: "1 week ago" },
  ]);

  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: "Hello! I can help you swap assets, create payment links, or scout yields.\n\n💡 Tip: Try our Telegram Bot for on-the-go access!",
      timestamp: new Date(),
      type: 'message'
    }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingCommand, setPendingCommand] = useState<ParsedCommand | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { address, isConnected } = useAccount();
  const { handleError } = useErrorHandler();
  
  const { 
    isRecording, 
    isSupported: isAudioSupported, 
    startRecording, 
    stopRecording, 
    error: audioError
  } = useAudioRecorder({
    sampleRate: 16000,
    numberOfAudioChannels: 1
  });

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (audioError) {
      addMessage({ role: 'assistant', content: audioError, type: 'message' });
    }
  }, [audioError]);

  const formatTime = (date: Date) => {
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} ${ampm}`;
  };

  const addMessage = (message: Omit<Message, 'timestamp'>) => {
    setMessages(prev => [...prev, { ...message, timestamp: new Date() }]);
  };

  const handleStartRecording = async () => {
    if (!isAudioSupported) {
      addMessage({ 
        role: 'assistant', 
        content: `Voice input is not supported in this browser. Please use text input instead.`, 
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
    let fileName = 'voice.webm';
    if (audioBlob.type.includes('mp4')) fileName = 'voice.mp4';
    else if (audioBlob.type.includes('wav')) fileName = 'voice.wav';
    else if (audioBlob.type.includes('ogg')) fileName = 'voice.ogg';
    
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

      if (command.requiresConfirmation || command.confidence < 80) {
        setPendingCommand(command);
        addMessage({ role: 'assistant', content: '', type: 'intent_confirmation', data: { parsedCommand: command } });
      } else {
        await executeSwap(command);
      }
    } catch (error: unknown) {
      const errorMessage = handleError(error, ErrorType.API_FAILURE, { 
        operation: 'command_processing',
        retryable: true 
      });
      addMessage({ role: 'assistant', content: errorMessage, type: 'message' });
    } finally {
      setIsLoading(false);
    }
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
    } catch (error: unknown) {
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

  const handleSendMessage = (data: {
    message: string;
    files: Array<{id: string; file: File; type: string; preview: string | null; uploadStatus: string; content?: string}>;
    pastedContent: Array<{id: string; file: File; type: string; preview: string | null; uploadStatus: string; content?: string}>;
    model: string;
    isThinkingEnabled: boolean;
  }) => {
    if (data.message.trim()) {
      addMessage({ role: 'user', content: data.message, type: 'message' });
      processCommand(data.message);
      setChatHistory([
        { id: Date.now(), title: data.message.slice(0, 50), timestamp: "Just now" },
        ...chatHistory
      ]);
    }
  };

  return (
    <div className="flex h-screen bg-[#050505] text-white overflow-hidden">
      
      {/* Sidebar */}
      <aside className={`${isSidebarOpen ? 'w-80' : 'w-0'} transition-all duration-300 bg-zinc-900/50 border-r border-zinc-800 flex flex-col overflow-hidden`}>
        {isSidebarOpen && (
          <>
            {/* Sidebar Header */}
            <div className="p-4 border-b border-zinc-800">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="bg-blue-600 p-1.5 rounded-lg shadow-lg shadow-blue-600/20">
                    <Zap className="w-4 h-4 text-white" fill="white" />
                  </div>
                  <span className="text-sm font-black tracking-tighter uppercase">SwapSmith</span>
                </div>
                <button 
                  onClick={() => setIsSidebarOpen(false)}
                  className="p-1 hover:bg-zinc-800 rounded-lg transition-colors"
                >
                  <PanelLeftClose className="w-4 h-4 text-zinc-400" />
                </button>
              </div>
              
              <button className="w-full flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors text-sm font-medium">
                <Plus className="w-4 h-4" />
                New Chat
              </button>
            </div>

            {/* Chat History */}
            <div className="flex-1 overflow-y-auto p-2">
              <div className="mb-4">
                <div className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  <Clock className="w-3 h-3" />
                  Recent
                </div>
                <div className="space-y-1">
                  {chatHistory.map((chat) => (
                    <button
                      key={chat.id}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-zinc-800 transition-colors group"
                    >
                      <p className="text-sm text-zinc-200 truncate group-hover:text-white transition-colors">
                        {chat.title}
                      </p>
                      <p className="text-xs text-zinc-600 mt-0.5">{chat.timestamp}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Sidebar Footer */}
            <div className="p-3 border-t border-zinc-800 space-y-1">
              <a 
                href="https://t.me/SwapSmithBot" 
                target='_blank'
                className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-zinc-800 transition-colors text-sm text-zinc-400 hover:text-white"
              >
                <MessageCircle className="w-4 h-4" />
                Support
              </a>
              <button className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-zinc-800 transition-colors text-sm text-zinc-400 hover:text-white">
                <Settings className="w-4 h-4" />
                Settings
              </button>
            </div>
          </>
        )}
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        
        {/* Top Navigation Bar */}
        <nav className="h-16 border-b border-zinc-800 px-4 flex items-center justify-between bg-zinc-900/30 backdrop-blur-xl">
          <div className="flex items-center gap-4">
            {!isSidebarOpen && (
              <button 
                onClick={() => setIsSidebarOpen(true)}
                className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
              >
                <PanelLeft className="w-5 h-5 text-zinc-400" />
              </button>
            )}
            {!isSidebarOpen && (
              <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                <div className="bg-blue-600 p-1.5 rounded-lg shadow-lg shadow-blue-600/20">
                  <Zap className="w-4 h-4 text-white" fill="white" />
                </div>
                <span className="text-sm font-black tracking-tighter uppercase">SwapSmith</span>
              </Link>
            )}
            
            {/* System Status */}
            <div className="flex items-center gap-3 px-3 py-1.5 bg-zinc-900/50 border border-zinc-800 rounded-lg">
              <div className="p-1.5 bg-blue-500/10 rounded-lg">
                <Zap className="w-3 h-3 text-blue-400" />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] text-emerald-500/80 font-bold uppercase tracking-widest">System Ready</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/" className="p-2 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-400 hover:text-white text-sm font-medium">
              Home
            </Link>
            <button className="p-2 hover:bg-zinc-800 rounded-lg transition-colors">
              <HelpCircle className="w-5 h-5 text-zinc-400 hover:text-white" />
            </button>
            <div className="h-6 w-px bg-zinc-800" />
            <WalletConnector />
          </div>
        </nav>

        {/* Chat Area */}
        <main className="flex-1 overflow-y-auto flex flex-col">
          
          {/* Header Section */}
          <div className="flex-shrink-0 pt-12 pb-8 px-4">
            <div className="max-w-3xl mx-auto text-center space-y-4">
              <h1 className="text-4xl md:text-6xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-b from-white to-white/40">
                Terminal Alpha.
              </h1>
              <p className="text-zinc-500 text-sm">
                Swap assets, create payment links, or scout yields with AI assistance
              </p>
            </div>
          </div>

          {/* Chat Messages Container */}
          <div className="flex-1 px-4 pb-8 overflow-y-auto">
            <div className="max-w-3xl mx-auto space-y-6">

              {/* Messages */}
              {messages.map((msg, index) => (
                <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2`}>
                  <div className={`max-w-[85%]`}>
                    {msg.role === 'user' ? (
                      <div className="bg-blue-600 text-white px-5 py-3 rounded-2xl rounded-tr-none shadow-lg shadow-blue-600/20 text-sm font-medium">
                        {msg.content}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="bg-zinc-900/50 border border-zinc-800 text-gray-200 px-5 py-4 rounded-2xl rounded-tl-none text-sm leading-relaxed backdrop-blur-sm">
                          {msg.type === 'message' && <div className="whitespace-pre-line">{msg.content}</div>}
                          {msg.type === 'yield_info' && <div className="font-mono text-xs text-blue-300">{msg.content}</div>}
                          {msg.type === 'intent_confirmation' && msg.data && 'parsedCommand' in msg.data && <IntentConfirmation command={msg.data.parsedCommand} onConfirm={handleIntentConfirm} />}
                          {msg.type === 'swap_confirmation' && msg.data && 'quoteData' in msg.data && <SwapConfirmation quote={msg.data.quoteData as QuoteData} confidence={msg.data.confidence} />}
                          {msg.type === 'checkout_link' && msg.data && 'url' in msg.data && (
                            <a href={msg.data.url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                              {msg.data.url}
                            </a>
                          )}
                        </div>
                      </div>
                    )}
                    <p className={`text-[10px] text-gray-500 mt-2 px-1 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                      {formatTime(msg.timestamp)}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Input Area - Fixed at bottom */}
          <div className="flex-shrink-0 pb-8 px-4">
            <div className="max-w-3xl mx-auto">
              <ClaudeChatInput 
                onSendMessage={handleSendMessage} 
                isRecording={isRecording}
                isAudioSupported={isAudioSupported}
                onStartRecording={handleStartRecording}
                onStopRecording={handleStopRecording}
                isConnected={isConnected}
              />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
