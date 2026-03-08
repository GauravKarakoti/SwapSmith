import { useState } from 'react'
import { CheckCircle, AlertCircle, ExternalLink, Copy, Check, ShieldCheck, Shield, AlertTriangle, Info, TrendingUp, Zap, Wallet } from 'lucide-react'
import { useAccount, useSendTransaction, useSwitchChain, usePublicClient } from 'wagmi'
import { parseEther, formatEther, type Chain } from 'viem'
import { mainnet, polygon, arbitrum, avalanche, optimism, bsc, base } from 'wagmi/chains'
import { SIDESHIFT_CONFIG } from '../../shared/config/sideshift'

export interface QuoteData {
  depositAmount: string;
  depositCoin: string;
  depositNetwork: string;
  rate: string;
  settleAmount: string;
  settleCoin: string;
  settleNetwork: string;
  depositAddress?: string;
  memo?: string;
  expiry?: string;
  id?: string;
}

interface SwapConfirmationProps {
  quote: QuoteData;
  confidence?: number;
  onAmountChange?: (newAmount: string) => void;
}

const EXPLORER_URLS: { [key: string]: string } = {
  ethereum: 'https://etherscan.io',
  bitcoin: 'https://blockchain.com/explorer',
  polygon: 'https://polygonscan.com',
  arbitrum: 'https://arbiscan.io',
  avalanche: 'https://snowtrace.io',
  optimism: 'https://optimistic.etherscan.io',
  bsc: 'https://bscscan.com',
  base: 'https://basescan.org',
  solana: 'https://solscan.io',
}

const CHAIN_MAP: { [key: string]: Chain } = {
  ethereum: mainnet,
  polygon: polygon,
  arbitrum: arbitrum,
  avalanche: avalanche,
  optimism: optimism,
  bsc: bsc,
  base: base,
}

interface SafetyCheckResult {
  passed: boolean;
  checks: {
    balance: { passed: boolean; message: string };
    gas: { passed: boolean; message: string; estimatedGas?: string };
    network: { passed: boolean; message: string };
    address: { passed: boolean; message: string };
  };
  riskLevel: 'safe' | 'warning' | 'unsafe';
  overallMessage: string;
}

export default function SwapConfirmation({ quote, confidence, onAmountChange }: SwapConfirmationProps) {
  const [copiedAddress, setCopiedAddress] = useState(false)
  const [copiedMemo, setCopiedMemo] = useState(false)
  const [isSimulating, setIsSimulating] = useState(false);
  const [safetyCheck, setSafetyCheck] = useState<SafetyCheckResult | null>(null);
  const [walletBalance, setWalletBalance] = useState<string | null>(null);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);

  const { address, isConnected, chain: connectedChain } = useAccount()
  const { data: hash, error, isPending, isSuccess, sendTransaction } = useSendTransaction()
  const { switchChainAsync } = useSwitchChain()

  const depositChainId = CHAIN_MAP[quote.depositNetwork.toLowerCase()]?.id;
  const publicClient = usePublicClient({ chainId: depositChainId });

  // --- NEW: Max Button Logic ---
  const handleMaxClick = async () => {
    if (!address || !publicClient) {
      alert("Please connect your wallet to fetch balance.");
      return;
    }

    setIsLoadingBalance(true);
    try {
      const balance = await publicClient.getBalance({ address });
      const balanceInEther = formatEther(balance);
      
      let finalAmount = balanceInEther;

      // Gas Buffer: If sending native token (ETH/MATIC), leave 0.005 for gas
      const isNative = quote.depositCoin.toUpperCase() === connectedChain?.nativeCurrency.symbol;
      if (isNative) {
        const buffer = 0.005;
        const calculated = parseFloat(balanceInEther) - buffer;
        finalAmount = calculated > 0 ? calculated.toFixed(6) : "0";
      }

      // Update the parent state (SwapSmith Agent)
      if (onAmountChange) {
        onAmountChange(balanceFormatted);
        // Show confirmation feedback
        setTimeout(() => {
          // Balance display will update after new quote is fetched
        }, 300);
      } else {
        alert(`Your max balance is ${parseFloat(balanceFormatted).toFixed(4)} ${quote.depositCoin}. Please update the amount manually.`);
        onAmountChange(finalAmount);
      }
    } catch (err) {
      console.error('Max balance fetch failed:', err);
    } finally {
      setIsLoadingBalance(false);
    }
  };

  const handleConfirm = async () => {
    if (!quote.depositAddress || !depositChainId) return;
    try {
      if (connectedChain?.id !== depositChainId) {
        await switchChainAsync?.({ chainId: depositChainId });
      }
      sendTransaction?.({
        to: quote.depositAddress as `0x${string}`,
        value: parseEther(quote.depositAmount),
        chainId: depositChainId,
      });
    } catch (e) { console.error(e); }
  };

  const copyToClipboard = async (text: string, type: 'address' | 'memo') => {
    await navigator.clipboard.writeText(text);
    if (type === 'address') setCopiedAddress(true);
    else setCopiedMemo(true);
    setTimeout(() => { setCopiedAddress(false); setCopiedMemo(false); }, 2000);
  };

  if (isSuccess) {
    return (
      <div className="mt-4 bg-white border border-green-300 rounded-lg p-6 text-center shadow-md">
        <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-2" />
        <h4 className="font-bold text-gray-900">Swap Initiated!</h4>
        <p className="text-sm text-gray-600">Track your transaction on the explorer.</p>
      </div>
    );
  }

  return (
    <div className="mt-4 bg-white border border-gray-200 rounded-xl p-5 shadow-lg max-w-md mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-bold text-gray-800 flex items-center gap-2">
          <Zap className="w-4 h-4 text-yellow-500 fill-current" /> Confirm Swap
        </h4>
        <div className="text-xs bg-gray-100 px-2 py-1 rounded-full text-gray-500">
          SideShift.ai API
        </div>
      </div>

      <div className="space-y-4">
        {/* You Send Section with Max Button */}
        <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs font-semibold text-blue-600 uppercase tracking-tight">You Send</span>
            <button 
              onClick={handleMaxClick}
              disabled={isLoadingBalance || !isConnected}
              className="flex items-center gap-1 text-[10px] font-bold bg-blue-600 text-white px-2 py-0.5 rounded hover:bg-blue-700 transition-all disabled:opacity-50"
            >
              <Wallet className="w-3 h-3" /> {isLoadingBalance ? '...' : 'USE MAX'}
            </button>
          </div>
          {walletBalance && !isLoadingBalance && (
            <span className="text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded block mb-2">
              Balance: {parseFloat(walletBalance).toFixed(4)} {quote.depositCoin}
            </span>
          )}
          <div className="flex justify-between items-end">
            <span className="text-xl font-bold text-blue-900">{quote.depositAmount}</span>
            <span className="text-sm font-medium text-blue-700">{quote.depositCoin} ({quote.depositNetwork})</span>
          </div>
        </div>

        {/* Receive Section */}
        <div className="bg-green-50 border border-green-100 rounded-lg p-3">
          <span className="text-xs font-semibold text-green-600 uppercase tracking-tight">You Receive Approx.</span>
          <div className="flex justify-between items-end mt-1">
            <span className="text-xl font-bold text-green-900">{quote.settleAmount}</span>
            <span className="text-sm font-medium text-green-700">{quote.settleCoin}</span>
          </div>
        </div>

        {/* Deposit Address Info */}
        <div className="pt-2">
          <div className="flex justify-between text-[11px] text-gray-500 mb-1 px-1">
            <span>Deposit Address</span>
            <button onClick={() => copyToClipboard(quote.depositAddress || '', 'address')} className="text-blue-600 hover:underline">
              {copiedAddress ? 'Copied!' : 'Copy Address'}
            </button>
          </div>
          <div className="bg-gray-50 border border-gray-200 p-2 rounded text-[10px] font-mono break-all text-gray-600 italic">
            {quote.depositAddress}
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-2">
        <button
          onClick={handleConfirm}
          disabled={!isConnected || isPending}
          className="w-full py-3 bg-gray-900 text-white rounded-lg font-bold hover:bg-black transition-all shadow-lg active:scale-[0.98] disabled:opacity-50"
        >
          {isPending ? 'Confirming...' : 'Confirm and Send'}
        </button>
        <p className="text-[10px] text-center text-gray-400">
          By confirming, you agree to SideShift's terms and gas fees.
        </p>
      </div>
    </div>
  )
}