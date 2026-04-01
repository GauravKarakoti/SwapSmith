"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import {
  MessageCircle,
  Plus,
  Clock,
  Settings,
  Menu,
  Zap,
  Activity,
  Trash2,
} from "lucide-react";
import dynamic from "next/dynamic";

import Navbar from "@/components/Navbar";
import ClaudeChatInput from "@/components/ClaudeChatInput";
import SwapConfirmation, { QuoteData } from "@/components/SwapConfirmation";
import IntentConfirmation from "@/components/IntentConfirmation";
import FullPageAd from "@/components/FullPageAd";
import PlanLimitBanner from "@/components/PlanLimitBanner";
import { useTerminalFullPageAd } from "@/hooks/useAds";

import { useChatHistory, useChatSessions } from "@/hooks/useCachedData";
import { useErrorHandler, ErrorType } from "@/hooks/useErrorHandler";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { usePlan } from "@/hooks/usePlan";

// Dynamically import Framer Motion components
const MotionDiv = dynamic(
  () => import('framer-motion').then(mod => ({ default: mod.motion.div })),
  { ssr: false }
)

const AnimatePresence = dynamic(
  () => import('framer-motion').then(mod => ({ default: mod.AnimatePresence })),
  { ssr: false }
)

import { ParsedCommand } from "@/utils/groq-client";

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
  | { quoteData: QuoteData; confidence: number }
  | { url: string }
  | { parsedCommand: ParsedCommand }
  | Record<string, unknown>;
}

/* -------------------------------------------------------------------------- */
/* UI Components                                */
/* -------------------------------------------------------------------------- */

const SidebarSkeleton = () => (
  <div className="space-y-4 p-2">
    {[1, 2, 3, 4].map((i) => (
      <div key={i} className="px-3 py-2 space-y-2">
        <div className="h-3 w-3/4 bg-[var(--panel-soft)] rounded animate-pulse" />
        <div className="h-2 w-1/4 bg-[var(--panel-soft)] rounded animate-pulse" />
      </div>
    ))}
  </div>
);

const LiveStatsCard = () => {
  const [stats, setStats] = useState({
    gasPrice: 20,
    volume24h: "2.4",
    activeSwaps: 142,
  });

  useEffect(() => {
    const id = setInterval(() => {
      setStats({
        gasPrice: Math.floor(Math.random() * 20) + 10,
        volume24h: (Math.random() * 5 + 1).toFixed(1),
        activeSwaps: Math.floor(Math.random() * 50) + 100,
      });
    }, 5000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="glass rounded-2xl p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <Activity className="w-4 h-4 text-cyan-400" />
        <span className="text-sm font-semibold text-[var(--text)]">
          Live Network
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3 text-center">
        <div>
          <div className="text-cyan-400 font-bold flex justify-center gap-1">
            <Zap className="w-3 h-3" /> {stats.gasPrice}
          </div>
          <div className="text-[10px] text-[var(--muted)]">Gwei</div>
        </div>
        <div>
          <div className="text-purple-400 font-bold">${stats.volume24h}M</div>
          <div className="text-[10px] text-[var(--muted)]">24h Vol</div>
        </div>
        <div>
          <div className="text-pink-400 font-bold">{stats.activeSwaps}</div>
          <div className="text-[10px] text-[var(--muted)]">Active</div>
        </div>
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* Main Page                                  */
/* -------------------------------------------------------------------------- */

function TerminalPage() {
  const { address, isConnected } = useAccount();
  const { handleError } = useErrorHandler();

  // Plan limits
  const { status: planStatus, checkTerminalUsage } = usePlan();
  const [limitBannerVisible, setLimitBannerVisible] = useState(false);

  // Ads — hidden for Premium/Pro users
  const { showAd, dismiss: dismissAd } = useTerminalFullPageAd();
  const isAdFree = planStatus?.plan === 'premium' || planStatus?.plan === 'pro';

  // State
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Hello! I can help you swap assets, create payment links, or scout yields.\n\n💡 Tip: Try our Telegram Bot!",
      timestamp: new Date(),
      type: "message",
    },
  ]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isInputDisabled, setIsInputDisabled] = useState(true); // Block input until history loads
  const [pendingMessages, setPendingMessages] = useState<Message[]>([]); // Queue for messages sent during loading

  // Session Management
  const [currentSessionId, setCurrentSessionId] = useState(crypto.randomUUID());
  const sessionIdRef = useRef(currentSessionId);
  const loadedSessionRef = useRef<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Data Fetching
  const { data: chatSessions, refetch: refetchSessions } = useChatSessions(
    undefined,
  );
  const { data: dbChatHistory } = useChatHistory(undefined, currentSessionId);

  // Speech Recognition
  const {
    isRecording,
    isSupported: isAudioSupported,
    startRecording,
    stopRecording,
    error: audioError,
    browserInfo,
  } = useAudioRecorder();

  /* ------------------------------------------------------------------------ */
  /* Effects                                  */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    sessionIdRef.current = currentSessionId;
    loadedSessionRef.current = null;
    setIsHistoryLoading(true);
    setIsInputDisabled(true);
    setPendingMessages([]);
  }, [currentSessionId]);

  // Load chat history with proper race condition handling
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
        // Merge loaded history with any pending messages sent during loading
        setMessages(prev => {
          // Keep only the initial welcome message if it's a new session
          const initialMessage = prev.length === 1 && prev[0].role === "assistant" ? prev[0] : null;

          // Combine loaded messages with pending messages, sorted by timestamp
          const allMessages = [...loadedMessages, ...pendingMessages];
          allMessages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

          return initialMessage ? [initialMessage, ...allMessages] : allMessages;
        });

        setIsHistoryLoading(false);
        setIsInputDisabled(false);
        setPendingMessages([]); // Clear pending messages after merge
      });
      loadedSessionRef.current = currentSessionId;
    } else {
      queueMicrotask(() => {
        // No history to load, just add any pending messages
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

    // If history is still loading, add to pending queue
    if (isHistoryLoading) {
      setPendingMessages(prev => [...prev, newMessage]);
    } else {
      setMessages(prev => [...prev, newMessage]);
    }
  }, [isHistoryLoading]);

  // Auto-focus text input on voice error
  useEffect(() => {
    if (audioError) {
      addMessage({
        role: "assistant",
        content: audioError,
        type: "message",
      });
      // Auto-focus text input on voice failure
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [audioError, addMessage]);
  /* ------------------------------------------------------------------------ */
  /* Handlers                                   */
  /* ------------------------------------------------------------------------ */

  const handleStartRecording = () => {
    if (isInputDisabled) {
      addMessage({
        role: "assistant",
        content: "Please wait for chat history to load before sending messages.",
        type: "message",
      });
      return;
    }

    if (!isAudioSupported) {
      addMessage({
        role: "assistant",
        content: "Voice input is not supported in this browser.",
        type: "message",
      });
      return;
    }
    startRecording();
  };

  const handleStopRecording = async () => {
    if (isInputDisabled) return;

    setIsLoading(true);
    try {
      const audioBlob = await stopRecording();
      if (audioBlob) {
        let ext = 'wav';
        const type = audioBlob.type.toLowerCase();
        if (type.includes('webm')) ext = 'webm';
        else if (type.includes('mp4')) ext = 'mp4';
        else if (type.includes('ogg')) ext = 'ogg';

        const audioFile = new File([audioBlob], `voice_command.${ext}`, { type: audioBlob.type || 'audio/wav' });

        const formData = new FormData();
        formData.append("file", audioFile);

        const response = await fetch("/api/transcribe", { method: "POST", body: formData });
        const data = await response.json();

        if (data.error) throw new Error(data.error);

        if (data.text) {
          processCommand(data.text);
        }
      }
    } catch (err) {
      console.error("Voice processing failed:", err);
      addMessage({
        role: "assistant",
        content: "Sorry, I couldn't process your voice command. Please try again.",
        type: "message",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewChat = () => {
    const id = crypto.randomUUID();
    setCurrentSessionId(id);
    setMessages([
      {
        role: "assistant",
        content:
          "Hello! I can help you swap assets, create payment links, or scout yields.",
        timestamp: new Date(),
        type: "message",
      },
    ]);
    setIsHistoryLoading(false);
    setIsInputDisabled(false);
    setPendingMessages([]);
  };

  const handleSwitchSession = (id: string) => setCurrentSessionId(id);

  const handleDeleteSession = async (
    sessionId: string,
    e: React.MouseEvent,
  ) => {
    e.stopPropagation();
    // Skip deletion without user ID (demo mode)
    // In production, would use real user ID

    if (sessionId === currentSessionId) handleNewChat();
    refetchSessions();
  };

  /* ------------------------------------------------------------------------ */
  /* Core Logic                                   */
  /* ------------------------------------------------------------------------ */

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

  const executeStake = async (command: ParsedCommand) => {
    try {
      const stakeResponse = await fetch("/api/create-stake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromAsset: command.fromAsset,
          fromChain: command.fromChain,
          amount: command.amount,
          amountType: command.amountType,
          protocol: command.fromProject || 'lido',
          settleAddress: command.settleAddress,
        }),
      });
      const stakeQuote = await stakeResponse.json();
      if (stakeQuote.error) throw new Error(stakeQuote.error);

      addMessage({
        role: "assistant",
        content: `🔥 **Staking Quote Generated**\n\n` +
          `**Stake:** ${stakeQuote.amount} ${stakeQuote.fromAsset} → ${stakeQuote.estimatedOutput.toFixed(6)} ${stakeQuote.toAsset}\n` +
          `**Protocol:** ${stakeQuote.protocol.name} (${stakeQuote.protocol.apy} APY)\n` +
          `**Network:** ${stakeQuote.fromChain}\n` +
          `**Fees:** ${stakeQuote.fees.total.toFixed(6)} ${stakeQuote.fromAsset}\n` +
          `**Time:** ${stakeQuote.timeToStake}\n\n` +
          `**Risks:** ${stakeQuote.risks.join(', ')}\n\n` +
          `**Instructions:**\n${stakeQuote.instructions.join('\n')}`,
        type: "message",
      });
    } catch (error: unknown) {
      const errorMessage = handleError(error, ErrorType.API_FAILURE, {
        operation: "stake_quote",
        retryable: true,
      });
      addMessage({ role: "assistant", content: errorMessage, type: "message" });
    }
  };

  const processCommand = async (text: string) => {
    if (!text.trim()) return;

    // Block processing if input is disabled (history still loading)
    if (isInputDisabled) {
      addMessage({
        role: "assistant",
        content: "Please wait for chat history to load before sending messages.",
        type: "message",
      });
      return;
    }

    // Check terminal usage limit before processing
    const usageCheck = await checkTerminalUsage();
    if (!usageCheck.allowed) {
      setLimitBannerVisible(true);
      return;
    }

    // Add user message first
    addMessage({
      role: "user",
      content: text,
      type: "message",
    });

    if (!isLoading) setIsLoading(true);

    try {
      const response = await fetch("/api/parse-command", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-requested-with": "XMLHttpRequest" },
        body: JSON.stringify({ message: text }),
      });
      const command: ParsedCommand = await response.json();

      if (!command.success && command.intent !== "yield_scout") {
        addMessage({
          role: "assistant",
          content: `I couldn't understand. ${command.validationErrors?.join(", ") || "Please try again."}`,
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
          content: yieldData.message || "Here are the top yields:",
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
            confidence: command.confidence,
          };
          await executeSwap(subCommand);
        }
        setIsLoading(false);
        return;
      }

      // Handle staking commands (swap_and_stake intent)
      if (command.intent === "swap_and_stake") {
        if (command.requiresConfirmation || command.confidence < 80) {
          addMessage({
            role: "assistant",
            content: "",
            type: "intent_confirmation",
            data: { parsedCommand: command },
          });
        } else {
          await executeStake(command);
        }
        setIsLoading(false);
        return;
      }

      if (command.requiresConfirmation || command.confidence < 80) {
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

  /* ------------------------------------------------------------------------ */
  /* Render                                   */
  /* ------------------------------------------------------------------------ */

  return (
    <>
      <Navbar />

      {/* Full-page plans interstitial — hidden for Premium/Pro users */}
      {showAd && !isAdFree && (
        <FullPageAd variant="plans" duration={12000} onDismiss={dismissAd} />
      )}

      <div className="flex h-screen pt-16 app-bg overflow-hidden">
        {/* Sidebar */}
        <AnimatePresence>
          {isSidebarOpen && (
            <MotionDiv
              initial={{ width: 0 }}
              animate={{ width: 320 }}
              exit={{ width: 0 }}
              className="glass border-r flex flex-col"
            >
              <div className="p-4">
                <button
                  onClick={handleNewChat}
                  className="w-full flex gap-2 justify-center items-center bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg rounded-xl py-3 font-semibold hover:brightness-110 transition"
                >
                  <Plus className="w-4 h-4" /> New Chat
                </button>
              </div>

              <div className="px-4">
                <LiveStatsCard />
              </div>

              <div className="flex-1 overflow-y-auto p-2 mt-4">
                <div className="text-xs uppercase text-[var(--muted)] px-3 mb-2 flex items-center gap-2">
                  <Clock className="w-3 h-3" /> Recent
                </div>

                {isHistoryLoading ? (
                  <SidebarSkeleton />
                ) : chatSessions?.sessions?.length ? (
                  chatSessions.sessions.map((chat) => (
                    <div
                      key={chat.sessionId}
                      onClick={() => handleSwitchSession(chat.sessionId)}
                      className="group px-3 py-2 rounded-xl hover:bg-[var(--panel-soft)]/70 cursor-pointer relative transition-colors"
                    >
                      <p className="text-sm truncate text-[var(--text)]">
                        {chat.title}
                      </p>
                      <button
                        onClick={(e) => handleDeleteSession(chat.sessionId, e)}
                        className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="w-3 h-3 text-red-400" />
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="text-center text-sm text-[var(--muted)] py-6">
                    No chats yet
                  </div>
                )}
              </div>

              <div className="p-3 border-t border-[var(--border)] bg-[var(--panel-soft)]/70 backdrop-blur">
                {/* Plan usage mini-display */}
                {planStatus && (
                  <div className="mb-3 px-2 py-2 rounded-xl bg-[var(--panel-soft)]/60 border border-[var(--border)]">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] text-[var(--muted)] capitalize font-semibold">
                        {planStatus.plan} plan
                      </span>
                      <Link href="/checkout" className="text-[10px] text-cyan-400 hover:text-cyan-300 transition-colors">
                        Upgrade
                      </Link>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-[var(--muted)]">
                      <span>Terminal</span>
                      <span>
                        {planStatus.dailyTerminalCount}/
                        {planStatus.dailyTerminalLimit === -1 ? '∞' : planStatus.dailyTerminalLimit}
                      </span>
                    </div>
                    <div className="mt-1 h-1 bg-[var(--panel-soft)] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${planStatus.terminalLimitExceeded ? 'bg-red-500' : 'bg-cyan-500'}`}
                        style={{
                          width: planStatus.dailyTerminalLimit === -1
                            ? '10%'
                            : `${Math.min((planStatus.dailyTerminalCount / planStatus.dailyTerminalLimit) * 100, 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                )}

                <a
                  href="https://t.me/SwapSmithBot"
                  target="_blank"
                  className="flex gap-2 items-center text-sm text-[var(--muted)] hover:text-[var(--accent)] transition-colors"
                >
                  <MessageCircle className="w-4 h-4" /> Support
                </a>

                <Link
                  href="/profile"
                  className="flex gap-2 items-center text-sm text-[var(--muted)] hover:text-purple-400 mt-2 transition-colors"
                >
                  <Settings className="w-4 h-4" /> Settings
                </Link>
              </div>
            </MotionDiv>
          )}
        </AnimatePresence>

        {/* Main */}
        <div className="relative flex-1 flex flex-col">
          <button
            onClick={() => setIsSidebarOpen((s) => !s)}
            className="absolute top-4 left-4 z-40 p-2 glass rounded-xl shadow-sm"
          >
            <Menu className="w-5 h-5 text-[var(--muted)]" />
          </button>

          <div className="flex-1 overflow-y-auto px-4 py-8">
            <div className="max-w-3xl mx-auto space-y-4">
              {/* Plan limit banner */}
              {limitBannerVisible && planStatus && (
                <PlanLimitBanner
                  feature="terminal"
                  currentPlan={planStatus.plan}
                  onDismiss={() => setLimitBannerVisible(false)}
                />
              )}

              {/* Loading indicator */}
              {isHistoryLoading && (
                <div className="flex items-center justify-center py-4">
                  <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
                    <div className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                    Loading chat history...
                  </div>
                </div>
              )}

              {/* Header / Hero */}
              <div className="mb-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--panel-soft)]/80 border border-[var(--border)] text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]" />
                  AI Trading Assistant
                </div>
                <h1 className="mt-3 text-2xl font-semibold text-[var(--text)]">
                  Terminal Alpha
                </h1>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Chat-native swaps, yield scouting and payment links – from one
                  unified terminal.
                </p>
              </div>

              {/* Messages */}
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"
                    }`}
                >
                  <div className="max-w-[80%]">
                    <div
                      className={`px-4 py-3 rounded-2xl text-sm ${msg.role === "user"
                        ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg"
                        : "panel"
                        }`}
                    >
                      {msg.type === "swap_confirmation" &&
                        msg.data &&
                        "quoteData" in msg.data ? (
                        <SwapConfirmation
                          quote={(msg.data as { quoteData: QuoteData }).quoteData}
                          confidence={(msg.data as { confidence: number }).confidence}
                          onAmountChange={(newAmount) => {
                            const quoteData = (msg.data as { quoteData?: QuoteData })?.quoteData;
                            if (quoteData) {
                              const command: ParsedCommand = {
                                success: true,
                                intent: 'swap',
                                fromAsset: quoteData.depositCoin,
                                toAsset: quoteData.settleCoin,
                                amount: parseFloat(newAmount),
                                fromChain: quoteData.depositNetwork,
                                toChain: quoteData.settleNetwork,
                                confidence: (msg.data as { confidence: number }).confidence,
                                requiresConfirmation: false,
                                settleAsset: quoteData.settleCoin,
                                settleNetwork: quoteData.settleNetwork,
                                settleAmount: parseFloat(quoteData.settleAmount),
                                settleAddress: '',
                                validationErrors: [],
                                parsedMessage: `Updating swap amount to ${newAmount}`
                              };
                              executeSwap(command);
                            }
                          }}
                        />
                      ) : msg.type === "intent_confirmation" &&
                        msg.data &&
                        "parsedCommand" in msg.data ? (
                        <IntentConfirmation
                          command={(msg.data as { parsedCommand: ParsedCommand }).parsedCommand}
                          onConfirm={() => {
                            const cmd = (msg.data as { parsedCommand: ParsedCommand }).parsedCommand;
                            if (cmd.intent === "swap_and_stake") {
                              executeStake(cmd);
                            } else {
                              executeSwap(cmd);
                            }
                          }}
                        />
                      ) : msg.type === "yield_info" ? (
                        <pre className="whitespace-pre-wrap text-xs text-cyan-400">
                          {msg.content}
                        </pre>
                      ) : msg.type === "checkout_link" &&
                        msg.data &&
                        "url" in msg.data ? (
                        <a
                          href={(msg.data as { url: string }).url}
                          target="_blank"
          rel="noopener noreferrer"
                          className="underline underline-offset-2 text-cyan-400"
                        >
                          {(msg.data as { url: string }).url}
                        </a>
                      ) : (
                        <pre className="whitespace-pre-wrap text-[var(--text)]">
                          {msg.content}
                        </pre>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          </div>

          <div className="p-4 border-t border-[var(--border)] bg-[var(--panel)]/90 backdrop-blur">
            <ClaudeChatInput
              ref={inputRef}
              onSendMessage={({ message }) => processCommand(message)}
              isRecording={isRecording}
              isAudioSupported={isAudioSupported}
              onStartRecording={handleStartRecording}
              onStopRecording={handleStopRecording}
              isConnected={isConnected}
              disabled={isInputDisabled}
            />
          </div>
        </div>
      </div>
    </>
  );
}

export default TerminalPage;
