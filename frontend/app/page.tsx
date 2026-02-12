import WalletConnector from '@/components/WalletConnector';
import ChatInterface from '@/components/ChatInterface';
import { MessageCircle } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="flex flex-col items-center max-w-4xl mx-auto">
        <header className="text-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800">SwapSmith</h1>
          <p className="text-gray-600">Your Voice-Activated Crypto Trading Assistant</p>
          
          <div className="mt-3 flex justify-center">
            <a 
              href="https://t.me/SwapSmithBot" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#229ED9] text-white rounded-full text-sm font-medium hover:bg-[#1b81b0] transition-colors shadow-sm"
            >
              <MessageCircle className="w-4 h-4" />
              Chat on Telegram
            </a>
            <a
              href="/dca"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-full text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm ml-2"
            >
              <MessageCircle className="w-4 h-4" />
              Smart DCA
            </a>
          </div>
        </header>
        
        <div className="mb-6 w-full flex justify-center">
          <WalletConnector />
        </div>
        
        <ChatInterface />
      </div>
    </div>
  );
}