'use client'

import { useRouter, usePathname } from 'next/navigation';
import { Zap, ArrowRight } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated } = useAuth();

  const handleAppClick = () => {
    if (isAuthenticated) {
      router.push('/terminal');
    } else {
      router.push('/login');
    }
  };

  return (
    <nav className="fixed top-0 w-full z-50 border-b border-white/5 bg-[#050505]/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex justify-between items-center">
        <button
          onClick={() => router.push('/')}
          className="flex items-center gap-2 group"
        >
          <Zap className="w-5 h-5 sm:w-6 sm:h-6 text-blue-500" fill="currentColor" />
          <span className="text-lg sm:text-xl font-black tracking-tighter uppercase text-white">
            SwapSmith
          </span>
        </button>

        <div className="flex items-center gap-2 sm:gap-4">
          <button
            onClick={() => router.push('/')}
            className={`text-sm font-semibold transition-colors px-2 sm:px-3 py-2 ${
              pathname === '/' ? 'text-white' : 'text-zinc-400 hover:text-white'
            }`}
          >
            Home
          </button>
          
          <button
            onClick={() => router.push('/prices')}
            className={`text-sm font-semibold transition-colors px-2 sm:px-3 py-2 ${
              pathname === '/prices' ? 'text-white' : 'text-zinc-400 hover:text-white'
            }`}
          >
            Live Prices
          </button>

          <button
            onClick={handleAppClick}
            className="group flex items-center gap-1.5 sm:gap-2 bg-white text-black px-3 sm:px-6 py-2 sm:py-2.5 rounded-full text-xs font-bold uppercase tracking-widest hover:bg-zinc-200 transition-all active:scale-95 shadow-[0_0_20px_rgba(255,255,255,0.1)]"
          >
            <span className="hidden sm:inline">Launch App</span>
            <span className="sm:hidden">App</span>
            <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>
    </nav>
  );
}
