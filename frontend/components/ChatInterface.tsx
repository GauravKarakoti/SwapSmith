'use client'

import { useState, useRef, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { Mic, Send, StopCircle, Zap } from 'lucide-react';
import SwapConfirmation from './SwapConfirmation';
import PortfolioSummary, { PortfolioItem } from './PortfolioSummary'; // Added Import
import TrustIndicators from './TrustIndicators';
import IntentConfirmation from './IntentConfirmation';
import GasFeeDisplay from './GasFeeDisplay';
import GasComparisonChart from './GasComparisonChart';
import { ParsedCommand } from '@/utils/groq-client';
import { useErrorHandler, ErrorType } from '@/hooks/useErrorHandler';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { useAuth } from '@/hooks/useAuth';


// Export QuoteData to be used in PortfolioSummary
export interface QuoteData {
  depositAmount: string;
  depositCoin: string;
  depositNetwork: string;
  rate: string;
  settleAmount: string;
  settleCoin: string;
  settleNetwork: string;
  depositAddress?: string;
  memo?: string;
  expiry?: string;
  id?: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  type?: 'message' | 'intent_confirmation' | 'swap_confirmation' | 'yield_info' | 'checkout_link' | 'portfolio_summary';
  data?: { 
    parsedCommand?: ParsedCommand; 
    quoteData?: QuoteData; 
    confidence?: number;
    url?: string;
    portfolioItems?: PortfolioItem[];
  };
}

const CHAT_LOCAL_STORAGE_KEY = 'swapsmith-chatinterface-messages-v1';
const CHAT_SESSION_ID = 'chat-interface-default';
const DEFAULT_ASSISTANT_MESSAGE: Message = {
  role: 'assistant',
  content: "Hello! I can help you swap assets, create payment links, or scout yields.\n\n💡 Tip: Try our Telegram Bot for on-the-go access!",
  timestamp: new Date(),
  type: 'message'
};

const normalizeLoadedMessages = (messages: Partial<Message>[] | undefined): Message[] => {
  if (!Array.isArray(messages)) return [];

  return messages
    .filter((msg): msg is Partial<Message> & Pick<Message, 'role' | 'content'> =>
      !!msg &&
      (msg.role === 'user' || msg.role === 'assistant') &&
      typeof msg.content === 'string'
    )
    .map((msg) => ({
      role: msg.role,
      content: msg.content,
      timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date(),
      type: msg.type || 'message',
      data: msg.data
    }))
    .filter((msg) => !Number.isNaN(msg.timestamp.getTime()));
};

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([DEFAULT_ASSISTANT_MESSAGE]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [pendingCommand, setPendingCommand] = useState<ParsedCommand | null>(null);
  const [currentConfidence, setCurrentConfidence] = useState<number | undefined>(undefined);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { address, isConnected } = useAccount();
  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const { handleError } = useErrorHandler();
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasLoadedPersistenceRef = useRef(false);
  const saveSequenceRef = useRef(0);
  
  // Use cross-browser audio recorder
  const { 
    isRecording,
    isSupported: isAudioSupported, 
    startRecording, 
    stopRecording, 
    error: audioError
  } = useAudioRecorder();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    let isCancelled = false;
    hasLoadedPersistenceRef.current = false;

    const loadLocalMessages = (): Message[] => {
      try {
        const raw = localStorage.getItem(CHAT_LOCAL_STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw) as Partial<Message>[];
        return normalizeLoadedMessages(parsed);
      } catch (error) {
        console.error('Failed to load local chat history:', error);
        return [];
      }
    };

    const loadPersistedMessages = async () => {
      if (isAuthLoading) return;

      // Guest flow: load from localStorage
      if (!isAuthenticated || !user?.uid) {
        const localMessages = loadLocalMessages();
        if (!isCancelled) {
          setMessages(localMessages.length ? localMessages : [DEFAULT_ASSISTANT_MESSAGE]);
          hasLoadedPersistenceRef.current = true;
        }
        return;
      }

      // Authenticated flow: load from PostgreSQL (via API)
      try {
        const response = await fetch(
          `/api/chat/history?userId=${encodeURIComponent(user.uid)}&sessionId=${encodeURIComponent(CHAT_SESSION_ID)}&limit=200`
        );

        if (!response.ok) {
          throw new Error(`Failed to load chat history: ${response.status}`);
        }

        const payload = await response.json();
        const dbHistory = Array.isArray(payload.history) ? payload.history : [];
        const normalizedDbMessages: Message[] = dbHistory
          .slice()
          .reverse()
          .map((item: { role: Message['role']; content: string; createdAt: string; metadata?: { type?: Message['type']; data?: Message['data']; timestamp?: string } | null }) => ({
            role: item.role,
            content: item.content,
            timestamp: item.metadata?.timestamp ? new Date(item.metadata.timestamp) : new Date(item.createdAt),
            type: item.metadata?.type || 'message',
            data: item.metadata?.data
          }))
          .filter((msg: Message) => !Number.isNaN(msg.timestamp.getTime()));

        if (!isCancelled && normalizedDbMessages.length) {
          setMessages(normalizedDbMessages);
          hasLoadedPersistenceRef.current = true;
          return;
        }

        // If DB is empty, hydrate from local guest messages once (migration path)
        const localMessages = loadLocalMessages();
        if (!isCancelled) {
          setMessages(localMessages.length ? localMessages : [DEFAULT_ASSISTANT_MESSAGE]);
          hasLoadedPersistenceRef.current = true;
        }
      } catch (error) {
        console.error('Failed to load persisted chat history:', error);
        const localMessages = loadLocalMessages();
        if (!isCancelled) {
          setMessages(localMessages.length ? localMessages : [DEFAULT_ASSISTANT_MESSAGE]);
          hasLoadedPersistenceRef.current = true;
        }
      }
    };

    void loadPersistedMessages();

    return () => {
      isCancelled = true;
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [isAuthenticated, isAuthLoading, user?.uid]);

  useEffect(() => {
    if (!hasLoadedPersistenceRef.current || isAuthLoading) return;
    const sequence = ++saveSequenceRef.current;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      if (sequence !== saveSequenceRef.current) return;

      const normalizedForSave = messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp.toISOString(),
        type: msg.type || 'message',
        data: msg.data
      }));

      // Guest flow persistence
      if (!isAuthenticated || !user?.uid) {
        localStorage.setItem(CHAT_LOCAL_STORAGE_KEY, JSON.stringify(normalizedForSave));
        return;
      }

      // Authenticated flow persistence to PostgreSQL (snapshot strategy)
      try {
        if (sequence !== saveSequenceRef.current) return;
        await fetch(`/api/chat/history?userId=${encodeURIComponent(user.uid)}&sessionId=${encodeURIComponent(CHAT_SESSION_ID)}`, {
          method: 'DELETE'
        });

        for (const msg of normalizedForSave) {
          if (sequence !== saveSequenceRef.current) return;
          await fetch('/api/chat/history', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: user.uid,
              walletAddress: address,
              role: msg.role,
              content: msg.content,
              sessionId: CHAT_SESSION_ID,
              metadata: {
                type: msg.type,
                data: msg.data,
                timestamp: msg.timestamp
              }
            })
          });
        }

        // Keep local cache as fallback for temporary API/DB outages
        localStorage.setItem(CHAT_LOCAL_STORAGE_KEY, JSON.stringify(normalizedForSave));
      } catch (error) {
        console.error('Failed to save chat history to database:', error);
        localStorage.setItem(CHAT_LOCAL_STORAGE_KEY, JSON.stringify(normalizedForSave));
      }
    }, 400);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [messages, isAuthenticated, isAuthLoading, user?.uid, address]);

  // Show audio error if any and auto-focus text input
  useEffect(() => {
    if (audioError) {
      addMessage({ role: 'assistant', content: audioError, type: 'message' });
      // Auto-focus the text input on voice failure
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
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


  const executeSwapAsync = async (
    fromAsset: string, 
    toAsset: string, 
    amount: number, 
    fromChain: string, 
    toChain: string
  ): Promise<QuoteData> => {
     const quoteResponse = await fetch('/api/create-swap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromAsset, toAsset, amount, fromChain, toChain }),
      });
      const quote = await quoteResponse.json();
      if (quote.error) throw new Error(quote.error);
      return quote;
  };

  const handlePortfolioRetry = (failedItems: PortfolioItem[], originalCommand: ParsedCommand) => {
      // 1. Reset failed items to pending in UI
      setMessages(prev => {
        const msgIndex = prev.findLastIndex(m => m.type === 'portfolio_summary');
        if (msgIndex === -1) return prev;
        
        const msg = prev[msgIndex];
        if (!msg.data?.portfolioItems) return prev;

        const newItems = msg.data.portfolioItems.map(item => {
            if (failedItems.some(f => f.id === item.id)) {
                return { ...item, status: 'pending' as const, error: undefined };
            }
            return item;
        });

        const newMsg = { ...msg, data: { ...msg.data, portfolioItems: newItems } };
        const newMessages = [...prev];
        newMessages[msgIndex] = newMsg;
        return newMessages;
      });

      // 2. Trigger execution
      processPortfolioBatch(failedItems, originalCommand);
  };

  const processPortfolioBatch = async (itemsToProcess: PortfolioItem[], command: ParsedCommand) => {
      for (const item of itemsToProcess) {
          try {
             const fromChain = command.fromChain || 'ethereum';
             const toChain = item.toChain || command.toChain || 'ethereum';

             const quote = await executeSwapAsync(
                 item.fromAsset,
                 item.toAsset,
                 item.amount,
                 fromChain,
                 toChain
             );
             
             // Update Success
             setMessages(prev => {
                 const msgIndex = prev.findLastIndex(m => m.type === 'portfolio_summary');
                 if (msgIndex === -1) return prev;
                 const msg = prev[msgIndex];
                 if (!msg.data?.portfolioItems) return prev;
                 
                 const newItems = msg.data.portfolioItems.map(i => 
                     i.id === item.id ? { ...i, status: 'success' as const, quote } : i
                 );
                 
                 const newMessages = [...prev];
                 newMessages[msgIndex] = { ...msg, data: { ...msg.data, portfolioItems: newItems } };
                 return newMessages;
             });

          } catch (error: unknown) {
             const errorMessage = error instanceof Error ? error.message : "Unknown error";
             // Update Error
             setMessages(prev => {
                 const msgIndex = prev.findLastIndex(m => m.type === 'portfolio_summary');
                 if (msgIndex === -1) return prev;
                 const msg = prev[msgIndex];
                 if (!msg.data?.portfolioItems) return prev;
                 
                 const newItems = msg.data.portfolioItems.map(i => 
                     i.id === item.id ? { ...i, status: 'error' as const, error: errorMessage } : i
                 );
                 
                 const newMessages = [...prev];
                 newMessages[msgIndex] = { ...msg, data: { ...msg.data, portfolioItems: newItems } };
                 return newMessages;
             });
          }
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
        setCurrentConfidence(0);
        setIsLoading(false);
        return;
      }

      setCurrentConfidence(command.confidence);

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
         if (command.requiresConfirmation || command.confidence < 80) {
             setPendingCommand(command);
             addMessage({ role: 'assistant', content: '', type: 'intent_confirmation', data: { parsedCommand: command } });
             setIsLoading(false);
             return;
         }

         // Prepare Portfolio Items
         const items: PortfolioItem[] = command.portfolio.map((item, index) => ({
             id: `${item.toAsset}-${index}`,
             fromAsset: command.fromAsset || 'ETH',
             toAsset: item.toAsset,
             amount: (command.amount! * item.percentage) / 100,
             status: 'pending',
             toChain: item.toChain 
         }));

         addMessage({ 
             role: 'assistant', 
             content: `📊 **Portfolio Strategy Detected**\nSplitting ${command.amount} ${command.fromAsset}...`, 
             type: 'portfolio_summary',
             data: { portfolioItems: items, parsedCommand: command } 
         });

         await processPortfolioBatch(items, command);
         
         setIsLoading(false);
         return;
      }

      // Handle DCA (Dollar Cost Averaging)
      if (command.intent === 'dca') {
        if (command.requiresConfirmation || command.confidence < 80) {
          setPendingCommand(command);
          addMessage({ role: 'assistant', content: '', type: 'intent_confirmation', data: { parsedCommand: command } });
        } else {
          await executeDCA(command);
        }
        setIsLoading(false);
        return;
      }

      // Handle Limit Orders (have conditions on swap intent)
      if (command.intent === 'swap' && command.conditionOperator && command.conditionValue) {
        if (command.requiresConfirmation || command.confidence < 80) {
          setPendingCommand(command);
          addMessage({ role: 'assistant', content: '', type: 'intent_confirmation', data: { parsedCommand: command } });
        } else {
          await executeLimitOrder(command);
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
    } catch (error: unknown) {
      const errorMessage = handleError(error, ErrorType.API_FAILURE, { 
        operation: 'swap_quote',
        retryable: true 
      });
      addMessage({ role: 'assistant', content: errorMessage, type: 'message' });
    }
  };

  const executeDCA = async (command: ParsedCommand) => {
    try {
      const dcaResponse = await fetch('/api/create-dca', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromAsset: command.fromAsset,
          fromChain: command.fromChain,
          toAsset: command.toAsset,
          toChain: command.toChain,
          amount: command.amount,
          frequency: command.frequency,
          dayOfWeek: command.dayOfWeek,
          dayOfMonth: command.dayOfMonth,
          settleAddress: address // Use connected wallet address
        }),
      });
      
      const result = await dcaResponse.json();
      if (result.error) throw new Error(result.error);
      
      addMessage({
        role: 'assistant',
        content: `✅ DCA Schedule Created!\n\n📊 Details:\n• ${command.amount} ${command.fromAsset} → ${command.toAsset}\n• Frequency: ${command.frequency}\n${command.dayOfWeek ? `• Day: ${command.dayOfWeek}` : ''}\n${command.dayOfMonth ? `• Date: ${command.dayOfMonth}` : ''}\n\nYour recurring swap is now active!`,
        type: 'message'
      });
    } catch (error: unknown) {
      const errorMessage = handleError(error, ErrorType.API_FAILURE, { 
        operation: 'dca_creation',
        retryable: true 
      });
      addMessage({ role: 'assistant', content: errorMessage, type: 'message' });
    }
  };

  const executeLimitOrder = async (command: ParsedCommand) => {
    try {
      const limitOrderResponse = await fetch('/api/create-limit-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromAsset: command.fromAsset,
          fromChain: command.fromChain,
          toAsset: command.toAsset,
          toChain: command.toChain,
          amount: command.amount,
          conditionOperator: command.conditionOperator,
          conditionValue: command.conditionValue,
          conditionAsset: command.conditionAsset,
          settleAddress: address // Use connected wallet address
        }),
      });
      
      const result = await limitOrderResponse.json();
      if (result.error) throw new Error(result.error);
      
      const operatorText = command.conditionOperator === 'gt' ? 'above' : 'below';
      addMessage({
        role: 'assistant',
        content: `✅ Limit Order Created!\n\n🎯 Order Details:\n• Swap: ${command.amount} ${command.fromAsset} → ${command.toAsset}\n• Trigger: When ${command.conditionAsset} is ${operatorText} $${command.conditionValue}\n\nYour limit order is now monitoring the market!`,
        type: 'message'
      });
    } catch (error: unknown) {
      const errorMessage = handleError(error, ErrorType.API_FAILURE, { 
        operation: 'limit_order_creation',
        retryable: true 
      });
      addMessage({ role: 'assistant', content: errorMessage, type: 'message' });
    }
  };

  const handleIntentConfirm = async (confirmed: boolean) => {
    if (confirmed && pendingCommand) {
        if (pendingCommand.intent === 'portfolio') {
             const confirmedCmd = { ...pendingCommand, requiresConfirmation: false, confidence: 100 };
             
             if (confirmedCmd.portfolio) {
                 const items: PortfolioItem[] = confirmedCmd.portfolio.map((item, index) => ({
                     id: `${item.toAsset}-${index}`,
                     fromAsset: confirmedCmd.fromAsset || 'ETH',
                     toAsset: item.toAsset,
                     amount: (confirmedCmd.amount! * item.percentage) / 100,
                     status: 'pending',
                     toChain: item.toChain 
                 }));

                 addMessage({ 
                     role: 'assistant', 
                     content: `📊 **Portfolio Strategy Executing**\nSplitting ${confirmedCmd.amount} ${confirmedCmd.fromAsset}...`, 
                     type: 'portfolio_summary',
                     data: { portfolioItems: items, parsedCommand: confirmedCmd } 
                 });

                 await processPortfolioBatch(items, confirmedCmd);
             }
        } else if (pendingCommand.intent === 'dca') {
             await executeDCA(pendingCommand);
        } else if (pendingCommand.conditionOperator && pendingCommand.conditionValue) {
             // Limit Order (swap with conditions)
             await executeLimitOrder(pendingCommand);
        } else {
            await executeSwap(pendingCommand);
        }
    } else if (!confirmed) {
        addMessage({ role: 'assistant', content: 'Cancelled.', type: 'message' });
    }
    setPendingCommand(null);
  };

  const handleVoiceRecording = async () => {
    if (isRecording) {
      setIsLoading(true);
      try {
        const audioBlob = await stopRecording();
        if (audioBlob) {
            // Safely determine the type depending on whether it's a Blob or a string
            const mimeType = audioBlob instanceof Blob ? (audioBlob.type || 'audio/wav') : 'audio/wav';
            const audioFile = new File([audioBlob], "voice_command.wav", { type: mimeType });
            
            const formData = new FormData();
            formData.append('file', audioFile);

            const response = await fetch('/api/transcribe', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();
            
            if (data.error) throw new Error(data.error);

            if (data.text) {
                addMessage({ role: 'user', content: data.text, type: 'message' });
                processCommand(data.text);
            }
        }
      } catch (err) {
        console.error("Voice processing failed:", err);
        addMessage({ 
            role: 'assistant', 
            content: "Sorry, I couldn't process your voice command. Please try again.", 
            type: 'message' 
        });
        // Auto-focus the text input on transcription failure
        setTimeout(() => {
          inputRef.current?.focus();
        }, 100);
      } finally {
        setIsLoading(false);
      }
    } else {
      await startRecording();
    }
  };

return (
    <div className="flex flex-col h-[700px] bg-[#0B0E11] border border-white/10 rounded-3xl overflow-hidden shadow-2xl relative">
      
      {/* 1. Header / Status Bar */}
      <div className="px-6 py-4 bg-white/[0.02] border-b border-white/5 flex justify-between items-center backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/10 rounded-lg">
            <Zap className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white tracking-tight">SwapSmith AI</h3>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] text-emerald-500/80 font-bold uppercase tracking-widest">System Ready</span>
            </div>
          </div>
        </div>
        <TrustIndicators confidence={currentConfidence} />
      </div>

      {/* 2. Message Feed */}
      <div className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-thin scrollbar-thumb-white/10">
        {messages.map((msg, index) => (
          <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2`}>
            <div className={`max-w-[85%] ${msg.role === 'user' ? 'order-1' : 'order-2'}`}>
              
              {msg.role === 'user' ? (
                <div className="bg-blue-600 text-white px-5 py-3 rounded-2xl rounded-tr-none shadow-lg shadow-blue-600/20 text-sm font-medium">
                  {msg.content}
                </div>
              ) : (
                
                <div className="space-y-3">
                  <div className="bg-white/[0.04] border border-white/10 text-gray-200 px-5 py-4 rounded-2xl rounded-tl-none text-sm leading-relaxed backdrop-blur-sm">
                    {msg.type === 'message' && <div className="whitespace-pre-line">{msg.content}</div>}
                    {msg.type === 'portfolio_summary' && (
                        <div>
                          <div className="whitespace-pre-line mb-3">{msg.content}</div>
                          {msg.data?.portfolioItems && msg.data?.parsedCommand && (
                            <PortfolioSummary 
                                items={msg.data.portfolioItems} 
                                onRetry={(failedItems) => handlePortfolioRetry(failedItems, msg.data!.parsedCommand!)} 
                            />
                          )}
                        </div>
                    )}
                    {msg.type === 'yield_info' && <div className="font-mono text-xs text-blue-300">{msg.content}</div>}
                    
                    {/* Inject your Custom Components (SwapConfirmation etc) here */}
                    {msg.type === 'intent_confirmation' && <IntentConfirmation command={msg.data?.parsedCommand} onConfirm={handleIntentConfirm} />}
                    {msg.type === 'swap_confirmation' && msg.data?.quoteData && (
                      <div className="space-y-4">
                        {/* Gas Fee Comparison */}
                        {msg.data?.quoteData?.depositNetwork && msg.data?.quoteData?.settleNetwork && (
                          <div className="mb-4">
                            <GasComparisonChart
                              fromChain={msg.data.quoteData.depositNetwork}
                              toChain={msg.data.quoteData.settleNetwork}
                              showRecommendation={true}
                              className="mb-4"
                            />
                            <div className="grid grid-cols-2 gap-2">
                              <GasFeeDisplay
                                chain={msg.data.quoteData.depositNetwork}
                                compact={true}
                                className="bg-white/5 rounded-lg p-2"
                              />
                              <GasFeeDisplay
                                chain={msg.data.quoteData.settleNetwork}
                                compact={true}
                                className="bg-white/5 rounded-lg p-2"
                              />
                            </div>
                          </div>
                        )}
                        <SwapConfirmation 
                          quote={msg.data.quoteData} 
                          confidence={msg.data.confidence}
                          onAmountChange={(newAmount) => {
                            // Update the quote with the new amount
                            const quoteData = msg.data?.quoteData;
                            if (quoteData) {
                              const updatedQuote = { ...quoteData, depositAmount: newAmount };
                              addMessage({
                                role: 'assistant',
                                content: `Amount updated to ${newAmount} ${quoteData.depositCoin}. Please review the new swap details.`,
                                type: 'message'
                              });
                            }
                          }}
                        />
                      </div>
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

      {/* 3. Input Console */}
      <div className="p-6 bg-gradient-to-t from-[#0B0E11] via-[#0B0E11] to-transparent">
        <div className="relative group transition-all duration-300">
          {/* Subtle glow effect on focus */}
          <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-2xl blur opacity-0 group-focus-within:opacity-100 transition duration-500" />
          
          <div className="relative flex items-center gap-3 bg-[#161A1E] border border-white/10 p-2 rounded-2xl group-focus-within:border-blue-500/50 transition-all">
            <button 
              onClick={handleVoiceRecording}
              disabled={!isAudioSupported}
              className={`p-3 rounded-xl transition-all ${
                !isAudioSupported ? 'bg-white/5 text-gray-600 cursor-not-allowed' :
                isRecording ? 'bg-red-500 text-white animate-pulse shadow-lg shadow-red-500/40' : 'bg-white/5 text-gray-400 hover:bg-white/10'
              }`}
            >
              {isRecording ? <StopCircle className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>
            
            <input
              ref={inputRef}
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
        
        {/* Voice Fallback */}
        {!isAudioSupported && (
            <div className="text-red-500 text-xs mt-2 px-1 text-center font-medium">
                🎤 Voice input is not supported in your browser. Please use Chrome or type your command.
            </div>
        )}

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
