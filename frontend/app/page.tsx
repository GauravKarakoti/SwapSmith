import WalletConnector from '@/components/WalletConnector';
import ChatInterface from '@/components/ChatInterface';
import { MessageCircle } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-8">
      {/* Main Card Container */}
      <div className="flex flex-col items-center max-w-4xl mx-auto bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-10">
        
        {/* Header Section */}
        <header className="text-center mb-10 space-y-3">
          <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">
            SwapSmith
          </h1>
          <p className="text-lg text-gray-500 font-medium">
            Your Voice-Activated Crypto Trading Assistant
          </p>
          
          {/* Telegram Button with Micro-interaction */}
          <div className="pt-4 flex justify-center">
            <a 
              href="https://t.me/SwapSmithBot" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#229ED9] text-white rounded-full text-sm font-semibold hover:bg-[#1b81b0] transition-all duration-200 hover:scale-105 shadow-sm hover:shadow-md"
            >
              <MessageCircle className="w-4 h-4" />
              Chat on Telegram
            </a>
          </div>
        </header>
        
        {/* Wallet Section */}
        <div className="mb-8 w-full flex justify-center">
          <WalletConnector />
        </div>
        
        {/* Chat Interface Container */}
        <div className="w-full">
          <ChatInterface />
        </div>

      </div>
    </div>
  );
}