"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
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

import Navbar from "@/components/Navbar";
import ClaudeChatInput from "@/components/ClaudeChatInput";
import SwapConfirmation from "@/components/SwapConfirmation";
import IntentConfirmation from "@/components/IntentConfirmation";

import { useAuth } from "@/hooks/useAuth";
import { useChatHistory, useChatSessions } from "@/hooks/useCachedData";

import { ParsedCommand } from "@/utils/groq-client";

/* -------------------------------------------------------------------------- */
/*                                    Types                                   */
/* -------------------------------------------------------------------------- */

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
  data?: ParsedCommand | { quoteData: QuoteData; confidence: number } | { url: string } | { parsedCommand: ParsedCommand } | Record<string, unknown>;
}

/* -------------------------------------------------------------------------- */
/*                               UI Components                                */
/* -------------------------------------------------------------------------- */

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
    <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Activity className="w-4 h-4 text-cyan-400" />
        <span className="text-sm font-semibold text-zinc-200">
          Live Network
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3 text-center">
        <div>
          <div className="text-cyan-400 font-bold flex justify-center gap-1">
            <Zap className="w-3 h-3" /> {stats.gasPrice}
          </div>
          <div className="text-[10px] text-zinc-500">Gwei</div>
        </div>
        <div>
          <div className="text-purple-400 font-bold">${stats.volume24h}M</div>
          <div className="text-[10px] text-zinc-500">24h Vol</div>
        </div>
        <div>
          <div className="text-pink-400 font-bold">{stats.activeSwaps}</div>
          <div className="text-[10px] text-zinc-500">Active</div>
        </div>
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*                                Main Page                                   */
/* -------------------------------------------------------------------------- */

export default function TerminalPage() {
  const router = useRouter();
  const { isConnected } = useAccount();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();

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

  const [currentSessionId, setCurrentSessionId] = useState(
    crypto.randomUUID(),
  );
  const sessionIdRef = useRef(currentSessionId);
  const loadedSessionRef = useRef<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: chatSessions, refetch: refetchSessions } = useChatSessions(
    user?.uid,
  );
  const { data: dbChatHistory } = useChatHistory(
    user?.uid,
    currentSessionId,
  );

  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push("/login");
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    sessionIdRef.current = currentSessionId;
    loadedSessionRef.current = null; // Reset on session change
  }, [currentSessionId]);

  // Load chat history from database when available
  useEffect(() => {
    // Only load once per session to prevent cascading renders
    if (loadedSessionRef.current === currentSessionId) return;
    
    if (dbChatHistory?.history?.length) {
      const loadedMessages = dbChatHistory.history.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
        timestamp: new Date(m.createdAt),
        type: "message" as const,
      }));
      // Using queueMicrotask to defer state updates and prevent cascading renders
      queueMicrotask(() => {
        setMessages(loadedMessages);
        setIsHistoryLoading(false);
      });
      loadedSessionRef.current = currentSessionId;
    } else {
      queueMicrotask(() => setIsHistoryLoading(false));
    }
  }, [dbChatHistory, currentSessionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /* ------------------------------------------------------------------------ */

  const addMessage = useCallback(
    (msg: Omit<Message, "timestamp">) => {
      setMessages((prev) => [...prev, { ...msg, timestamp: new Date() }]);
    },
    [],
  );

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
  };

  const handleSwitchSession = (id: string) => setCurrentSessionId(id);

  const handleDeleteSession = async (
    sessionId: string,
    e: React.MouseEvent,
  ) => {
    e.stopPropagation();
    if (!user?.uid) return;

    await fetch(
      `/api/chat/history?userId=${user.uid}&sessionId=${sessionId}`,
      { method: "DELETE" },
    );

    if (sessionId === currentSessionId) handleNewChat();
    refetchSessions();
  };

  /* ------------------------------------------------------------------------ */

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-black">
        <div className="animate-spin h-8 w-8 border-2 border-cyan-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  /* ------------------------------------------------------------------------ */

  return (
    <>
      <Navbar />

      <div className="flex h-screen pt-16 bg-[#030308] text-white overflow-hidden">
        {/* Sidebar */}
        <AnimatePresence>
          {isSidebarOpen && (
            <motion.aside
              initial={{ width: 0 }}
              animate={{ width: 320 }}
              exit={{ width: 0 }}
              className="border-r border-zinc-800 bg-zinc-900/40 backdrop-blur-xl flex flex-col"
            >
              <div className="p-4">
                <button
                  onClick={handleNewChat}
                  className="w-full flex gap-2 justify-center items-center bg-gradient-to-r from-cyan-600 to-blue-600 rounded-xl py-3 font-semibold"
                >
                  <Plus className="w-4 h-4" /> New Chat
                </button>
              </div>

              <div className="px-4">
                <LiveStatsCard />
              </div>

              <div className="flex-1 overflow-y-auto p-2 mt-4">
                <div className="text-xs uppercase text-zinc-500 px-3 mb-2 flex items-center gap-2">
                  <Clock className="w-3 h-3" /> Recent
                </div>

                {isHistoryLoading ? (
                  <SidebarSkeleton />
                ) : chatSessions?.sessions?.length ? (
                  chatSessions.sessions.map((chat) => (
                    <div
                      key={chat.sessionId}
                      onClick={() => handleSwitchSession(chat.sessionId)}
                      className="group px-3 py-2 rounded-xl hover:bg-white/5 cursor-pointer relative"
                    >
                      <p className="text-sm truncate">{chat.title}</p>
                      <button
                        onClick={(e) =>
                          handleDeleteSession(chat.sessionId, e)
                        }
                        className="absolute right-2 top-2 opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="w-3 h-3 text-red-400" />
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="text-center text-sm text-zinc-500 py-6">
                    No chats yet
                  </div>
                )}
              </div>

              <div className="p-3 border-t border-zinc-800">
                <a
                  href="https://t.me/SwapSmithBot"
                  target="_blank"
                  className="flex gap-2 items-center text-sm text-zinc-400 hover:text-cyan-400"
                >
                  <MessageCircle className="w-4 h-4" /> Support
                </a>

                <Link
                  href="/profile"
                  className="flex gap-2 items-center text-sm text-zinc-400 hover:text-purple-400 mt-2"
                >
                  <Settings className="w-4 h-4" /> Settings
                </Link>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Main */}
        <div className="flex-1 flex flex-col">
          <button
            onClick={() => setIsSidebarOpen((s) => !s)}
            className="fixed top-20 left-4 z-40 p-2 bg-zinc-900 border border-zinc-700 rounded-xl"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex-1 overflow-y-auto px-4 py-8">
            <div className="max-w-3xl mx-auto space-y-6">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${
                    msg.role === "user"
                      ? "justify-end"
                      : "justify-start"
                  }`}
                >
                  <div className="max-w-[80%]">
                    <div
                      className={`px-4 py-3 rounded-2xl text-sm ${
                        msg.role === "user"
                          ? "bg-gradient-to-r from-cyan-600 to-blue-600"
                          : "bg-zinc-900/70 border border-zinc-800"
                      }`}
                    >
                      {msg.type === "swap_confirmation" && msg.data && 'quoteData' in msg.data ? (
                        <SwapConfirmation
                          quote={msg.data.quoteData as QuoteData}
                          confidence={msg.data.confidence as number}
                        />
                      ) : msg.type === "intent_confirmation" && msg.data && 'parsedCommand' in msg.data ? (
                        <IntentConfirmation
                          command={msg.data.parsedCommand as ParsedCommand}
                          onConfirm={() => {}}
                        />
                      ) : (
                        <pre className="whitespace-pre-wrap">
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

          <div className="p-4 border-t border-zinc-800">
            <ClaudeChatInput
              onSendMessage={({ message }) =>
                addMessage({
                  role: "user",
                  content: message,
                  type: "message",
                })
              }
              isRecording={false}
              isAudioSupported={false}
              onStartRecording={() => {}}
              onStopRecording={() => {}}
              isConnected={isConnected}
            />
          </div>
        </div>
      </div>
    </>
  );
}
