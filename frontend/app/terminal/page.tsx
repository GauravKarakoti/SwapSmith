// app/terminal/page.tsx

"use client";

import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useAccount } from 'wagmi';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Navbar from '@/components/Navbar';
import ClaudeChatInput from '@/components/ClaudeChatInput';
import SwapConfirmation from '@/components/SwapConfirmation';
import IntentConfirmation from '@/components/IntentConfirmation';
import { ParsedCommand } from '@/utils/groq-client';
import { useErrorHandler, ErrorType } from '@/hooks/useErrorHandler';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { MessageCircle, Plus, Clock, Settings, Menu, Sparkles, TrendingUp, Zap, BarChart3, Activity } from 'lucide-react';
import Link from 'next/link';

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

// Floating particles component
const FloatingParticle = ({ delay, duration, x, y }: { delay: number; duration: number; x: number; y: number }) => (
  <motion.div
    className="absolute w-1 h-1 bg-gradient-to-r from-cyan-400 to-purple-500 rounded-full"
    style={{ left: `${x}%`, top: `${y}%` }}
    animate={{
      y: [-20, 20, -20],
      x: [-10, 10, -10],
      opacity: [0.2, 0.8, 0.2],
      scale: [1, 1.5, 1],
    }}
    transition={{
      duration,
      delay,
      repeat: Infinity,
      ease: "easeInOut",
    }}
  />
);

const SidebarSkeleton = () => (
  <div className="space-y-4 p-2">
    {[1, 2, 3, 4].map((i) => (
      <motion.div 
        key={i} 
        className="px-3 py-2 space-y-2"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: i * 0.1 }}
      >
        <div className="h-3 w-3/4 bg-white/5 rounded animate-pulse" />
        <div className="h-2 w-1/4 bg-white/5 rounded animate-pulse" />
      </motion.div>
    ))}
  </div>
);

const MessageListSkeleton = () => (
  <div className="space-y-6">
    {/* Assistant Bubble 1 */}
    <motion.div 
      className="flex justify-start"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="bg-zinc-900/50 border border-zinc-800 px-5 py-4 rounded-2xl rounded-tl-none w-2/3 max-w-sm backdrop-blur-sm">
        <div className="space-y-2">
          <div className="h-2 w-full bg-white/5 rounded-full animate-pulse" />
          <div className="h-2 w-[80%] bg-white/5 rounded-full animate-pulse delay-75" />
        </div>
      </div>
    </motion.div>
    
    {/* User Bubble (Right side) */}
    <motion.div 
      className="flex justify-end"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
    >
      <div className="bg-gradient-to-r from-cyan-600 to-blue-600 px-5 py-4 rounded-2xl rounded-tr-none w-1/3">
        <div className="h-2 w-full bg-blue-400/20 rounded-full animate-pulse" />
      </div>
    </motion.div>
    
    {/* Assistant Bubble 2 (Longer) */}
    <motion.div 
      className="flex justify-start"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.4 }}
    >
      <div className="bg-zinc-900/50 border border-zinc-800 px-5 py-4 rounded-2xl rounded-tl-none w-full max-w-md backdrop-blur-sm">
        <div className="space-y-2">
          <div className="h-2 w-full bg-white/5 rounded-full animate-pulse" />
          <div className="h-2 w-full bg-white/5 rounded-full animate-pulse delay-100" />
          <div className="h-2 w-[60%] bg-white/5 rounded-full animate-pulse delay-150" />
        </div>
      </div>
    </motion.div>
  </div>
);

// Live Stats Card Component
const LiveStatsCard = () => {
  const [stats, setStats] = useState({
    gasPrice: Math.floor(Math.random() * 20) + 10,
    volume24h: (Math.random() * 5 + 1).toFixed(1),
    activeSwaps: Math.floor(Math.random() * 50) + 100,
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setStats({
        gasPrice: Math.floor(Math.random() * 20) + 10,
        volume24h: (Math.random() * 5 + 1).toFixed(1),
        activeSwaps: Math.floor(Math.random() * 50) + 100,
      });
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-zinc-900/80 to-zinc-800/50 border border-zinc-700/50 rounded-2xl p-4 backdrop-blur-xl"
    >
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-cyan-900/30 flex items-center justify-center border border-cyan-500/30">
          <Activity className="w-4 h-4 text-cyan-400" />
        </div>
        <span className="font-bold text-sm text-zinc-200">Live Network Stats</span>
        <span className="ml-auto text-xs font-semibold text-emerald-400 bg-emerald-900/20 px-2 py-1 rounded-full border border-emerald-500/20 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> Live
        </span>
      </div>
      
      <div className="grid grid-cols-3 gap-3">
        <div className="text-center">
          <motion.div 
            key={stats.gasPrice}
            initial={{ scale: 1.2, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-lg font-black text-cyan-400 flex items-center justify-center gap-1"
          >
            <Zap className="w-3 h-3" />
            {stats.gasPrice}
          </motion.div>
          <div className="text-[10px] text-zinc-500 font-medium">Gwei</div>
        </div>
        
        <div className="text-center">
          <motion.div 
            key={stats.volume24h}
            initial={{ scale: 1.2, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-lg font-black text-purple-400"
          >
            ${stats.volume24h}M
          </motion.div>
          <div className="text-[10px] text-zinc-500 font-medium">24h Vol</div>
        </div>
        
        <div className="text-center">
          <motion.div 
            key={stats.activeSwaps}
            initial={{ scale: 1.2, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-lg font-black text-pink-400"
          >
            {stats.activeSwaps}
          </motion.div>
          <div className="text-[10px] text-zinc-500 font-medium">Active</div>
        </div>
      </div>
    </motion.div>
  );
};

export default function TerminalPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  const [chatHistory, setChatHistory] = useState([
    { id: 1, title: "Swap ETH to USDC", timestamp: "2 hours ago" },
    { id: 2, title: "Check yield opportunities", timestamp: "Yesterday" },
    { id: 3, title: "Create payment link", timestamp: "2 days ago" },
    { id: 4, title: "Swap BTC to ETH", timestamp: "1 week ago" },
  ]);

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
  const [pendingCommand, setPendingCommand] = useState<ParsedCommand | null>(null);
  const [particles] = useState(() =>
    Array.from({ length: 20 }, (_, i) => ({
      id: i,
      delay: Math.random() * 3,
      duration: 4 + Math.random() * 4,
      x: Math.random() * 100,
      y: Math.random() * 100,
    }))
  );

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { address, isConnected } = useAccount();
  const { handleError } = useErrorHandler();

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

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setIsHistoryLoading(false), 1000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (audioError) {
      addMessage({ role: "assistant", content: audioError, type: "message" });
    }
  }, [audioError]);

  const formatTime = (date: Date) => {
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? "PM" : "AM";
    const displayHours = hours % 12 || 12;
    return `${displayHours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")} ${ampm}`;
  };

  const addMessage = (message: Omit<Message, "timestamp">) => {
    setMessages((prev) => [...prev, { ...message, timestamp: new Date() }]);
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
      setChatHistory([
        {
          id: Date.now(),
          title: data.message.slice(0, 50),
          timestamp: "Just now",
        },
        ...chatHistory,
      ]);
    }
  };

  // Show loading state while checking authentication
  if (authLoading) {
    return (
      <div className="flex h-screen bg-[#050505] items-center justify-center">
        <div className="text-center">
          <motion.div 
            className="mx-auto mb-4 w-12 h-12 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          />
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
      
      <div className="flex h-screen bg-[#030308] text-white overflow-hidden pt-16 relative">
        {/* Animated background gradient */}
        <div className="fixed inset-0 pointer-events-none">
          <motion.div
            className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-gradient-to-r from-cyan-500/5 via-purple-500/5 to-pink-500/5 rounded-full blur-[150px]"
            animate={{
              x: [0, 100, 0],
              y: [0, 50, 0],
              scale: [1, 1.2, 1],
            }}
            transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-gradient-to-r from-purple-500/5 via-pink-500/5 to-cyan-500/5 rounded-full blur-[150px]"
            animate={{
              x: [0, -80, 0],
              y: [0, -60, 0],
              scale: [1.2, 1, 1.2],
            }}
            transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
          />
          
          {/* Floating particles */}
          {particles.map((p) => (
            <FloatingParticle key={p.id} {...p} />
          ))}
        </div>

        {/* Grid overlay */}
        <div
          className="fixed inset-0 pointer-events-none opacity-[0.015]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: '60px 60px',
          }}
        />

        {/* Sidebar */}
        <AnimatePresence>
          {isSidebarOpen && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 320, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="bg-gradient-to-b from-zinc-900/50 to-zinc-900/30 border-r border-zinc-800/50 flex flex-col overflow-hidden backdrop-blur-xl relative z-10"
            >
              <div className="p-4 border-b border-zinc-800/50">
                <motion.button 
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 rounded-xl transition-all duration-300 text-sm font-bold shadow-lg shadow-cyan-900/20"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Plus className="w-4 h-4" />
                  New Chat
                </motion.button>
              </div>

              {/* Live Stats Card */}
              <div className="px-4 pt-4">
                <LiveStatsCard />
              </div>

              {/* Chat History */}
              <div className="flex-1 overflow-y-auto p-2 mt-4">
                <div className="mb-4">
                  <div className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                    <Clock className="w-3 h-3" />
                    Recent Chats
                  </div>
                  <div className="space-y-1">
                    {isHistoryLoading ? (
                      <SidebarSkeleton />
                    ) : (
                      chatHistory.map((chat, index) => (
                        <motion.button
                          key={chat.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.1 }}
                          className="w-full text-left px-3 py-3 rounded-xl hover:bg-white/5 transition-all duration-200 group border border-transparent hover:border-cyan-500/20"
                          whileHover={{ x: 4 }}
                        >
                          <p className="text-sm text-zinc-300 truncate group-hover:text-white transition-colors font-medium">
                            {chat.title}
                          </p>
                          <p className="text-xs text-zinc-600 mt-0.5">
                            {chat.timestamp}
                          </p>
                        </motion.button>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Sidebar Footer */}
              <div className="p-3 border-t border-zinc-800/50 space-y-1 bg-zinc-900/30">
                <motion.a
                  href="https://t.me/SwapSmithBot"
                  target="_blank"
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 transition-all duration-200 text-sm text-zinc-400 hover:text-cyan-400 group"
                  whileHover={{ x: 4 }}
                >
                  <MessageCircle className="w-4 h-4 group-hover:scale-110 transition-transform" />
                  Support
                </motion.a>
                <Link href="/profile">
                  <motion.button 
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 transition-all duration-200 text-sm text-zinc-400 hover:text-purple-400 group"
                    whileHover={{ x: 4 }}
                  >
                    <Settings className="w-4 h-4 group-hover:rotate-90 transition-transform duration-300" />
                    Settings
                  </motion.button>
                </Link>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden relative z-10">
          {/* Chat Area */}
          <main className="flex-1 overflow-y-auto flex flex-col">
            
            {/* Sidebar Toggle Button */}
            <motion.button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="fixed top-20 left-4 z-40 p-2.5 bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-700/50 rounded-xl transition-all duration-300 shadow-lg backdrop-blur-sm group"
              title={isSidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Menu className="w-5 h-5 text-zinc-300 group-hover:text-cyan-400 transition-colors" />
            </motion.button>

            {/* Header Section */}
            <div className="flex-shrink-0 pt-16 pb-8 px-4">
              <motion.div 
                className="max-w-3xl mx-auto text-center space-y-4"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
              >
                <motion.div
                  className="flex justify-center mb-4"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.2 }}
                >
                  <motion.div
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500/10 to-purple-500/10 border border-cyan-500/20 rounded-full"
                    animate={{ 
                      boxShadow: [
                        "0 0 20px rgba(34,211,238,0.1)", 
                        "0 0 40px rgba(34,211,238,0.2)", 
                        "0 0 20px rgba(34,211,238,0.1)"
                      ] 
                    }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <Sparkles className="w-4 h-4 text-cyan-400" />
                    <span className="text-xs font-semibold text-cyan-300 tracking-wider uppercase">AI Trading Assistant</span>
                  </motion.div>
                </motion.div>

                <h1 className="text-5xl md:text-7xl font-black tracking-tighter leading-[0.9]">
                  <span className="bg-gradient-to-b from-white via-white to-white/40 bg-clip-text text-transparent">
                    Terminal
                  </span>
                  <br />
                  <motion.span
                    className="bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent"
                    animate={{
                      backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
                    }}
                    transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
                    style={{ backgroundSize: "200% 200%" }}
                  >
                    Alpha.
                  </motion.span>
                </h1>
                
                <p className="text-zinc-500 text-sm max-w-xl mx-auto">
                  Swap assets, create payment links, or scout yields with AI assistance
                </p>
              </motion.div>
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
                    <AnimatePresence mode="popLayout">
                      {messages.map((msg, index) => (
                        <motion.div
                          key={index}
                          initial={{ opacity: 0, y: 20, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          transition={{ duration: 0.3, ease: "easeOut" }}
                          className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                          <div className={`max-w-[85%]`}>
                            {msg.role === 'user' ? (
                              <motion.div 
                                className="bg-gradient-to-r from-cyan-600 to-blue-600 text-white px-5 py-3.5 rounded-2xl rounded-tr-none shadow-lg shadow-cyan-900/20 text-sm font-medium relative overflow-hidden"
                                whileHover={{ scale: 1.02 }}
                                transition={{ duration: 0.2 }}
                              >
                                <motion.div
                                  className="absolute inset-0 bg-gradient-to-r from-cyan-400 to-blue-400"
                                  initial={{ x: "-100%" }}
                                  animate={{ x: "100%" }}
                                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                                  style={{ opacity: 0.1 }}
                                />
                                <span className="relative z-10">{msg.content}</span>
                              </motion.div>
                            ) : (
                              <div className="space-y-3">
                                <motion.div 
                                  className="bg-gradient-to-br from-zinc-900/80 to-zinc-800/50 border border-zinc-700/50 text-gray-200 px-5 py-4 rounded-2xl rounded-tl-none text-sm leading-relaxed backdrop-blur-xl relative overflow-hidden group"
                                  whileHover={{ scale: 1.01 }}
                                  transition={{ duration: 0.2 }}
                                >
                                  {/* Subtle glow effect on hover */}
                                  <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/0 via-purple-500/0 to-pink-500/0 group-hover:from-cyan-500/5 group-hover:via-purple-500/5 group-hover:to-pink-500/5 transition-all duration-500 rounded-2xl" />
                                  
                                  <div className="relative z-10">
                                    {msg.type === 'message' && <div className="whitespace-pre-line">{msg.content}</div>}
                                    {msg.type === 'yield_info' && <div className="font-mono text-xs text-cyan-300 bg-cyan-950/30 p-3 rounded-lg border border-cyan-800/30">{msg.content}</div>}
                                    {msg.type === 'intent_confirmation' && msg.data && 'parsedCommand' in msg.data && (
                                      <IntentConfirmation command={msg.data.parsedCommand} onConfirm={handleIntentConfirm} />
                                    )}
                                    {msg.type === 'swap_confirmation' && msg.data && 'quoteData' in msg.data && (
                                      <SwapConfirmation quote={msg.data.quoteData as QuoteData} confidence={msg.data.confidence} />
                                    )}
                                    {msg.type === 'checkout_link' && msg.data && 'url' in msg.data && (
                                      <motion.a 
                                        href={msg.data.url} 
                                        target="_blank" 
                                        rel="noopener noreferrer" 
                                        className="text-cyan-400 hover:text-cyan-300 underline underline-offset-2 flex items-center gap-2 group"
                                        whileHover={{ x: 4 }}
                                      >
                                        <span>{msg.data.url}</span>
                                        <motion.span
                                          animate={{ x: [0, 4, 0] }}
                                          transition={{ duration: 1.5, repeat: Infinity }}
                                        >
                                          →
                                        </motion.span>
                                      </motion.a>
                                    )}
                                  </div>
                                </motion.div>
                              </div>
                            )}
                            <p
                              className={`text-[10px] text-zinc-600 mt-2 px-1 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}
                            >
                              {formatTime(msg.timestamp)}
                            </p>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </>
                )}

                {/* SHOW SINGLE SKELETON BUBBLE IF AI IS CURRENTLY PROCESSING A NEW REQUEST */}
                {isLoading && !isHistoryLoading && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <MessageListSkeleton />
                  </motion.div>
                )}

                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Input Area - Fixed at bottom */}
            <div className="flex-shrink-0 pb-8 px-4 relative z-20">
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