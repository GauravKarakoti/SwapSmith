import WalletConnector from '@/components/WalletConnector';
import ChatInterface from '@/components/ChatInterface';
import Footer from '@/components/Footer';
import { MessageCircle, Zap } from 'lucide-react';

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
    <main className="min-h-screen flex flex-col items-center p-4 md:p-8">
      {/* Navigation / Header */}
      <nav className="w-full max-w-6xl flex justify-between items-center mb-12 backdrop-blur-md bg-white/5 border border-white/10 p-4 rounded-2xl">
        <div className="flex items-center gap-2">
          <div className="bg-blue-600 p-2 rounded-lg">
            <Zap className="w-5 h-5 text-white" fill="white" />
          </div>
          <span className="text-xl font-bold tracking-tight">SwapSmith</span>
        </div>
        <WalletConnector />
      </nav>

      <div className="w-full max-w-4xl space-y-8">
        <header className="text-center space-y-4">
          <h1 className="text-5xl md:text-6xl font-extrabold bg-clip-text text-transparent bg-gradient-to-b from-white to-gray-400 tracking-tighter">
            Trade with Intelligence.
          </h1>
          <p className="text-gray-400 text-lg max-w-xl mx-auto font-medium">
            The next-generation voice-activated assistant for cross-chain swaps and yield scouting.
          </p>
          
          <div className="flex justify-center gap-4">
            <a 
              href="https://t.me/SwapSmithBot"  
              target='_blank'
              className="group flex items-center gap-2 px-5 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full transition-all"
            >
              <MessageCircle className="w-4 h-4 text-[#229ED9]" />
              <span className="text-sm font-semibold">Join Telegram</span>
            </a>
          </div>
        </header>

        {/* Chat Interface Container */}
        <div className="relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-purple-600 rounded-3xl blur opacity-20 group-hover:opacity-30 transition duration-1000"></div>
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