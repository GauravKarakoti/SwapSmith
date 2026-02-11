'use client'

import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { Wallet, LogOut, Loader2 } from 'lucide-react';
import { useErrorHandler, ErrorType } from '@/hooks/useErrorHandler';
import { useState, useEffect } from 'react';
import {
  ConnectorAlreadyConnectedError,
  ConnectorNotFoundError,
  ChainNotConfiguredError,
  ConnectorUnavailableReconnectingError
} from 'wagmi';

/**
 * Shimmering Skeleton for Initial Load
 */
const WalletSkeleton = () => (
  <div className="flex items-center gap-3 animate-in fade-in duration-500">
    <div className="hidden md:flex flex-col items-end gap-1.5">
      <div className="h-2 w-12 bg-white/5 rounded-full animate-pulse" />
      <div className="h-3 w-20 bg-white/10 rounded-full animate-pulse" />
    </div>
    <div className="h-10 w-10 bg-white/5 rounded-xl border border-white/5 animate-pulse" />
  </div>
);

export default function WalletConnector() {
  // Added isReconnecting to handle the initial sync state
  const { address, isConnected, chain, isReconnecting } = useAccount();
  const { connect, connectors, isPending, error } = useConnect();
  const { disconnect } = useDisconnect();
  const { handleError } = useErrorHandler();
  
  const [connectionError, setConnectionError] = useState<string>('');

  const handleConnect = () => {
    setConnectionError('');
    
    if (!connectors || connectors.length === 0) {
      setConnectionError('No wallet detected. Please install MetaMask.');
      return;
    }

    // Professional selection logic: MetaMask > Injected > First Available
    const connectorToUse = 
      connectors.find((c) => c.id === 'metaMask' || c.name === 'MetaMask') || 
      connectors.find((c) => c.id === 'injected' || c.name === 'Injected') || 
      connectors[0];

    connect({ connector: connectorToUse });
  };

  useEffect(() => {
    if (isConnected && connectionError) {
      setConnectionError('');
      return;
    }
    
    if (!error || isConnected) return;

    let errorMessage: string;
    
    if (error instanceof ConnectorNotFoundError) {
      errorMessage = 'Wallet not detected.';
    } else if (error instanceof ChainNotConfiguredError) {
      errorMessage = 'Unsupported network. Please switch.';
    } else if (error instanceof ConnectorUnavailableReconnectingError ) {
      errorMessage = 'Reconnecting to wallet...';
    } else if (error instanceof ConnectorAlreadyConnectedError) {
      errorMessage = 'Request already pending in wallet.';
    } else {
      errorMessage = handleError(error, ErrorType.WALLET_ERROR, {
        operation: 'wallet_connect',
        retryable: true,
      });
    }

    setConnectionError(errorMessage);
  }, [error, isConnected, handleError, connectionError]);

  // 1. Loading/Syncing State
  if (isReconnecting) {
    return <WalletSkeleton />;
  }

  // 2. Authenticated State
  if (isConnected) {
    return (
      <div className="flex items-center gap-3 animate-in fade-in zoom-in-95 duration-300">
        <div className="hidden md:flex flex-col items-end">
          <span className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.15em]">
            {chain?.name || 'Online'}
          </span>
          <span className="text-xs font-mono font-bold text-blue-400 bg-blue-400/5 px-2 py-0.5 rounded-md border border-blue-400/10">
            {address?.substring(0, 6)}...{address?.substring(address.length - 4)}
          </span>
        </div>
        <button
          onClick={() => disconnect()}
          className="p-2.5 bg-zinc-900/50 border border-zinc-800 hover:border-red-500/40 hover:bg-red-500/5 text-zinc-500 hover:text-red-500 rounded-xl transition-all group"
          title="Disconnect Wallet"
        >
          <LogOut className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
        </button>
      </div>
    );
  }

  // 3. Default State (Connect Button)
  return (
    <div className="flex flex-col items-end gap-2">
      <button
        onClick={handleConnect}
        disabled={isPending}
        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg active:scale-95 ${
          isPending 
            ? 'bg-blue-600/40 text-blue-200 cursor-wait' 
            : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/20'
        }`}
      >
        {isPending ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Wallet className="w-4 h-4" />
        )}
        <span>{isPending ? 'Requesting...' : 'Connect Wallet'}</span>
      </button>
      
      {connectionError && (
        <span className="text-[10px] text-red-400 font-bold bg-red-500/5 px-2 py-1 rounded-lg border border-red-500/10 animate-in slide-in-from-top-1">
          {connectionError}
        </span>
      )}
    </div>
  );
}