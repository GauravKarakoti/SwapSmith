/**
 * Custom hooks for Terminal functionality
 * Separates terminal state management and sessions from UI components
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { ParsedCommand } from '@/utils/groq-client';
import { Message } from '@/utils/terminal-utils';

/**
 * Hook for managing terminal messages and chat state
 */
export function useTerminalMessages() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content:
        "Hello! I can help you swap assets, create payment links, or scout yields.\n\n💡 Tip: Try our Telegram Bot!",
      timestamp: new Date(),
      type: 'message',
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);

  const addMessage = useCallback((msg: Omit<Message, 'timestamp'>) => {
    setMessages((prev) => [...prev, { ...msg, timestamp: new Date() }]);
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([
      {
        role: 'assistant',
        content:
          'Hello! I can help you swap assets, create payment links, or scout yields.',
        timestamp: new Date(),
        type: 'message',
      },
    ]);
  }, []);

  const replaceMessages = useCallback((newMessages: Message[]) => {
    setMessages(newMessages);
  }, []);

  return {
    messages,
    isLoading,
    setIsLoading,
    addMessage,
    clearMessages,
    replaceMessages,
  };
}

/**
 * Hook for managing terminal sessions
 */
export function useTerminalSessions() {
  const [currentSessionId, setCurrentSessionId] = useState(crypto.randomUUID());
  const sessionIdRef = useRef(currentSessionId);
  const loadedSessionRef = useRef<string | null>(null);

  useEffect(() => {
    sessionIdRef.current = currentSessionId;
    loadedSessionRef.current = null;
  }, [currentSessionId]);

  const createNewSession = useCallback(() => {
    const id = crypto.randomUUID();
    setCurrentSessionId(id);
    return id;
  }, []);

  const switchSession = useCallback((id: string) => {
    setCurrentSessionId(id);
  }, []);

  return {
    currentSessionId,
    sessionIdRef,
    loadedSessionRef,
    createNewSession,
    switchSession,
  };
}

/**
 * Hook for managing UI sidebar state
 */
export function useTerminalUI() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [limitBannerVisible, setLimitBannerVisible] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const toggleSidebar = useCallback(() => {
    setIsSidebarOpen((prev) => !prev);
  }, []);

  const showLimitBanner = useCallback(() => {
    setLimitBannerVisible(true);
  }, []);

  const hideLimitBanner = useCallback(() => {
    setLimitBannerVisible(false);
  }, []);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  return {
    isSidebarOpen,
    toggleSidebar,
    limitBannerVisible,
    showLimitBanner,
    hideLimitBanner,
    messagesEndRef,
    scrollToBottom,
  };
}
