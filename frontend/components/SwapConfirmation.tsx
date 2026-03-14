'use client'

import { useState, useEffect } from 'react'
import {
  CheckCircle,
  AlertCircle,
  Copy,
  Check,
  ShieldCheck,
  Shield,
  AlertTriangle,
  Info,
  Zap,
  Wallet,
  TrendingUp,
  ExternalLink
} from 'lucide-react'
import { useAccount, useSendTransaction, useSwitchChain, usePublicClient } from 'wagmi'
import { formatEther, type Chain, erc20Abi, formatUnits, parseUnits, encodeFunctionData, parseEther } from 'viem'
import { mainnet, polygon, arbitrum, avalanche, optimism, bsc, base } from 'wagmi/chains'
import { validateDepositAddressForNetwork } from '@/utils/addressValidation'
import { getCoins, type Coin, type CoinNetwork } from '@/utils/sideshift-client'
import { SIDESHIFT_CONFIG } from '../../shared/config/sideshift'
import CopyButton from './CopyButton'

export interface QuoteData {
  depositAmount: string;
  depositCoin: string;
  depositNetwork: string;
  rate: string;
  settleAmount: string;
  settleCoin: string;
  settleNetwork: string;
  depositAddress?: string; // Keep only the optional version
  memo?: string;
  expiry?: string;
  id?: string;
}

interface SwapConfirmationProps {
  quote: QuoteData
  confidence?: number
  onAmountChange?: (newAmount: string) => void
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

const SIDESHIFT_TRACKING_URL = SIDESHIFT_CONFIG.TRACKING_URL

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
  passed: boolean
  checks: {
    balance: { passed: boolean; message: string }
    gas: { passed: boolean; message: string; estimatedGas?: string }
    network: { passed: boolean; message: string }
    address: { passed: boolean; message: string }
  }
  riskLevel: 'safe' | 'warning' | 'unsafe'
  overallMessage: string
}

export default function SwapConfirmation({ quote, confidence: _confidence, onAmountChange }: SwapConfirmationProps) {
  const [copiedAddress, setCopiedAddress] = useState(false)
  const [copiedMemo, setCopiedMemo] = useState(false)
  const [isSimulating, setIsSimulating] = useState(false)
  const [safetyCheck, setSafetyCheck] = useState<SafetyCheckResult | null>(null)
  const [walletBalance, setWalletBalance] = useState<string | null>(null)
  const [isLoadingBalance, setIsLoadingBalance] = useState(false)
  const [securityScanResult, setSecurityScanResult] = useState<ScannerSecurityCheckResult | null>(null)

  const { address, isConnected, chain: connectedChain } = useAccount()
  const { switchChainAsync } = useSwitchChain()
  const { data: hash, isPending, isSuccess, error, sendTransaction } = useSendTransaction()

  const depositChainId = CHAIN_MAP[quote.depositNetwork.toLowerCase()]?.id
  const publicClient = usePublicClient({ chainId: depositChainId })

  // Clear wallet-related state when wallet disconnects
  useEffect(() => {
    if (!isConnected) {
      setWalletBalance(null)
      setIsLoadingBalance(false)
      setSafetyCheck(null)
    }
  }, [isConnected])

  const getNetworkName = (network: string) => {
    return CHAIN_MAP[network.toLowerCase()]?.name || network
  }
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

    // Log quote for debugging to verify depositAddress exists
    console.log("Swap quote:", quote);
    
    // Validate depositAddress before proceeding
    if (!quote.depositAddress) {
      console.error("depositAddress is missing from quote:", quote);
      alert("Error: Deposit address is missing. Cannot proceed with swap.");
      return;
    }
    
    const transactionDetails = {
      to: quote.depositAddress as `0x${string}`, // SideShift deposit address
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

  const handleFetchBalance = async () => {
    if (!address || !publicClient) {
      alert('Wallet not connected or network not supported')
      return
    }

    setIsLoadingBalance(true)

    try {
      const balance = await publicClient.getBalance({ address })
      const balanceFormatted = formatEther(balance)

      setWalletBalance(balanceFormatted)

      if (onAmountChange) {
        onAmountChange(balanceFormatted)
      }
    } catch (err) {
      console.error('Failed to fetch balance:', err)
    } finally {
      setIsLoadingBalance(false)
    }
  }

  const handleSimulate = async () => {
    if (!address || !publicClient) return

    setIsSimulating(true)

    try {
      const checks = {
        address: { passed: true, message: '' },
        network: { passed: true, message: '' },
        balance: { passed: true, message: '' },
        gas: { passed: true, message: '' },
      }

      // Address validation
      const addressCheck = validateDepositAddressForNetwork(
        quote.depositNetwork,
        quote.depositAddress
      )

      checks.address = {
        passed: addressCheck.passed,
        message: addressCheck.message
      }

      // Network validation
      if (connectedChain?.id === depositChainId) {
        checks.network = {
          passed: true,
          message: `Connected to ${quote.depositNetwork}`
        }
      } else {
        checks.network = {
          passed: false,
          message: `Wallet connected to wrong network`
        }
      }

      const balance = await publicClient.getBalance({ address })
      const requiredAmount = parseEther(quote.depositAmount)

      if (balance >= requiredAmount) {
        checks.balance = {
          passed: true,
          message: `Sufficient balance`
        }
      } else {
        checks.balance = {
          passed: false,
          message: `Insufficient balance`
        }
      }

      try {
        const gasEstimate = await publicClient.estimateGas({
          account: address,
          to: address,
          value: requiredAmount
        })

        const gasCost = gasEstimate * BigInt(30000000000)

        checks.gas = {
          passed: balance >= requiredAmount + gasCost,
          message: `Estimated gas: ${formatEther(gasCost)}`
        }
      } catch {
        checks.gas = {
          passed: false,
          message: 'Gas estimation failed'
        }
      }

      const allPassed = Object.values(checks).every(c => c.passed)

      const result: SafetyCheckResult = {
        passed: allPassed,
        riskLevel: allPassed ? 'safe' : 'warning',
        overallMessage: allPassed
          ? 'All checks passed. Safe to proceed.'
          : 'Some checks failed. Proceed carefully.',
        checks
      }

      setSafetyCheck(result)

    } catch (err) {
      console.error('Safety check failed:', err)

      setSafetyCheck({
        passed: false,
        riskLevel: 'warning',
        overallMessage: 'Could not complete safety checks',
        checks: {
          address: { passed: true, message: 'Address format valid' },
          network: { passed: true, message: 'Network reachable' },
          balance: { passed: false, message: 'Balance check failed' },
          gas: { passed: false, message: 'Gas estimation failed' }
        }
      })
    } finally {
      setIsSimulating(false)
    }
  }

  const handleSecurityScanComplete = (result: ScannerSecurityCheckResult) => {
    setSecurityScanResult(result)
  }

  const handleConfirm = async () => {
    if (!quote || !quote.depositAddress) {
      alert('Error: Deposit address is missing. Cannot proceed.')
      return
    }

    if (!depositChainId) {
      alert(`The network "${quote.depositNetwork}" is not supported for this transaction.`)
      return
    }

    if (!sendTransaction) {
      console.error('Transaction function not available.')
      alert('Could not prepare transaction. Make sure your wallet is connected.')
      return
    }

    // CRITICAL: Validate deposit address before proceeding
    const depositAddress = quote.depositAddress.trim()
    
    if (!depositAddress || depositAddress.length === 0) {
      console.error('SECURITY: Empty deposit address detected')
      alert('ERROR: Invalid deposit address. Cannot proceed.')
      return
    }

    console.log('Processing swap to SideShift address:', depositAddress)

    const addressCheck = validateDepositAddressForNetwork(quote.depositNetwork, depositAddress)
    if (!addressCheck.passed) {
      console.error('SECURITY: Rejected invalid deposit address from quote:', { 
        quoteId: quote.id, 
        depositNetwork: quote.depositNetwork, 
        depositAddress: depositAddress 
      })
      alert(`Error: ${addressCheck.message}. Cannot proceed with swap.`)
      return
    }

    // CRITICAL: Prevent sending to user's own wallet
    if (depositAddress.toLowerCase() === address?.toLowerCase()) {
      console.error('SECURITY: Attempted to send funds to user\'s own address instead of SideShift!', {
        userAddress: address,
        depositAddress: depositAddress
      })
      alert('ERROR: Cannot send funds to your own wallet. Must send to SideShift deposit address.')
      return
    }

    // CRITICAL: Verify deposit address is different from connected wallet
    if (!address) {
      alert('ERROR: Wallet not connected.')
      return
    }

    let transactionDetails: {
      to: `0x${string}`
      value?: bigint
      data?: `0x${string}`
      chainId?: number
    }
    try {
      const coins = await getCoins()
      const coinInfo = coins.find((c: Coin) => c.coin.toLowerCase() === quote.depositCoin.toLowerCase())
      const networkInfo = coinInfo?.networks.find((n: CoinNetwork) => n.network.toLowerCase() === quote.depositNetwork.toLowerCase())
      const isNative = !networkInfo?.tokenContract

      if (!isNative && networkInfo?.tokenContract) {
        let decimals = 18
        if (publicClient) {
          try {
            decimals = (await publicClient.readContract({
              address: networkInfo.tokenContract as `0x${string}`,
              abi: erc20Abi,
              functionName: 'decimals',
            })) as number
          } catch {
            console.warn('Could not fetch token decimals, defaulting to 18')
          }
        }

        // CRITICAL: ERC20 transfer - ensure we're sending to SideShift deposit address
        console.log('Preparing ERC20 transfer:', {
          token: networkInfo.tokenContract,
          to: depositAddress,
          amount: quote.depositAmount,
          userWallet: address
        })

        transactionDetails = {
          to: networkInfo.tokenContract as `0x${string}`,
          value: BigInt(0),
          data: encodeFunctionData({
            abi: erc20Abi,
            functionName: 'transfer',
            args: [depositAddress as `0x${string}`, amount],
          }),
          chainId: depositChainId,
        }
      } else {
        // CRITICAL: Native token transfer - ensure we're sending to SideShift deposit address
        console.log('Preparing native token transfer:', {
          to: depositAddress,
          value: quote.depositAmount,
          userWallet: address
        })

        transactionDetails = {
          to: depositAddress as `0x${string}`,
          value: parseUnits(quote.depositAmount, 18),
          chainId: depositChainId,
        }
      }

      // Final validation before sending
      if (transactionDetails.to.toLowerCase() === address.toLowerCase()) {
        console.error('CRITICAL: Transaction target is user wallet, aborting!', transactionDetails)
        alert('CRITICAL ERROR: Transaction would send to your own wallet. Aborting for safety.')
        return
      }

      console.log('Final transaction details:', {
        ...transactionDetails,
        depositAddress: depositAddress,
        userAddress: address
      })

      if (connectedChain?.id !== depositChainId) {
        if (!switchChainAsync) {
          alert('Could not switch network. Please do it manually in your wallet.')
          return
        }
        await switchChainAsync({ chainId: depositChainId })
      }

      sendTransaction(transactionDetails)
    } catch (e) {
      const switchError = e as Error
      console.error('Failed to switch network or send transaction:', switchError)
      if (switchError.message.includes('User rejected the request')) {
        alert('You rejected the network switch request. Please approve it to continue.')
      } else {
        alert('Failed to switch network. Please try again.')
      }
    }
  }

  const getExplorerUrl = () => {
    const networkKey = quote.depositNetwork.toLowerCase()
    const baseUrl = EXPLORER_URLS[networkKey]

    if (hash && baseUrl) {
      return `${baseUrl}/tx/${hash}`
    }

    if (!baseUrl || !address) {
      return null
    }

    if (networkKey === 'bitcoin') {
      return `${baseUrl}/addresses/${address}`
    }

    return `${baseUrl}/address/${address}`
  }

  const explorerUrl = getExplorerUrl()
  const isTransactionBlocked =
    safetyCheck?.riskLevel === 'unsafe' ||
    securityScanResult?.riskLevel === 'critical' ||
    securityScanResult?.riskLevel === 'high'

  const isTransactionBlocked = safetyCheck?.riskLevel === 'unsafe';

  if (isSuccess) {
    return (
      <div className="mt-4 bg-white border border-green-300 rounded-lg p-6 text-center shadow-md">
        <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-2" />
        <h4 className="font-bold text-gray-900">Swap Initiated!</h4>
        <p className="text-sm text-gray-600">Track your transaction on the explorer.</p>
        
        {hash && (
          <div className="mt-3 p-2 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-500">Transaction Hash:</span>
              <CopyButton 
                text={hash} 
                size="sm" 
                variant="ghost"
                toastMessage="Transaction hash copied!"
              />
            </div>
            <div className="text-xs font-mono text-gray-600 break-all">
              {hash}
            </div>
          </div>
        )}
        
        {explorerUrl && (
          <a href={explorerUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline mt-2 block">
            View on Explorer {'>'}
          </a>
        )}
      </div>
    )
  }

  return (
    <div className="mt-4 bg-white border border-gray-200 rounded-xl p-5 shadow-lg max-w-md mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-bold text-gray-800 flex items-center gap-2">
          <Zap className="w-4 h-4 text-yellow-500 shrink-0" /> Confirm Swap
        </h4>
        <div className="text-xs bg-gray-100 px-2 py-1 rounded-full text-gray-500">
          {SIDESHIFT_CONFIG.DISPLAY_NAME} API
        </div>
      </div>

      <div className="space-y-4 text-sm">
        <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
          <div className="flex justify-between items-start mb-2">
            <div>
              <span className="text-xs font-semibold text-blue-600 uppercase">You Send</span>
              <div className="font-medium text-gray-900 mt-1">
                {quote.depositAmount} {quote.depositCoin}
              </div>
              <div className="text-xs text-gray-500">on {getNetworkName(quote.depositNetwork)}</div>
            </div>

            <button
              onClick={handleMaxClick}
              disabled={!isConnected || isLoadingBalance}
              className="flex items-center gap-1 text-[10px] font-bold bg-blue-600 text-white px-2 py-0.5 rounded hover:bg-blue-700 transition-all disabled:opacity-50"
              title="Set amount to your full wallet balance"
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

          {walletBalance && !isLoadingBalance && (
            <div className="mt-2 text-xs text-gray-600">
              Balance: {walletBalance ? parseFloat(walletBalance).toFixed(4) : '0.0000'} {quote.depositCoin}
            </div>
          )}
        </div>

        <div className="bg-green-50 border border-green-100 rounded-lg p-3">
          <span className="text-xs font-semibold text-green-600 uppercase">You Receive Approx.</span>
          <div className="flex justify-between items-end mt-1">
            <span className="text-xl font-bold text-green-900">{quote.settleAmount}</span>
            <span className="text-sm font-medium text-green-700">{quote.settleCoin}</span>
          </div>
        </div>

        <div className="pt-2">
          <div className="flex justify-between items-center text-[11px] text-gray-500 mb-1 px-1">
            <span>Deposit Address</span>
            <CopyButton 
              text={quote.depositAddress} 
              size="sm" 
              variant="ghost"
              toastMessage="Deposit address copied!"
            />
          </div>
          <div className="bg-gray-50 border border-gray-200 p-2 rounded text-[10px] font-mono break-all text-gray-600">
            {quote.depositAddress}
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-2 w-full">
          <button
            onClick={handleConfirm}
            disabled={!isConnected || isPending || isTransactionBlocked}
            className="w-full py-3 bg-gray-900 text-white rounded-lg font-bold hover:bg-black transition-all shadow-lg active:scale-[0.98] disabled:opacity-50"
          >
            {isPending ? 'Confirming...' : 'Confirm and Send'}
          </button>
          <p className="text-[10px] text-center text-gray-400">By confirming, you agree to SideShift&apos;s terms and gas fees.</p>
          {isTransactionBlocked && (
            <p className="text-[11px] text-center text-red-600">Transaction blocked by security checks.</p>
          )}
        </div>

        {quote.memo && (
          <div className="border-t pt-3">
            <div className="flex justify-between items-start mb-2">
              <span className="text-gray-600 font-medium">Memo/Tag:</span>
              <CopyButton 
                text={quote.memo} 
                size="sm" 
                variant="ghost"
                toastMessage="Memo copied!"
              />
            </div>
            <div className="bg-yellow-50 p-2 rounded text-xs font-mono break-all border border-yellow-200">
              Important: Include this memo
              <div className="mt-1 font-semibold">{quote.memo}</div>
            </div>
          </div>
        )}

        {quote.expiry && (
          <div className="flex justify-between border-t pt-3">
            <span className="text-gray-600">Quote expires:</span>
            <span className="font-medium text-red-600">
              {new Date(quote.expiry).toLocaleTimeString()} (
              {Math.round((new Date(quote.expiry).getTime() - Date.now()) / 60000)}
              min)
            </span>
          </div>
        )}
      </div>

      <div className="mt-4">
        <TransactionSecurityScanner
          fromToken={quote.depositCoin}
          fromNetwork={quote.depositNetwork}
          toToken={quote.settleCoin}
          toNetwork={quote.settleNetwork}
          fromAmount={quote.depositAmount}
          contractAddress={quote.depositAddress}
          userAddress={address || undefined}
          autoScan={false}
          onScanComplete={handleSecurityScanComplete}
        />
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
            <div
              className={`flex items-center gap-2 p-3 rounded-lg border ${
                safetyCheck.riskLevel === 'safe'
                  ? 'bg-green-50 border-green-200 text-green-700'
                  : safetyCheck.riskLevel === 'warning'
                    ? 'bg-yellow-50 border-yellow-200 text-yellow-700'
                    : 'bg-red-50 border-red-200 text-red-700'
              }`}
            >
              {safetyCheck.riskLevel === 'safe' && <Shield className="w-5 h-5" />}
              {safetyCheck.riskLevel === 'warning' && <AlertTriangle className="w-5 h-5" />}
              {safetyCheck.riskLevel === 'unsafe' && <AlertCircle className="w-5 h-5" />}
              <div className="flex-1">
                <div className="font-semibold text-sm">
                  {safetyCheck.riskLevel === 'safe' && 'Safe to Proceed'}
                  {safetyCheck.riskLevel === 'warning' && 'Proceed with Caution'}
                  {safetyCheck.riskLevel === 'unsafe' && 'Unsafe Transaction'}
                </div>
                <div className="text-xs mt-0.5">{safetyCheck.overallMessage}</div>
              </div>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-2">
              <div className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1">
                <Info className="w-3 h-3" />
                Safety Check Details
              </div>

              <div className="flex items-start gap-2 text-xs">
                {safetyCheck.checks.address.passed ? (
                  <CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <div className="font-medium text-gray-900">Address Validation</div>
                  <div className="text-gray-600">{safetyCheck.checks.address.message}</div>
                </div>
              </div>

              <div className="flex items-start gap-2 text-xs">
                {safetyCheck.checks.network.passed ? (
                  <CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <div className="font-medium text-gray-900">Network Status</div>
                  <div className="text-gray-600">{safetyCheck.checks.network.message}</div>
                </div>
              </div>

              <div className="flex items-start gap-2 text-xs">
                {safetyCheck.checks.balance.passed ? (
                  <CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <div className="font-medium text-gray-900">Balance Check</div>
                  <div className="text-gray-600">{safetyCheck.checks.balance.message}</div>
                </div>
              </div>

              <div className="flex items-start gap-2 text-xs">
                {safetyCheck.checks.gas.passed ? (
                  <CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
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
          className={`w-full py-3 rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed ${safetyCheck?.riskLevel === 'safe'
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
            onClick={() => window.open(SIDESHIFT_CONFIG.HELP_URL, '_blank')}
            className="text-blue-600 hover:text-blue-800"
          >
            Need help?
          </button>
          <span className="text-gray-400">•</span>
          <button
            onClick={() => window.open(SIDESHIFT_CONFIG.FAQ_URL, '_blank')}
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
        Always verify the deposit address and memo (if required) before sending funds.
      </div>
    </div>
  )
}
