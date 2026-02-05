'use client' 

import { useEffect } from 'react';
import WalletConnector from '@/components/WalletConnector';
import ChatInterface from '@/components/ChatInterface';
import Footer from '@/components/Footer';
import { MessageCircle, Zap } from 'lucide-react';

export default function TerminalPage() {
  
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-[#050505] text-white overflow-x-hidden">

      <main className="flex-1 flex flex-col items-center p-4 md:p-8">
        
        {/* Navigation Bar */}
        <nav className="w-full max-w-6xl flex justify-between items-center mb-8 md:mb-12 backdrop-blur-md bg-white/5 border border-white/10 p-4 rounded-2xl shadow-2xl">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-xl shadow-lg shadow-blue-600/20">
              <Zap className="w-5 h-5 text-white" fill="white" />
            </div>
            <span className="text-xl font-black tracking-tighter uppercase">SwapSmith</span>
          </div>
          <WalletConnector />
        </nav>

        {/* Content Container */}
        <div className="w-full max-w-4xl space-y-6 md:space-y-10 animate-in fade-in zoom-in-95 duration-500">
          <header className="text-center space-y-4">
            <h1 className="text-4xl md:text-7xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-b from-white to-white/40">
              Terminal Alpha.
            </h1>
            <div className="flex justify-center">
               <a href="https://t.me/SwapSmithBot" target='_blank' className="flex items-center gap-2 text-[10px] font-black text-zinc-500 hover:text-white uppercase tracking-widest transition-colors bg-white/5 px-4 py-2 rounded-full border border-white/5">
                 <MessageCircle className="w-3 h-3 text-[#229ED9]" /> 
                 Support & Community
               </a>
            </div>
          </header>

          {/* Chat Interface Container - Focus of the page */}
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-purple-600 rounded-[2.5rem] blur opacity-15 group-hover:opacity-25 transition duration-1000"></div>
            <div className="relative">
               <ChatInterface />
            </div>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
}