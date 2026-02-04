'use client'

import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { Wallet, LogOut, Loader2, AlertCircle } from 'lucide-react';
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
  const { handleError } = useErrorHandler();
  const [connectionError, setConnectionError] = useState<string>('');

  
 useEffect(() => {
  if (!error) {
    if (connectionError !== '') {
      setConnectionError('');
    }
    return;
  }

  // console.log('Wallet connection error', error);

  let errorMessage: string;
  
  if (error instanceof ConnectorNotFoundError) {
    errorMessage = 'Wallet not detected. Please install MetaMask or another Web3 wallet.';
  } else if (error instanceof ChainNotConfiguredError) {
    errorMessage = 'Unsupported network. Please switch to a supported chain.';
  }else if (error instanceof ConnectorUnavailableReconnectingError ) {
    errorMessage = 'Connector unavailable while reconnecting';
  } else if (error instanceof  ConnectorAlreadyConnectedError) {
  errorMessage = 'Wallet is already processing a request. Please check your wallet.';
  } 

  else {
    
    errorMessage = handleError(error, ErrorType.WALLET_ERROR, {
      operation: 'wallet_connect',
      retryable: true,
    });
  }

  if (connectionError !== errorMessage) {
    setConnectionError(errorMessage);
  }
}, [error, handleError, connectionError]);

useEffect(() => {
  if (isConnected && connectionError !== '') {
    setConnectionError('');
    // console.log('Wallet connected successfully');
  }
}, [isConnected, connectionError]);


  useEffect(() => {
    const info = {
      connectorsCount: connectors?.length || 0,
      connectorNames: connectors?.map(c => ({ id: c.id, name: c.name })) || [],
      isConnected,
      chain: chain?.name || null,
      address: address ? `${address.substring(0, 6)}...${address.substring(address.length - 4)}` : null,
      error: error?.message || null,
      connectionError
    };
    // console.log('WalletConnector Debug:', info);

  }, [connectors, isConnected, address, chain, error, connectionError]);

  const handleConnect = () => {
    setConnectionError('');
    
    if (!connectors || connectors.length === 0) {
      setConnectionError('No wallet connectors available. Please install MetaMask or another Web3 wallet.');
      return;
    }

    const connector = connectors[0];
    if (!connector) {
      setConnectionError('Wallet connector not found. Please install MetaMask or another Web3 wallet.');
      return;
    }

    // console.log('Attempt to connect with connector', connector.name);
    connect({ connector });
  };

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


  if (connectionError) {
    return (
      <div className="flex flex-col items-end gap-2">
        <button 
          onClick={handleConnect}
          disabled={isPending}
          className="flex items-center gap-2 px-6 py-2.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 text-sm font-bold rounded-xl transition-all border border-red-500/20"
          title={connectionError}
        >
          <AlertCircle className="w-4 h-4" />
          Retry Connection
        </button>
        <span className="text-xs text-red-400 max-w-xs text-right">
          {connectionError}
        </span>
      </div>
    );
  }
    
  return (
    <button 
      onClick={handleConnect}
      disabled={isPending || !connectors?.length}
      className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 disabled:cursor-not-allowed text-white text-sm font-bold rounded-xl transition-all shadow-lg shadow-blue-600/20 active:scale-95 disabled:active:scale-100"
      title={!connectors?.length ? "No wallet detected. Please install MetaMask." : "Connect your wallet"}
    >
      {isPending ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Wallet className="w-4 h-4" />
      )}
      {isPending ? 'Connecting...' : 'Connect Wallet'}
    </button>
  );
}