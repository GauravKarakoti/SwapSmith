'use client'

import { useState, useRef, useEffect } from 'react';
import { useAccount } from 'wagmi';
import SwapConfirmation from './SwapConfirmation';
import TrustIndicators from './TrustIndicators';
import IntentConfirmation from './IntentConfirmation';
import { SideShiftQuote } from '@/utils/sideshift-client';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  type?: 'message' | 'intent_confirmation' | 'swap_confirmation';
  data?: {
    parsedCommand?: any;
    quoteData?: SideShiftQuote;
    confidence?: number;
  };
}

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [pendingCommand, setPendingCommand] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { isConnected } = useAccount();

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const addMessage = (message: Omit<Message, 'timestamp'>) => {
    setMessages(prev => [...prev, { ...message, timestamp: new Date() }]);
  };

  const handleSend = async () => {
    if (!input.trim() || !isConnected || isLoading) return;

    setIsLoading(true);
    const userMessage: Message = { 
      role: 'user', 
      content: input,
      type: 'message',
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMessage]);
    setInput('');

    try {
      const response = await fetch('/api/parse-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input }),
      });
      
      const parsedCommand = await response.json();
      
      if (!parsedCommand.success) {
        addMessage({
          role: 'assistant',
          content: `I couldn't understand your request. ${parsedCommand.validationErrors?.join(', ') || 'Please try being more specific.'}`,
          type: 'message'
        });
        setIsLoading(false); // Stop loading on parse failure
        return;
      }

      // Show intent confirmation for low confidence or complex swaps
      if (parsedCommand.requiresConfirmation || parsedCommand.confidence < 80) {
        setPendingCommand(parsedCommand);
        addMessage({
          role: 'assistant',
          content: '',
          type: 'intent_confirmation',
          data: { parsedCommand }
        });
      } else {
        // Proceed directly to quote for high-confidence commands
        await executeSwap(parsedCommand);
      }
      
    } catch (error) {
      console.error('Error processing command:', error);
      addMessage({
        role: 'assistant',
        content: 'Sorry, I encountered a network error. Please check your connection and try again.',
        type: 'message'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const executeSwap = async (command: any) => {
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
      
      // ✅ FIX: Check for a specific error from the API and throw it
      if (quote.error) {
        throw new Error(quote.error);
      }
      
      addMessage({
        role: 'assistant',
        content: `I've prepared your swap: ${quote.depositAmount} ${quote.depositCoin} → ${quote.settleAmount} ${quote.settleCoin}`,
        type: 'swap_confirmation',
        data: { quoteData: quote, confidence: command.confidence }
      });
      
    } catch (error) {
      // ✅ FIX: Catch the error and display it to the user in the chat
      const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
      addMessage({
        role: 'assistant',
        content: `⚠️ Oops! There was a problem creating your swap: ${errorMessage}`,
        type: 'message'
      });
    }
  };

  const handleIntentConfirm = async (confirmed: boolean) => {
    // Disable existing confirmation buttons after a choice is made
    setMessages(prev => prev.map(msg => 
        msg.type === 'intent_confirmation' ? { ...msg, type: 'message', content: 'Swap intent was reviewed.' } : msg
    ));

    if (confirmed && pendingCommand) {
      setIsLoading(true);
      await executeSwap(pendingCommand);
      setIsLoading(false);
    } else {
      addMessage({
        role: 'assistant',
        content: 'Got it. Please rephrase your request with more specific details.',
        type: 'message'
      });
    }
    setPendingCommand(null);
  };

  return (
    <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-lg overflow-hidden">
      <TrustIndicators />
      
      <div className="h-96 overflow-y-auto p-4 bg-gray-50">
        {messages.map((msg, index) => (
          <div key={index} className={`mb-4 ${msg.role === 'user' ? 'text-right' : ''}`}>
            {msg.type === 'intent_confirmation' ? (
              <IntentConfirmation 
                command={msg.data?.parsedCommand}
                onConfirm={handleIntentConfirm}
              />
            ) : msg.type === 'swap_confirmation' ? (
              <>
                <div className={`inline-block p-3 rounded-lg max-w-xs lg:max-w-md ${
                  msg.role === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-800'
                }`}>
                  {msg.content}
                </div>
                {msg.data?.quoteData && (
                  <SwapConfirmation 
                    quote={msg.data.quoteData} 
                    confidence={msg.data.confidence}
                  />
                )}
              </>
            ) : (
              <div className={`inline-block p-3 rounded-lg max-w-xs lg:max-w-md ${
                msg.role === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-800'
              }`}>
                {msg.content}
              </div>
            )}
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start mb-4">
            <div className="bg-gray-200 p-3 rounded-lg">
              <div className="flex space-x-2">
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-gray-200 p-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="What would you like to swap? (e.g., 'Swap 50% of my ETH for BTC on Arbitrum')"
            disabled={!isConnected || isLoading}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            className="flex-1 p-3 border border-gray-300 text-gray-900 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button 
            onClick={handleSend} 
            disabled={!isConnected || isLoading || !input.trim()}
            className="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg font-medium disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed hover:from-blue-600 hover:to-blue-700 transition-all"
          >
            {isLoading ? '⏳' : 'Send'}
          </button>
        </div>
        <div className="text-xs text-gray-500 mt-2 text-center">
          {!isConnected ? 'Connect your wallet to start trading' : 'Example: "Swap 0.1 ETH for USDC on Polygon"'}
        </div>
      </div>
    </div>
  );
}