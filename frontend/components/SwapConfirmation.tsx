import { useState } from 'react'
import { CheckCircle, AlertCircle, ExternalLink, Copy, Check, ShieldCheck, Shield, AlertTriangle, Info, TrendingUp, Zap } from 'lucide-react'
import { useAccount, useSendTransaction, useSwitchChain, usePublicClient } from 'wagmi' // Added usePublicClient
import { parseEther, formatEther, type Chain } from 'viem'
import { mainnet, polygon, arbitrum, avalanche, optimism, bsc, base } from 'wagmi/chains'

// --- Interface and Constants ---
interface QuoteData {
  depositAmount: string;
  depositCoin: string;
  depositNetwork: string;
  rate: string;
  settleAmount: string;
  settleCoin: string;
  settleNetwork: string;
  memo?: string;
  expiry?: string;
  id?: string;
}

interface SwapConfirmationProps {
  quote: QuoteData;
  confidence?: number;
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

const SIDESHIFT_TRACKING_URL = 'https://sideshift.ai/transactions'

// Map network names from your API to wagmi chain objects
const CHAIN_MAP: { [key: string]: Chain } = { 
  ethereum: mainnet,
  polygon: polygon,
  arbitrum: arbitrum,
  avalanche: avalanche,
  optimism: optimism,
  bsc: bsc,
  base: base,
}

// Safety Check Result Interface
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

// --- Main Component ---
export default function SwapConfirmation({ quote, confidence = 100 }: SwapConfirmationProps) {
  const [copiedAddress, setCopiedAddress] = useState(false)
  const [copiedMemo, setCopiedMemo] = useState(false)
  const [isSimulating, setIsSimulating] = useState(false);
  const [safetyCheck, setSafetyCheck] = useState<SafetyCheckResult | null>(null);
  
  const { address, isConnected, chain: connectedChain } = useAccount()
  const { data: hash, error, isPending, isSuccess, sendTransaction } = useSendTransaction()
  const { switchChainAsync } = useSwitchChain()

  // Get Chain ID for the deposit network
  const depositChainId = CHAIN_MAP[quote.depositNetwork.toLowerCase()]?.id;
  
  // Get a public client specifically for the target chain to run simulations
  const publicClient = usePublicClient({ chainId: depositChainId });

  const handleConfirm = async () => {
    if (!quote) {
        alert("Error: Deposit address is missing. Cannot proceed.");
        return;
    }

    if (!depositChainId) {
      alert(`The network "${quote.depositNetwork}" is not supported for this transaction.`);
      return;
    }

    if (!sendTransaction) {
      console.error("Transaction function not available.", error);
      alert("Could not prepare transaction. Make sure your wallet is connected.");
      return;
    }

    const transactionDetails = {
      to: address, // Note: Ideally this should be the SideShift deposit address generated from an Order
      value: parseEther(quote.depositAmount),
      chainId: depositChainId,
    };

    try {
      if (connectedChain?.id !== depositChainId) {
        if (!switchChainAsync) {
          alert("Could not switch network. Please do it manually in your wallet.");
          return;
        }
        await switchChainAsync({ chainId: depositChainId });
      }
      sendTransaction(transactionDetails);
    } catch (e) {
      const switchError = e as Error;
      console.error('Failed to switch network or send transaction:', switchError);
      if (switchError.message.includes('User rejected the request')) {
        alert('You rejected the network switch request. Please approve it to continue.');
      } else {
        alert('Failed to switch network. Please try again.');
      }
    }
  };

  const handleSimulate = async () => {
    setIsSimulating(true);
    setSafetyCheck(null);

    const checks: SafetyCheckResult['checks'] = {
      balance: { passed: false, message: '' },
      gas: { passed: false, message: '' },
      network: { passed: false, message: '' },
      address: { passed: false, message: '' }
    };

    try {
        if (!address) throw new Error("Wallet not connected");

        // 1. Address Validation Check
        if (address && address.startsWith('0x') && address.length === 42) {
          checks.address = { passed: true, message: 'Valid Ethereum address format' };
        } else {
          checks.address = { passed: false, message: 'Invalid address format' };
        }

        // 2. Check if chain is supported for simulation
        if (!depositChainId || !publicClient) {
            // Fallback for non-EVM chains (e.g. Bitcoin) where we can't easily simulate via wagmi
            console.log("Skipping detailed simulation for non-EVM chain");
            checks.network = { passed: true, message: 'Non-EVM chain (limited validation)' };
            checks.balance = { passed: true, message: 'Cannot verify balance on non-EVM chain' };
            checks.gas = { passed: true, message: 'Gas estimation not available' };
            
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const result: SafetyCheckResult = {
              passed: true,
              checks,
              riskLevel: 'warning',
              overallMessage: 'Limited safety checks for non-EVM chain'
            };
            setSafetyCheck(result);
            return;
        }

        // 3. Network Check
        if (connectedChain?.id === depositChainId) {
          checks.network = { passed: true, message: `Connected to ${getNetworkName(quote.depositNetwork)}` };
        } else {
          checks.network = { passed: false, message: `Need to switch to ${getNetworkName(quote.depositNetwork)}` };
        }

        // 4. Balance Check
        const balance = await publicClient.getBalance({ address });
        const requiredAmount = parseEther(quote.depositAmount);
        
        if (balance >= requiredAmount) {
          checks.balance = { 
            passed: true, 
            message: `Sufficient balance: ${formatEther(balance).substring(0, 8)} ${quote.depositCoin}` 
          };
        } else {
          checks.balance = { 
            passed: false, 
            message: `Insufficient balance. Need ${quote.depositAmount} ${quote.depositCoin}, have ${formatEther(balance).substring(0, 8)}` 
          };
        }

        // 5. Gas Estimation Check
        try {
          const gasEstimate = await publicClient.estimateGas({
              account: address,
              to: address, 
              value: requiredAmount
          });
          
          const gasPrice = await publicClient.getGasPrice();
          const estimatedGasCost = gasEstimate * gasPrice;
          const totalCost = requiredAmount + estimatedGasCost;
          
          if (balance >= totalCost) {
            checks.gas = { 
              passed: true, 
              message: `Gas estimated: ~${formatEther(estimatedGasCost).substring(0, 8)} ${quote.depositCoin}`,
              estimatedGas: formatEther(estimatedGasCost).substring(0, 8)
            };
          } else {
            checks.gas = { 
              passed: false, 
              message: `Insufficient funds for gas. Need ${formatEther(totalCost).substring(0, 8)} total`,
              estimatedGas: formatEther(estimatedGasCost).substring(0, 8)
            };
          }
        } catch {
          checks.gas = { 
            passed: false, 
            message: 'Gas estimation failed - transaction may fail' 
          };
        }

        // Add a small delay so the user sees the checking state
        await new Promise(resolve => setTimeout(resolve, 800));

        // Determine overall risk level
        const allPassed = Object.values(checks).every(check => check.passed);
        const criticalFailed = !checks.balance.passed || !checks.gas.passed;
        
        let riskLevel: 'safe' | 'warning' | 'unsafe';
        let overallMessage: string;
        
        if (allPassed) {
          riskLevel = 'safe';
          overallMessage = 'All safety checks passed. Transaction should succeed.';
        } else if (criticalFailed) {
          riskLevel = 'unsafe';
          overallMessage = 'Critical issues detected. Transaction will likely fail.';
        } else {
          riskLevel = 'warning';
          overallMessage = 'Some checks failed. Proceed with caution.';
        }

        const result: SafetyCheckResult = {
          passed: allPassed,
          checks,
          riskLevel,
          overallMessage
        };

        setSafetyCheck(result);

    } catch (error: unknown) {
        console.error("Simulation failed:", error);
        const errorObj = error as Error;
        const msg = errorObj.message || "Transaction likely to fail";
        
        checks.balance = { passed: false, message: 'Could not verify balance' };
        checks.gas = { passed: false, message: 'Gas estimation failed' };
        
        const result: SafetyCheckResult = {
          passed: false,
          checks,
          riskLevel: 'unsafe',
          overallMessage: `Simulation error: ${msg}`
        };
        
        setSafetyCheck(result);
    } finally {
        setIsSimulating(false);
    }
  };

  const copyToClipboard = async (text: string, type: 'address' | 'memo') => {
    try {
      await navigator.clipboard.writeText(text)
      if (type === 'address') {
        setCopiedAddress(true)
        setTimeout(() => setCopiedAddress(false), 2000)
      } else {
        setCopiedMemo(true)
        setTimeout(() => setCopiedMemo(false), 2000)
      }
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const getExplorerUrl = () => {
    const networkKey = quote.depositNetwork.toLowerCase();
    const baseUrl = EXPLORER_URLS[networkKey];

    if (hash && baseUrl) {
        return `${baseUrl}/tx/${hash}`;
    }
    if (quote.id) {
      return `${SIDESHIFT_TRACKING_URL}/${address}`
    }
    if (baseUrl) {
      if (networkKey === 'bitcoin') {
        return `${baseUrl}/addresses/${address}`
      }
      return `${baseUrl}/address/${address}`
    }
    return null
  }
  
  const getNetworkName = (network: string) => {
    return CHAIN_MAP[network.toLowerCase()]?.name || network;
  }

  const explorerUrl = getExplorerUrl()
  
  if (isSuccess) {
    return (
      <div className="mt-4 bg-white border border-green-300 rounded-lg p-6 shadow-sm text-center">
        <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
        <h4 className="font-semibold text-lg text-gray-900">Transaction Sent!</h4>
        <p className="text-gray-600 text-sm mt-1">Your swap is processing. You can track its status on the explorer.</p>
        {explorerUrl && (
          <button
            onClick={() => window.open(explorerUrl, '_blank', 'noopener,noreferrer')}
            className="w-full mt-4 flex items-center justify-center gap-2 py-2 text-gray-600 hover:text-gray-800 transition-colors text-sm border border-gray-300 rounded-lg hover:border-gray-400"
          >
            Track on Explorer <ExternalLink className="w-3 h-3" />
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="mt-4 bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-semibold text-gray-900">Swap Details</h4>
        {confidence && confidence >= 90 ? (
          <CheckCircle className="w-5 h-5 text-green-500" />
        ) : (
          <AlertCircle className="w-5 h-5 text-yellow-500" />
        )}
      </div>

      <div className="space-y-3 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-600">You send:</span>
          <span className="font-medium text-gray-900">{quote.depositAmount} {quote.depositCoin} on {getNetworkName(quote.depositNetwork)}</span>
        </div>
        <div className="border-t pt-3">
          <div className="flex justify-between">
            <span className="text-gray-600">You receive approx:</span>
            <span className="font-medium text-gray-900">{quote.settleAmount} {quote.settleCoin}</span>
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-gray-600">At your address:</span>
            <span className="font-mono text-xs bg-gray-100 text-gray-800 px-1 py-0.5 rounded">
              {isConnected && address ? `${address.substring(0, 6)}...${address.substring(address.length - 4)}` : 'Wallet not connected'}
            </span>
          </div>
        </div>

        <div className="border-t pt-3 mt-3">
          <div className="flex justify-between items-start mb-2">
            <span className="text-gray-600 font-medium">Send funds to this address:</span>
            <button
              onClick={() => copyToClipboard(address as string, 'address')}
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
            >
              {copiedAddress ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {copiedAddress ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <div className="bg-gray-500 p-2 rounded text-xs font-mono break-all">
            {address}
          </div>
        </div>

        {quote.memo && (
          <div className="border-t pt-3">
            <div className="flex justify-between items-start mb-2">
              <span className="text-gray-600 font-medium">Memo/Tag:</span>
              <button
                onClick={() => copyToClipboard(quote.memo!, 'memo')}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
              >
                {copiedMemo ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                {copiedMemo ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <div className="bg-yellow-50 p-2 rounded text-xs font-mono break-all border border-yellow-200">
              ⚠️ Important: Include this memo
              <div className="mt-1 font-semibold">{quote.memo}</div>
            </div>
          </div>
        )}

        {quote.expiry && (
          <div className="flex justify-between border-t pt-3">
            <span className="text-gray-600">Quote expires:</span>
            <span className="font-medium text-red-600">
              {new Date(quote.expiry).toLocaleTimeString()} ({Math.round((new Date(quote.expiry).getTime() - Date.now()) / 60000)}min)
            </span>
          </div>
        )}
      </div>

      <div className="mt-3 mb-3">
         {!safetyCheck ? (
             <button 
                onClick={handleSimulate}
                disabled={isSimulating}
                className="w-full flex items-center justify-center gap-2 py-3 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors disabled:opacity-50"
             >
                {isSimulating ? (
                    <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-700 border-t-transparent"></div>
                        <span>Running Safety Checks...</span>
                    </>
                ) : (
                    <>
                        <ShieldCheck className="w-4 h-4" />
                        Run Safety Simulation
                    </>
                )}
             </button>
         ) : (
             <div className="space-y-3">
                 {/* Overall Status Banner */}
                 <div className={`flex items-center gap-2 p-3 rounded-lg border ${
                   safetyCheck.riskLevel === 'safe' 
                     ? 'bg-green-50 border-green-200 text-green-700' 
                     : safetyCheck.riskLevel === 'warning'
                     ? 'bg-yellow-50 border-yellow-200 text-yellow-700'
                     : 'bg-red-50 border-red-200 text-red-700'
                 }`}>
                     {safetyCheck.riskLevel === 'safe' && <Shield className="w-5 h-5" />}
                     {safetyCheck.riskLevel === 'warning' && <AlertTriangle className="w-5 h-5" />}
                     {safetyCheck.riskLevel === 'unsafe' && <AlertCircle className="w-5 h-5" />}
                     <div className="flex-1">
                         <div className="font-semibold text-sm">
                             {safetyCheck.riskLevel === 'safe' && '✅ Safe to Proceed'}
                             {safetyCheck.riskLevel === 'warning' && '⚠️ Proceed with Caution'}
                             {safetyCheck.riskLevel === 'unsafe' && '❌ Unsafe Transaction'}
                         </div>
                         <div className="text-xs mt-0.5">{safetyCheck.overallMessage}</div>
                     </div>
                 </div>

                 {/* Detailed Checks */}
                 <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-2">
                     <div className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1">
                         <Info className="w-3 h-3" />
                         Safety Check Details
                     </div>
                     
                     {/* Address Check */}
                     <div className="flex items-start gap-2 text-xs">
                         {safetyCheck.checks.address.passed ? (
                             <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                         ) : (
                             <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                         )}
                         <div className="flex-1">
                             <div className="font-medium text-gray-900">Address Validation</div>
                             <div className="text-gray-600">{safetyCheck.checks.address.message}</div>
                         </div>
                     </div>

                     {/* Network Check */}
                     <div className="flex items-start gap-2 text-xs">
                         {safetyCheck.checks.network.passed ? (
                             <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                         ) : (
                             <AlertCircle className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                         )}
                         <div className="flex-1">
                             <div className="font-medium text-gray-900">Network Status</div>
                             <div className="text-gray-600">{safetyCheck.checks.network.message}</div>
                         </div>
                     </div>

                     {/* Balance Check */}
                     <div className="flex items-start gap-2 text-xs">
                         {safetyCheck.checks.balance.passed ? (
                             <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                         ) : (
                             <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                         )}
                         <div className="flex-1">
                             <div className="font-medium text-gray-900">Balance Check</div>
                             <div className="text-gray-600">{safetyCheck.checks.balance.message}</div>
                         </div>
                     </div>

                     {/* Gas Check */}
                     <div className="flex items-start gap-2 text-xs">
                         {safetyCheck.checks.gas.passed ? (
                             <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                         ) : (
                             <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                         )}
                         <div className="flex-1">
                             <div className="font-medium text-gray-900 flex items-center gap-1">
                                 <Zap className="w-3 h-3" />
                                 Gas Estimation
                             </div>
                             <div className="text-gray-600">{safetyCheck.checks.gas.message}</div>
                         </div>
                     </div>
                 </div>

                 {/* Re-run button */}
                 <button 
                    onClick={handleSimulate}
                    disabled={isSimulating}
                    className="w-full flex items-center justify-center gap-2 py-2 text-gray-600 hover:text-gray-800 transition-colors text-xs border border-gray-300 rounded-lg hover:border-gray-400"
                 >
                    <TrendingUp className="w-3 h-3" />
                    Re-run Safety Check
                 </button>
             </div>
         )}
      </div>

      <div className="mt-4 space-y-2">
        <button
          onClick={handleConfirm}
          disabled={!isConnected || isPending || !address || (safetyCheck?.riskLevel === 'unsafe') || false} 
          className={`w-full py-3 rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
            safetyCheck?.riskLevel === 'safe' 
              ? 'bg-gradient-to-r from-green-500 to-green-600 text-white hover:from-green-600 hover:to-green-700'
              : safetyCheck?.riskLevel === 'warning'
              ? 'bg-gradient-to-r from-yellow-500 to-yellow-600 text-white hover:from-yellow-600 hover:to-yellow-700'
              : 'bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700'
          }`}
        >
          {isPending ? 'Check Your Wallet...' : safetyCheck?.riskLevel === 'unsafe' ? 'Transaction Blocked (Unsafe)' : 'Confirm and Send'}
        </button>

        {explorerUrl && !isSuccess && (
          <button
            onClick={() => window.open(explorerUrl, '_blank', 'noopener,noreferrer')}
            className="w-full flex items-center justify-center gap-2 py-2 text-gray-600 hover:text-gray-800 transition-colors text-sm border border-gray-300 rounded-lg hover:border-gray-400"
          >
            View Deposit Address <ExternalLink className="w-3 h-3" />
          </button>
        )}

        <div className="flex gap-2 text-xs">
          <button
            onClick={() => window.open('https://help.sideshift.ai/en/', '_blank')}
            className="text-blue-600 hover:text-blue-800"
          >
            Need help?
          </button>
          <span className="text-gray-400">•</span>
          <button
            onClick={() => window.open('https://docs.sideshift.ai/faq/', '_blank')}
            className="text-blue-600 hover:text-blue-800"
          >
            FAQ
          </button>
        </div>
      </div>

      {error && (
          <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
              Transaction Error: {error.message}
          </div>
      )}

      <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
        💡 Always verify the deposit address and memo (if required) before sending funds.
      </div>
    </div>
  )
}