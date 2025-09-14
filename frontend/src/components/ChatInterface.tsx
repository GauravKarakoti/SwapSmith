'use client'

import { useState } from 'react';
import { useAccount } from 'wagmi';
import SwapConfirmation from './SwapConfirmation';
// ✅ FIX: Import the SideShiftQuote type for type safety.
import { SideShiftQuote } from '@/utils/sideshift-client';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  // ✅ FIX: Replaced `any` with the specific `SideShiftQuote` type.
  quoteData?: SideShiftQuote;
}

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  // ✅ FIX: Removed the unused `address` variable.
  const { isConnected } = useAccount();
  
  const handleSend = async () => {
    if (!input.trim() || !isConnected) return;
    
    setIsLoading(true);

    const userMessage: Message = { role: 'user', content: input };
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
        throw new Error(parsedCommand.errorMessage);
      }
      
      const quoteResponse = await fetch('/api/create-swap', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fromAsset: parsedCommand.fromAsset,
          toAsset: parsedCommand.toAsset,
          amount: parsedCommand.amount,
          fromChain: parsedCommand.fromChain,
          toChain: parsedCommand.toChain
        }),
      });
      
      const quote = await quoteResponse.json();
      
      // Check if the response contains an error
      if (quote.error) {
        throw new Error(quote.error);
      }
      
      // If the quote is successful, create the confirmation message.
      const assistantMessage: Message = { 
        role: 'assistant', 
        content: `Okay, I will swap ${quote.depositAmount} ${quote.depositCoin} for approximately ${quote.settleAmount} ${quote.settleCoin}. Do you want to proceed?`,
        quoteData: quote
      };
      setMessages(prev => [...prev, assistantMessage]);
      
    } catch (error) {
      console.error('Error processing command:', error);
      const errorMessage: Message = { 
        role: 'assistant', 
        content: (error as Error).message,
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="max-w-2xl mx-auto p-4 bg-white rounded-lg shadow">
      <div className="h-96 overflow-y-auto mb-4 p-4 bg-gray-50 rounded">
        {messages.map((msg, index) => (
          <div key={index} className={`mb-4 ${msg.role === 'user' ? 'text-right' : ''}`}>
            <div className={`inline-block p-3 rounded-lg ${msg.role === 'user' ? 'bg-blue-500' : 'bg-gray-500'}`}>
              {msg.content}
              {/* Only show confirmation if there's no error */}
              {msg.quoteData && !msg.quoteData.error && <SwapConfirmation quote={msg.quoteData} />}
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="What would you like to swap?"
          disabled={!isConnected || isLoading}
          onKeyPress={(e) => e.key === 'Enter' && handleSend()}
          className="flex-1 p-2 text-black border border-gray-300 rounded"
        />
        <button 
          onClick={handleSend} 
          disabled={!isConnected || isLoading}
          className="px-4 py-2 bg-blue-500 text-white rounded disabled:bg-gray-400"
        >
          {isLoading ? 'Processing...' : 'Send'}
        </button>
      </div>
    </div>
  );
}