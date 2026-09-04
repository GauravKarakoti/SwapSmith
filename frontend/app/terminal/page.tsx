"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import {
  MessageCircle,
  Clock,
  Settings,
  Menu,
  Zap,
  Activity,
  Trash2,
  BarChart3,
  Terminal as TerminalIcon,
} from "lucide-react";
import dynamic from "next/dynamic";

import Navbar from "@/components/Navbar";
import ClaudeChatInput from "@/components/ClaudeChatInput";
import SwapConfirmation from "@/components/SwapConfirmation";
import IntentConfirmation from "@/components/IntentConfirmation";
import FullPageAd from "@/components/FullPageAd";
import PlanLimitBanner from "@/components/PlanLimitBanner";
import { useTerminalFullPageAd } from "@/hooks/useAds";

import { useChatHistory, useChatSessions } from "@/hooks/useCachedData";
import { useErrorHandler, ErrorType } from "@/hooks/useErrorHandler";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { usePlan } from "@/hooks/usePlan";
import { ParsedCommand } from "@/utils/groq-client";

const MotionDiv = dynamic(
  () => import('framer-motion').then(mod => ({ default: mod.motion.div })),
  { ssr: false }
);

const AnimatePresence = dynamic(
  () => import('framer-motion').then(mod => ({ default: mod.AnimatePresence })),
  { ssr: false }
);

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  type?: "message" | "intent_confirmation" | "swap_confirmation" | "yield_info" | "checkout_link";
  data?: any;
}

const LiveTradingDesk = () => {
  const [stats, setStats] = useState({ gasPrice: 20, volume24h: "2.4", activeSwaps: 142 });
  const [orderBook, setOrderBook] = useState<{price: string, amount: string, type: 'buy'|'sell'}[]>([]);

  useEffect(() => {
    const id = setInterval(() => {
      setStats({
        gasPrice: Math.floor(Math.random() * 20) + 10,
        volume24h: (Math.random() * 5 + 1).toFixed(1),
        activeSwaps: Math.floor(Math.random() * 50) + 100,
      });
      
      const newOrders = Array.from({ length: 4 }).map(() => ({
        price: (Math.random() * 1000 + 2000).toFixed(2),
        amount: (Math.random() * 5).toFixed(4),
        type: Math.random() > 0.5 ? 'buy' : 'sell' as 'buy' | 'sell'
      }));
      setOrderBook(newOrders);
    }, 3000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="space-y-4">
      <div className="bg-gray-900/80 border border-cyan-900/30 rounded-xl p-4 shadow-[0_0_15px_rgba(6,182,212,0.05)]">
        <div className="flex items-center gap-2 mb-3">
          <Activity className="w-4 h-4 text-cyan-400 animate-pulse" />
          <span className="text-xs font-bold uppercase tracking-wider text-cyan-50">Live Telemetry</span>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center divide-x divide-gray-800">
          <div>
            <div className="text-cyan-400 font-mono font-bold flex justify-center items-center gap-1 text-sm">
              <Zap className="w-3 h-3" /> {stats.gasPrice}
            </div>
            <div className="text-[9px] uppercase tracking-widest text-gray-500 mt-1">Gwei</div>
          </div>
          <div>
            <div className="text-purple-400 font-mono font-bold text-sm">${stats.volume24h}M</div>
            <div className="text-[9px] uppercase tracking-widest text-gray-500 mt-1">24h Vol</div>
          </div>
          <div>
            <div className="text-pink-400 font-mono font-bold text-sm">{stats.activeSwaps}</div>
            <div className="text-[9px] uppercase tracking-widest text-gray-500 mt-1">Active</div>
          </div>
        </div>
      </div>

      <div className="bg-gray-900/80 border border-cyan-900/30 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="w-4 h-4 text-purple-400" />
          <span className="text-xs font-bold uppercase tracking-wider text-cyan-50">Order Stream</span>
        </div>
        <div className="space-y-1.5 font-mono text-[10px]">
          <div className="flex justify-between text-gray-500 mb-2 border-b border-gray-800 pb-1">
            <span>PRICE (USD)</span>
            <span>AMOUNT</span>
          </div>
          {orderBook.map((order, idx) => (
            <div key={idx} className="flex justify-between items-center">
              <span className={order.type === 'buy' ? 'text-emerald-400' : 'text-rose-400'}>
                ${order.price}
              </span>
              <span className="text-gray-300">{order.amount}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default function TerminalPage() {
  const { isConnected } = useAccount();
  const { handleError } = useErrorHandler();
  const { status: planStatus, checkTerminalUsage } = usePlan();
  
  const [limitBannerVisible, setLimitBannerVisible] = useState(false);
  const { showAd, dismiss: dismissAd } = useTerminalFullPageAd();
  const isAdFree = planStatus?.plan === 'premium' || planStatus?.plan === 'pro';

  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "SYSTEM ONLINE. Awaiting protocol execution (Swap, Stake, Yield Scout).\n\n💡 Terminal Tip: Use natural language for multi-hop operations.",
      timestamp: new Date(),
      type: "message",
    },
  ]);
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isInputDisabled, setIsInputDisabled] = useState(true);
  const [pendingMessages, setPendingMessages] = useState<Message[]>([]);

  const [currentSessionId, setCurrentSessionId] = useState(crypto.randomUUID());
  const loadedSessionRef = useRef<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { data: chatSessions } = useChatSessions(undefined);
  const { data: dbChatHistory } = useChatHistory(undefined, currentSessionId);
  const { isRecording, isSupported: isAudioSupported, startRecording, stopRecording, error: audioError } = useAudioRecorder();

  useEffect(() => {
    setIsHistoryLoading(true);
    setIsInputDisabled(true);
    setPendingMessages([]);
    loadedSessionRef.current = null;
  }, [currentSessionId]);

  useEffect(() => {
    if (loadedSessionRef.current === currentSessionId) return;
    if (dbChatHistory?.history?.length) {
      const loadedMessages = dbChatHistory.history.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
        timestamp: new Date(m.createdAt),
        type: "message" as const,
      }));

      queueMicrotask(() => {
        setMessages(prev => {
          const initialMessage = prev.length === 1 && prev[0].role === "assistant" ? prev[0] : null;
          const allMessages = [...loadedMessages, ...pendingMessages].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
          return initialMessage ? [initialMessage, ...allMessages] : allMessages;
        });
        setIsHistoryLoading(false);
        setIsInputDisabled(false);
        setPendingMessages([]);
      });
      loadedSessionRef.current = currentSessionId;
    } else {
      queueMicrotask(() => {
        if (pendingMessages.length > 0) {
          setMessages(prev => [...prev, ...pendingMessages]);
          setPendingMessages([]);
        }
        setIsHistoryLoading(false);
        setIsInputDisabled(false);
      });
    }
  }, [dbChatHistory, currentSessionId, pendingMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const addMessage = useCallback((msg: Omit<Message, "timestamp">) => {
    const newMessage = { ...msg, timestamp: new Date() };
    if (isHistoryLoading) {
      setPendingMessages(prev => [...prev, newMessage]);
    } else {
      setMessages(prev => [...prev, newMessage]);
    }
  }, [isHistoryLoading]);

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
      const errorMessage = handleError(error, ErrorType.API_FAILURE, { operation: "swap_quote", retryable: true });
      addMessage({ role: "assistant", content: errorMessage, type: "message" });
    }
  };

  const processCommand = async (text: string) => {
    if (!text.trim() || isInputDisabled) return;
    
    const usageCheck = await checkTerminalUsage();
    if (!usageCheck.allowed) {
      setLimitBannerVisible(true);
      return;
    }

    addMessage({ role: "user", content: text, type: "message" });
    setIsLoading(true);

    try {
      const response = await fetch("/api/parse-command", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-requested-with": "XMLHttpRequest" },
        body: JSON.stringify({ message: text }),
      });
      const command: ParsedCommand = await response.json();

      if (!command.success && command.intent !== "yield_scout") {
        addMessage({ role: "assistant", content: `I couldn't understand. ${command.validationErrors?.join(", ") || "Please try again."}`, type: "message" });
        setIsLoading(false);
        return;
      }

      if (command.requiresConfirmation || command.confidence < 80) {
        addMessage({ role: "assistant", content: "", type: "intent_confirmation", data: { parsedCommand: command } });
      } else {
        await executeSwap(command);
      }
    } catch (error: unknown) {
      const errorMessage = handleError(error, ErrorType.API_FAILURE, { operation: "command_processing", retryable: true });
      addMessage({ role: "assistant", content: errorMessage, type: "message" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Navbar />
      {showAd && !isAdFree && <FullPageAd variant="plans" duration={12000} onDismiss={dismissAd} />}

      <div className="flex h-screen pt-16 bg-[#030712] overflow-hidden font-sans">
        <AnimatePresence>
          {isSidebarOpen && (
            <MotionDiv
              initial={{ width: 0 }}
              animate={{ width: 340 }}
              exit={{ width: 0 }}
              className="bg-gray-950 border-r border-gray-800 flex flex-col z-10"
            >
              <div className="p-5">
                <button
                  onClick={() => { setCurrentSessionId(crypto.randomUUID()); setMessages([]); }}
                  className="w-full flex gap-2 justify-center items-center bg-cyan-600/10 border border-cyan-500/30 text-cyan-400 rounded-lg py-2.5 font-mono text-sm hover:bg-cyan-500/20 transition-all"
                >
                  <TerminalIcon className="w-4 h-4" /> INIT_NEW_SESSION
                </button>
              </div>

              <div className="px-5">
                <LiveTradingDesk />
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-4 mt-2">
                <div className="text-[10px] uppercase font-bold tracking-widest text-gray-600 mb-3 flex items-center gap-2">
                  <Clock className="w-3 h-3" /> Session Logs
                </div>
                {chatSessions?.sessions?.map((chat) => (
                  <div
                    key={chat.sessionId}
                    onClick={() => setCurrentSessionId(chat.sessionId)}
                    className="group px-3 py-2.5 rounded-lg hover:bg-gray-900 cursor-pointer relative transition-colors border border-transparent hover:border-gray-800 mb-1"
                  >
                    <p className="text-xs font-mono text-gray-400 truncate pr-6">{chat.title}</p>
                    <button className="absolute right-2 top-2.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Trash2 className="w-3 h-3 text-red-500/70 hover:text-red-400" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="p-4 border-t border-gray-800 bg-gray-950">
                {planStatus && (
                  <div className="mb-4 p-3 rounded-lg bg-gray-900 border border-gray-800">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">
                        {planStatus.plan} TIER
                      </span>
                      <Link href="/checkout" className="text-[10px] uppercase font-bold text-cyan-500 hover:text-cyan-400">
                        Upgrade
                      </Link>
                    </div>
                    <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${planStatus.terminalLimitExceeded ? 'bg-red-500' : 'bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.8)]'}`}
                        style={{ width: planStatus.dailyTerminalLimit === -1 ? '10%' : `${Math.min((planStatus.dailyTerminalCount / planStatus.dailyTerminalLimit) * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                )}
                <div className="flex justify-between items-center px-1">
                  <a href="https://t.me/SwapSmithBot" target="_blank" className="flex gap-2 items-center text-xs text-gray-500 hover:text-cyan-400 transition-colors">
                    <MessageCircle className="w-3.5 h-3.5" /> Support
                  </a>
                  <Link href="/profile" className="flex gap-2 items-center text-xs text-gray-500 hover:text-cyan-400 transition-colors">
                    <Settings className="w-3.5 h-3.5" /> Config
                  </Link>
                </div>
              </div>
            </MotionDiv>
          )}
        </AnimatePresence>

        <div className="relative flex-1 flex flex-col bg-[#050505]">
          <button onClick={() => setIsSidebarOpen(s => !s)} className="absolute top-5 left-5 z-40 p-2 bg-gray-900 border border-gray-800 rounded-md hover:bg-gray-800 transition-colors">
            <Menu className="w-4 h-4 text-gray-400" />
          </button>

          <div className="flex-1 overflow-y-auto px-6 py-10 pb-32">
            <div className="max-w-4xl mx-auto space-y-6">
              {limitBannerVisible && planStatus && (
                <PlanLimitBanner feature="terminal" currentPlan={planStatus.plan} onDismiss={() => setLimitBannerVisible(false)} />
              )}

              <div className="mb-8 pl-10">
                <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-mono uppercase tracking-widest text-emerald-400 mb-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Terminal Hub Connected
                </div>
                <h1 className="text-3xl font-bold text-gray-100 tracking-tight">SwapSmith Terminal</h1>
                <p className="mt-2 text-sm text-gray-500 font-mono">Execute high-speed multi-chain operations securely.</p>
              </div>

              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] p-4 rounded-xl ${msg.role === "user" ? "bg-cyan-900/30 border border-cyan-800/50 text-cyan-50" : "bg-gray-900 border border-gray-800 text-gray-300"} font-mono text-sm`}>
                    {msg.type === "swap_confirmation" && msg.data?.quoteData ? (
                      <SwapConfirmation quote={msg.data.quoteData} confidence={msg.data.confidence} onAmountChange={() => {}} />
                    ) : msg.type === "intent_confirmation" && msg.data?.parsedCommand ? (
                      <IntentConfirmation command={msg.data.parsedCommand} onConfirm={() => executeSwap(msg.data.parsedCommand)} />
                    ) : (
                      <pre className="whitespace-pre-wrap font-mono">{msg.content}</pre>
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          </div>

          <div className="absolute bottom-0 w-full p-6 bg-gradient-to-t from-[#050505] via-[#050505] to-transparent">
            <div className="max-w-4xl mx-auto">
              <ClaudeChatInput
                ref={inputRef}
                onSendMessage={({ message }) => processCommand(message)}
                isRecording={isRecording}
                isAudioSupported={isAudioSupported}
                onStartRecording={startRecording}
                onStopRecording={stopRecording}
                isConnected={isConnected}
                disabled={isInputDisabled}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}