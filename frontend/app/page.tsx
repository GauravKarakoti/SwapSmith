import WalletConnector from '@/components/WalletConnector';
import ChatInterface from '@/components/ChatInterface';
import { MessageCircle, Sparkles } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-4 sm:p-8">
      {/* Animated Background Pattern */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-r from-blue-200/30 to-purple-200/30 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-r from-emerald-200/30 to-blue-200/30 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>

      {/* Main Card Container */}
      <div className="relative flex flex-col items-center max-w-6xl mx-auto bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/50 p-2 sm:p-6 lg:p-10">
        
        {/* Decorative Top Gradient Bar */}
        <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-48 h-2 bg-gradient-to-r from-blue-500 via-purple-500 to-emerald-500 rounded-full shadow-lg"></div>
        
        {/* Header Section */}
        <header className="text-center mb-12 space-y-6 pt-12">
          <div className="inline-flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-200/50 rounded-2xl backdrop-blur-sm mb-6">
            <Sparkles className="w-6 h-6 text-blue-500" />
            <h1 className="text-5xl lg:text-6xl font-black bg-gradient-to-r from-gray-900 via-gray-800 to-black/80 bg-clip-text text-transparent tracking-tight">
              SwapSmith
            </h1>
          </div>
          
          <p className="text-xl lg:text-2xl text-gray-600 font-light max-w-2xl mx-auto leading-relaxed">
            Voice-Activated Crypto Trading Assistant with AI Precision
          </p>
          
          {/* Enhanced Telegram Button */}
          <div className="flex justify-center">
            <a 
              href="https://t.me/SwapSmithBot" 
              target="_blank" 
              rel="noopener noreferrer"
              className="group inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-[#229ED9] to-blue-600 text-white rounded-2xl text-lg font-semibold shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 hover:from-[#1b81b0] hover:to-blue-700 border border-blue-500/30 backdrop-blur-sm"
            >
              <MessageCircle className="w-5 h-5 group-hover:scale-110 transition-transform" />
              Chat on Telegram
              <span className="ml-2 inline-block w-2 h-2 bg-white/50 rounded-full animate-ping"></span>
            </a>
          </div>
        </header>
        
        {/* Enhanced Wallet Section */}
        <div className="w-full max-w-md mb-12">
          <WalletConnector />
        </div>
        
        {/* Chat Interface Container */}
        <div className="w-full max-w-4xl">
          <ChatInterface />
        </div>
      </div>
    </div>
  );
}
