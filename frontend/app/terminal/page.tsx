"use client";

import { useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useAccount } from 'wagmi';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import ClaudeChatInput from '@/components/ClaudeChatInput';
import SwapConfirmation from '@/components/SwapConfirmation';
import IntentConfirmation from '@/components/IntentConfirmation';
import { ParsedCommand } from '@/utils/groq-client';
import { useErrorHandler, ErrorType } from '@/hooks/useErrorHandler';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { MessageCircle, Plus, Clock, Settings, Menu, Trash2 } from 'lucide-react';
import { useChatHistory, useChatSessions } from '@/hooks/useCachedData';

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
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  type?:
    | "message"
    | "intent_confirmation"
    | "swap_confirmation"
    | "yield_info"
    | "checkout_link";
  data?:
    | ParsedCommand
    | { quoteData: unknown; confidence: number }
    | { url: string }
    | { parsedCommand: ParsedCommand };
}

const SidebarSkeleton = () => (
  <div className="space-y-4 p-2">
    {[1, 2, 3, 4].map((i) => (
      <div key={i} className="px-3 py-2 space-y-2">
        <div className="h-3 w-3/4 bg-white/5 rounded animate-pulse" />
        <div className="h-2 w-1/4 bg-white/5 rounded animate-pulse" />
      </div>
    ))}
  </div>
);

const MessageListSkeleton = () => (
  <div className="space-y-6 animate-in fade-in duration-500">
    {/* Assistant Bubble 1 */}
    <div className="flex justify-start">
      <div className="bg-zinc-900/50 border border-zinc-800 px-5 py-4 rounded-2xl rounded-tl-none w-2/3 max-w-sm">
        <div className="space-y-2">
          <div className="h-2 w-full bg-white/5 rounded-full animate-pulse" />
          <div className="h-2 w-[80%] bg-white/5 rounded-full animate-pulse delay-75" />
        </div>
      </div>
    </div>
    {/* User Bubble (Right side) */}
    <div className="flex justify-end">
      <div className="bg-blue-600/20 border border-blue-600/10 px-5 py-4 rounded-2xl rounded-tr-none w-1/3">
        <div className="h-2 w-full bg-blue-400/20 rounded-full animate-pulse" />
      </div>
    </div>
    {/* Assistant Bubble 2 (Longer) */}
    <div className="flex justify-start">
      <div className="bg-zinc-900/50 border border-zinc-800 px-5 py-4 rounded-2xl rounded-tl-none w-full max-w-md">
        <div className="space-y-2">
          <div className="h-2 w-full bg-white/5 rounded-full animate-pulse" />
          <div className="h-2 w-full bg-white/5 rounded-full animate-pulse delay-100" />
          <div className="h-2 w-[60%] bg-white/5 rounded-full animate-pulse delay-150" />
        </div>
      </div>
    </div>
  </div>
);

export default function TerminalPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const [currentSessionId, setCurrentSessionId] = useState<string>(crypto.randomUUID());
  const sessionIdRef = useRef<string>(currentSessionId);
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);

  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Hello! I can help you swap assets, create payment links, or scout yields.\n\n💡 Tip: Try our Telegram Bot for on-the-go access!",
      timestamp: new Date(),
      type: "message",
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingCommand, setPendingCommand] = useState<ParsedCommand | null>(
    null,
  );

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { address, isConnected } = useAccount();
  const { handleError } = useErrorHandler();
  
  // Load chat sessions and history from database
  const { data: chatSessions, refetch: refetchSessions } = useChatSessions(user?.uid);
  const { data: dbChatHistory } = useChatHistory(user?.uid, currentSessionId);

  const {
    isRecording,
    isSupported: isAudioSupported,
    startRecording,
    stopRecording,
    error: audioError,
  } = useAudioRecorder({
    sampleRate: 16000,
    numberOfAudioChannels: 1,
  });

  // Protect route - redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [authLoading, isAuthenticated, router]);
  
  // Load messages from database on mount or when session changes
  useEffect(() => {
    if (dbChatHistory?.history && dbChatHistory.history.length > 0) {
      const loadedMessages = dbChatHistory.history.map((msg) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
        timestamp: new Date(msg.createdAt),
        type: "message" as const,
      }));
      setMessages(loadedMessages);
    } else {
      // Reset to welcome message for new/empty sessions
      setMessages([
        {
          role: "assistant",
          content: "Hello! I can help you swap assets, create payment links, or scout yields.\\n\\n\ud83d\udca1 Tip: Try our Telegram Bot for on-the-go access!",
          timestamp: new Date(),
          type: "message",
        },
      ]);
    }
  }, [dbChatHistory, currentSessionId]);

  const addMessage = useCallback(async (message: Omit<Message, "timestamp">) => {
    const newMessage = { ...message, timestamp: new Date() };
    setMessages((prev) => [...prev, newMessage]);
    
    // Save to database if user is authenticated
    if (user?.uid && (message.type === "message" || !message.type)) {
      try {
        await fetch('/api/chat/history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user.uid,
            walletAddress: address,
            role: message.role,
            content: message.content,
            sessionId: sessionIdRef.current,
            metadata: message.data ? { type: message.type, data: message.data } : null
          })
        });
        // Refresh sessions list after adding a message
        refetchSessions();
      } catch (error) {
        console.error('Failed to save message to database:', error);
      }
    }
  }, [user?.uid, address, refetchSessions]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setIsHistoryLoading(false), 1000);
    return () => clearTimeout(timer);
  }, []);

  // Update sessionIdRef when currentSessionId changes
  useEffect(() => {
    sessionIdRef.current = currentSessionId;
  }, [currentSessionId]);

  // Handle new chat
  const handleNewChat = useCallback(() => {
    const newSessionId = crypto.randomUUID();
    setCurrentSessionId(newSessionId);
    setMessages([
      {
        role: "assistant",
        content: "Hello! I can help you swap assets, create payment links, or scout yields.\n\n💡 Tip: Try our Telegram Bot for on-the-go access!",
        timestamp: new Date(),
        type: "message",
      },
    ]);
  }, []);

  // Handle switch session
  const handleSwitchSession = useCallback((sessionId: string) => {
    setCurrentSessionId(sessionId);
  }, []);

  // Handle delete session
  const handleDeleteSession = useCallback(async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!user?.uid) return;
    
    try {
      const response = await fetch(`/api/chat/history?userId=${user.uid}&sessionId=${sessionId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        // If deleted session is current, create new session
        if (sessionId === currentSessionId) {
          handleNewChat();
        }
        // Refresh sessions list
        await refetchSessions();
      }
    } catch (error) {
      console.error('Failed to delete session:', error);
    }
  }, [user?.uid, currentSessionId, handleNewChat, refetchSessions]);

  // Format relative time
  const formatRelativeTime = (timestamp: string) => {
    const now = new Date();
    const then = new Date(timestamp);
    const diffMs = now.getTime() - then.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return then.toLocaleDateString();
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (audioError) {
      addMessage({ role: "assistant", content: audioError, type: "message" });
    }
  }, [audioError, addMessage]);

  const formatTime = (date: Date) => {
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? "PM" : "AM";
    const displayHours = hours % 12 || 12;
    return `${displayHours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")} ${ampm}`;
  };

  const handleStartRecording = async () => {
    if (!isAudioSupported) {
      addMessage({
        role: "assistant",
        content: `Voice input is not supported in this browser. Please use text input instead.`,
        type: "message",
      });
      return;
    }
    try {
      await startRecording();
    } catch (err) {
      const errorMessage = handleError(err, ErrorType.VOICE_ERROR, {
        operation: "microphone_access",
        retryable: true,
      });
      addMessage({ role: "assistant", content: errorMessage, type: "message" });
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
        operation: "stop_recording",
        retryable: true,
      });
      addMessage({ role: "assistant", content: errorMessage, type: "message" });
    }
  };

  const handleVoiceInput = async (audioBlob: Blob) => {
    setIsLoading(true);
    addMessage({
      role: "user",
      content: "🎤 [Sending Voice...]",
      type: "message",
    });

    const formData = new FormData();
    let fileName = "voice.webm";
    if (audioBlob.type.includes("mp4")) fileName = "voice.mp4";
    else if (audioBlob.type.includes("wav")) fileName = "voice.wav";
    else if (audioBlob.type.includes("ogg")) fileName = "voice.ogg";

    formData.append("file", audioBlob, fileName);

    try {
      const response = await fetch("/api/transcribe", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) throw new Error("Transcription failed");
      const data = await response.json();

      if (data.text) {
        setMessages((prev) => {
          const newMsgs = [...prev];
          const lastIndex = newMsgs.length - 1;
          if (
            lastIndex >= 0 &&
            newMsgs[lastIndex].content === "🎤 [Sending Voice...]"
          ) {
            newMsgs[lastIndex] = {
              ...newMsgs[lastIndex],
              content: `🎤 "${data.text}"`,
            };
          }
          return newMsgs;
        });
        await processCommand(data.text);
      } else {
        addMessage({
          role: "assistant",
          content: "I couldn't hear anything clearly.",
          type: "message",
        });
        setIsLoading(false);
      }
    } catch (error) {
      const errorMessage = handleError(error, ErrorType.VOICE_ERROR, {
        operation: "voice_transcription",
        retryable: true,
      });
      setMessages((prev) =>
        prev.filter((m) => m.content !== "🎤 [Sending Voice...]"),
      );
      addMessage({ role: "assistant", content: errorMessage, type: "message" });
      setIsLoading(false);
    }
  };

  const processCommand = async (text: string) => {
    if (!isLoading) setIsLoading(true);
    try {
      const response = await fetch("/api/parse-command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const command: ParsedCommand = await response.json();

      if (!command.success && command.intent !== "yield_scout") {
        addMessage({
          role: "assistant",
          content: `I couldn't understand. ${command.validationErrors.join(", ")}`,
          type: "message",
        });
        setIsLoading(false);
        return;
      }

      if (command.intent === "yield_scout") {
        const yieldRes = await fetch("/api/yields");
        const yieldData = await yieldRes.json();
        addMessage({
          role: "assistant",
          content: yieldData.message,
          type: "yield_info",
        });
        setIsLoading(false);
        return;
      }

      if (command.intent === "checkout") {
        let finalAddress = command.settleAddress;
        if (!finalAddress) {
          if (!isConnected || !address) {
            addMessage({
              role: "assistant",
              content:
                "To create a receive link for yourself, please connect your wallet first.",
              type: "message",
            });
            setIsLoading(false);
            return;
          }
          finalAddress = address;
        }
        const checkoutRes = await fetch("/api/create-checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            settleAsset: command.settleAsset,
            settleNetwork: command.settleNetwork,
            settleAmount: command.settleAmount,
            settleAddress: finalAddress,
          }),
        });
        const checkoutData = await checkoutRes.json();
        if (checkoutData.error) throw new Error(checkoutData.error);
        addMessage({
          role: "assistant",
          content: `Payment Link Created for ${checkoutData.settleAmount} ${checkoutData.settleCoin} on ${command.settleNetwork}`,
          type: "checkout_link",
          data: { url: checkoutData.url },
        });
        setIsLoading(false);
        return;
      }

      if (command.intent === "portfolio" && command.portfolio) {
        addMessage({
          role: "assistant",
          content: `📊 **Portfolio Strategy Detected**\nSplitting ${command.amount} ${command.fromAsset} into multiple assets. Generating orders...`,
          type: "message",
        });
        for (const item of command.portfolio) {
          const splitAmount = (command.amount! * item.percentage) / 100;
          const subCommand: ParsedCommand = {
            ...command,
            intent: "swap",
            amount: splitAmount,
            toAsset: item.toAsset,
            toChain: item.toChain,
            portfolio: undefined,
            confidence: 100,
          };
          await executeSwap(subCommand);
        }
        setIsLoading(false);
        return;
      }

      if (command.requiresConfirmation || command.confidence < 80) {
        setPendingCommand(command);
        addMessage({
          role: "assistant",
          content: "",
          type: "intent_confirmation",
          data: { parsedCommand: command },
        });
      } else {
        await executeSwap(command);
      }
    } catch (error: unknown) {
      const errorMessage = handleError(error, ErrorType.API_FAILURE, {
        operation: "command_processing",
        retryable: true,
      });
      addMessage({ role: "assistant", content: errorMessage, type: "message" });
    } finally {
      setIsLoading(false);
    }
  };

  const executeSwap = async (command: ParsedCommand) => {
    try {
      const quoteResponse = await fetch("/api/create-swap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromAsset: command.fromAsset,
          toAsset: command.toAsset,
          amount: command.amount,
          fromChain: command.fromChain,
          toChain: command.toChain,
          userId: user?.uid,
          walletAddress: address,
        }),
      });
      const quote = await quoteResponse.json();
      if (quote.error) throw new Error(quote.error);
      addMessage({
        role: "assistant",
        content: `Swap Prepared: ${quote.depositAmount} ${quote.depositCoin} → ${quote.settleAmount} ${quote.settleCoin}`,
        type: "swap_confirmation",
        data: { quoteData: quote, confidence: command.confidence },
      });
    } catch (error: unknown) {
      const errorMessage = handleError(error, ErrorType.API_FAILURE, {
        operation: "swap_quote",
        retryable: true,
      });
      addMessage({ role: "assistant", content: errorMessage, type: "message" });
    }
  };

  const handleIntentConfirm = async (confirmed: boolean) => {
    if (confirmed && pendingCommand) {
      if (pendingCommand.intent === "portfolio") {
        const confirmedCmd = {
          ...pendingCommand,
          requiresConfirmation: false,
          confidence: 100,
        };
        addMessage({
          role: "assistant",
          content: "Executing Portfolio Strategy...",
          type: "message",
        });
        if (confirmedCmd.portfolio) {
          for (const item of confirmedCmd.portfolio) {
            const splitAmount = (confirmedCmd.amount! * item.percentage) / 100;
            await executeSwap({
              ...confirmedCmd,
              intent: "swap",
              amount: splitAmount,
              toAsset: item.toAsset,
              toChain: item.toChain,
            });
          }
        }
      } else {
        await executeSwap(pendingCommand);
      }
    } else if (!confirmed) {
      addMessage({ role: "assistant", content: "Cancelled.", type: "message" });
    }
    setPendingCommand(null);
  };

  const handleSendMessage = (data: {
    message: string;
    files: Array<{
      id: string;
      file: File;
      type: string;
      preview: string | null;
      uploadStatus: string;
      content?: string;
    }>;
    pastedContent: Array<{
      id: string;
      file: File;
      type: string;
      preview: string | null;
      uploadStatus: string;
      content?: string;
    }>;
    model: string;
    isThinkingEnabled: boolean;
  }) => {
    if (data.message.trim()) {
      addMessage({ role: "user", content: data.message, type: "message" });
      processCommand(data.message);
    }
  };

  // Show loading state while checking authentication
  if (authLoading) {
    return (
      <div className="flex h-screen bg-[#050505] items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-zinc-400">Authenticating...</p>
        </div>
      </div>
    );
  }

  // Don't render if not authenticated (will redirect)
  if (!isAuthenticated) {
    return null;
  }

  return (
    <>
      <Navbar />
      
      <div className="flex h-screen bg-[#050505] text-white overflow-hidden pt-16">
        {/* Sidebar */}
        <aside
          className={`${isSidebarOpen ? 'w-80' : 'w-0'} transition-all duration-300 bg-zinc-900/50 border-r border-zinc-800 flex flex-col overflow-hidden`}
        >
          {isSidebarOpen && (
            <>
              <div className="p-4 border-b border-zinc-800">
                <button 
                  onClick={handleNewChat}
                  className="w-full flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors text-sm font-medium"
                >
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
                    {isHistoryLoading ? (
                      <SidebarSkeleton />
                    ) : chatSessions?.sessions && chatSessions.sessions.length > 0 ? (
                      chatSessions.sessions.map((chat) => (
                        <div
                          key={chat.sessionId}
                          className={`w-full text-left px-3 py-2 rounded-lg hover:bg-zinc-800 transition-colors group relative ${
                            chat.sessionId === currentSessionId ? 'bg-zinc-800' : ''
                          }`}
                        >
                          <button
                            onClick={() => handleSwitchSession(chat.sessionId)}
                            className="w-full text-left pr-8"
                          >
                            <p className="text-sm text-zinc-200 truncate group-hover:text-white transition-colors">
                              {chat.title}
                            </p>
                            <p className="text-xs text-zinc-600 mt-0.5">
                              {formatRelativeTime(chat.timestamp)}
                            </p>
                          </button>
                          <button
                            onClick={(e) => handleDeleteSession(chat.sessionId, e)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 opacity-0 group-hover:opacity-100 hover:bg-red-500/20 rounded transition-all"
                            title="Delete chat"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-red-400" />
                          </button>
                        </div>
                      ))
                    ) : (
                      <div className="px-3 py-4 text-center text-sm text-zinc-500">
                        No chat history yet
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Sidebar Footer */}
              <div className="p-3 border-t border-zinc-800 space-y-1">
                <a
                  href="https://t.me/SwapSmithBot"
                  target="_blank"
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
          {/* Chat Area */}
          <main className="flex-1 overflow-y-auto flex flex-col">
            
            {/* Sidebar Toggle Button */}
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="fixed top-20 left-4 z-40 p-2 bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-700 rounded-lg transition-colors shadow-lg"
              title={isSidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
            >
              <Menu className="w-5 h-5 text-zinc-300" />
            </button>

            {/* Header Section */}
            <div className="flex-shrink-0 pt-12 pb-8 px-4">
              <div className="max-w-3xl mx-auto text-center space-y-4">
                <h1 className="text-4xl md:text-6xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-b from-white to-white/40">
                  Terminal Alpha.
                </h1>
                <p className="text-zinc-500 text-sm">
                  Swap assets, create payment links, or scout yields with AI
                  assistance
                </p>
              </div>
            </div>

            {/* Chat Messages Container */}
            <div className="flex-1 px-4 pb-8 overflow-y-auto">
              <div className="max-w-3xl mx-auto space-y-6">
                {/* SHOW SKELETON LIST IF INITIAL DATA IS LOADING */}
                {isHistoryLoading ? (
                  <MessageListSkeleton />
                ) : (
                  <>
                    {/* Render Real Messages */}
                    {messages.map((msg, index) => (
                      <div
                        key={index}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2`}
                      >
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
                          <p
                            className={`text-[10px] text-gray-500 mt-2 px-1 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}
                          >
                            {formatTime(msg.timestamp)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </>
                )}

                {/* SHOW SINGLE SKELETON BUBBLE IF AI IS CURRENTLY PROCESSING A NEW REQUEST */}
                {isLoading && !isHistoryLoading && <MessageListSkeleton />}

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
    </>
  );
}
