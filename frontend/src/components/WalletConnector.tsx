'use client'

import { useAccount, useConnect, useDisconnect } from 'wagmi';

export default function WalletConnector() {
  const { address, isConnected } = useAccount();
  // 2. The useConnect hook now provides the `connect` function and a list of `connectors`
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  // Get the first available connector (usually the injected browser wallet like MetaMask)
  const connector = connectors[0];

  if (isConnected)
    return (
      <div className="flex items-center gap-2 p-4 bg-gray-100 rounded-lg">
        <span className="text-sm font-medium text-black">
          Connected to {address?.substring(0, 6)}...{address?.substring(address.length - 4)}
        </span>
        <button 
          onClick={() => disconnect()}
          className="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600"
        >
          Disconnect
        </button>
      </div>
    );
    
  return (
    // 3. Call `connect` with the desired connector from the `connectors` array
    <button 
      onClick={() => connect({ connector })}
      className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
    >
      Connect Wallet
    </button>
  );
}