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

export default function WalletConnector() {
  const { address, isConnected, chain } = useAccount();
  const { connect, connectors, isPending, error } = useConnect();
  const { disconnect } = useDisconnect();
  
  // FIX: Destructure handleError from the hook
  const { handleError } = useErrorHandler();
  
  // FIX: Define missing state
  const [connectionError, setConnectionError] = useState<string>('');

  // FIX: Merged the two handleConnect declarations into one
  const handleConnect = () => {
    setConnectionError('');
    console.log("Available connectors:", connectors);

    if (!connectors || connectors.length === 0) {
      setConnectionError('No wallet connectors available. Please install MetaMask or another Web3 wallet.');
      return;
    }

    // Prefer MetaMask specifically, then Injected, then the first available
    const metaMaskConnector = connectors.find((c) => c.id === 'metaMask' || c.name === 'MetaMask');
    const injectedConnector = connectors.find((c) => c.id === 'injected' || c.name === 'Injected');
    const connectorToUse = metaMaskConnector || injectedConnector || connectors[0];

    console.log("Attempting to connect with:", connectorToUse.name, connectorToUse.id);

    connect({ connector: connectorToUse }, {
      onError: (err: Error) => {
        console.error('Failed to connect:', err);
        if (err?.message?.includes('Unexpected error')) {
          console.warn("It looks like a wallet extension (e.g. Phantom) is failing. Try disabling conflicting wallets.");
        }
      }
    });
  };

  useEffect(() => {
    // Clear error when connected
    if (isConnected && connectionError) {
      setConnectionError('');
      return;
    }
    
    // Handle connection errors
    if (!error || isConnected) {
      return;
    }

    let errorMessage: string;
    
    if (error instanceof ConnectorNotFoundError) {
      errorMessage = 'Wallet not detected. Please install MetaMask or another Web3 wallet.';
    } else if (error instanceof ChainNotConfiguredError) {
      errorMessage = 'Unsupported network. Please switch to a supported chain.';
    } else if (error instanceof ConnectorUnavailableReconnectingError ) {
      errorMessage = 'Connector unavailable while reconnecting';
    } else if (error instanceof ConnectorAlreadyConnectedError) {
      errorMessage = 'Wallet is already processing a request. Please check your wallet.';
    } else {
      // FIX: handleError is now available via useErrorHandler()
      errorMessage = handleError(error, ErrorType.WALLET_ERROR, {
        operation: 'wallet_connect',
        retryable: true,
      });
    }

    setConnectionError(errorMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error, isConnected]);

  if (isConnected) {
    return (
      <div className="flex items-center gap-3">
        <div className="hidden md:flex flex-col items-end">
          <span className="text-[10px] text-gray-500 font-bold uppercase tracking-tight">
            Connected {chain?.name && `• ${chain.name}`}
          </span>
          <span className="text-xs font-mono text-blue-400">
            {address?.substring(0, 6)}...{address?.substring(address.length - 4)}
          </span>
        </div>
        <button
          onClick={() => disconnect()}
          className="p-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl transition-colors border border-red-500/20"
          title="Disconnect Wallet"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        onClick={handleConnect}
        className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-xl transition-all shadow-lg shadow-blue-600/20 active:scale-95"
      >
        {isPending ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Wallet className="w-4 h-4" />
        )}
        {isPending ? 'Connecting...' : 'Connect Wallet'}
      </button>
      {connectionError && (
        <span className="text-[10px] text-red-500 bg-red-500/10 px-2 py-1 rounded-md border border-red-500/20">
          {connectionError}
        </span>
      )}
    </div>
  );
}