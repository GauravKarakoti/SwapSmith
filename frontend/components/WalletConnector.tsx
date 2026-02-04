'use client'

import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { Wallet, LogOut } from 'lucide-react';

export default function WalletConnector() {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const connector = connectors[0];

  if (isConnected)
    return (
      <div className="flex items-center gap-3">
        <div className="hidden md:flex flex-col items-end">
          <span className="text-[10px] text-gray-500 font-bold uppercase tracking-tight">Connected</span>
          <span className="text-xs font-mono text-blue-400">
            {address?.substring(0, 6)}...{address?.substring(address.length - 4)}
          </span>
        </div>
        <button 
          onClick={() => disconnect()}
          className="p-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl transition-colors border border-red-500/20"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    );
    
  return (
    <button 
      onClick={() => connect({ connector })}
      className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-xl transition-all shadow-lg shadow-blue-600/20 active:scale-95"
    >
      <Wallet className="w-4 h-4" />
      Connect Wallet
    </button>
  );
}