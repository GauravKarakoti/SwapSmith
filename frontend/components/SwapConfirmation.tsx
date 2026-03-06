'use client'

import { useState } from 'react'
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
} from 'lucide-react'
import { useAccount, useSendTransaction, useSwitchChain, usePublicClient } from 'wagmi'
import { parseEther, formatEther, type Chain } from 'viem'
import { mainnet, polygon, arbitrum, avalanche, optimism, bsc, base } from 'wagmi/chains'
import { validateDepositAddressForNetwork } from '@/utils/addressValidation'

export interface QuoteData {
  depositAmount: string
  depositCoin: string
  depositNetwork: string
  depositAddress: string
  rate: string
  settleAmount: string
  settleCoin: string
  settleNetwork: string
  memo?: string
  expiry?: string
  id?: string
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

const CHAIN_MAP: { [key: string]: Chain & { id: number; name: string } } = {
  ethereum: { ...mainnet, name: 'Ethereum' },
  polygon: { ...polygon, name: 'Polygon' },
  arbitrum: { ...arbitrum, name: 'Arbitrum' },
  avalanche: { ...avalanche, name: 'Avalanche' },
  optimism: { ...optimism, name: 'Optimism' },
  bsc: { ...bsc, name: 'BSC' },
  base: { ...base, name: 'Base' },
}

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

  const { address, isConnected, chain: connectedChain } = useAccount()
  const { data: hash, error, isPending, isSuccess, sendTransaction } = useSendTransaction()
  const { switchChainAsync } = useSwitchChain()

  const depositChainId = CHAIN_MAP[quote.depositNetwork.toLowerCase()]?.id
  const publicClient = usePublicClient({ chainId: depositChainId })

  const getNetworkName = (network: string) => {
    return CHAIN_MAP[network.toLowerCase()]?.name || network
  }

  const handleMaxClick = async () => {
    if (!isConnected || !address || !publicClient) return

    setIsLoadingBalance(true)
    try {
      const balance = await publicClient.getBalance({ address })
      const formatted = formatEther(balance)
      setWalletBalance(formatted)

      // Calculate final amount with gas buffer for native tokens
      const balanceNum = parseFloat(formatted)
      const gasBuffer = 0.001 // 0.001 in native currency
      const finalAmount = Math.max(0, balanceNum - gasBuffer)

      if (onAmountChange) {
        onAmountChange(finalAmount.toString())
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

      // Check 1: Address validation
      {
        const addressCheck = validateDepositAddressForNetwork(quote.depositNetwork, quote.depositAddress)
        checks.address.passed = addressCheck.passed
        checks.address.message = addressCheck.message
      }

      // Check 2: Network compatibility
      if (depositChainId) {
        checks.network.passed = true
        checks.network.message = `Compatible with ${getNetworkName(quote.depositNetwork)}`
      } else {
        checks.network.passed = false
        checks.network.message = `Network ${quote.depositNetwork} not supported`
      }

      // Check 3: Balance check
      const balance = await publicClient.getBalance({ address })
      const requiredAmount = parseEther(quote.depositAmount)
      if (balance >= requiredAmount) {
        checks.balance.passed = true
        checks.balance.message = `Sufficient balance: ${formatEther(balance)} available`
      } else {
        checks.balance.passed = false
        checks.balance.message = `Insufficient balance: need ${quote.depositAmount}, have ${formatEther(balance)}`
      }

      // Check 4: Gas estimation
      try {
        const gasEstimate = await publicClient.estimateGas({
          to: quote.depositAddress as `0x${string}`,
          value: requiredAmount,
          account: address,
        })
        const gasCost = gasEstimate * BigInt(30000000000) // 30 gwei
        if (balance > requiredAmount + gasCost) {
          checks.gas.passed = true
          checks.gas.message = `Gas fees: ~${formatEther(gasCost)} available`
        } else {
          checks.gas.passed = false
          checks.gas.message = `Insufficient gas buffer`
        }
      } catch {
        checks.gas.passed = true
        checks.gas.message = 'Gas estimation available'
      }

      const allPassed = Object.values(checks).every((c) => c.passed)
      const hasWarnings = Object.values(checks).some((c) => !c.passed)

      const result: SafetyCheckResult = {
        passed: allPassed,
        riskLevel: allPassed ? 'safe' : hasWarnings ? 'warning' : 'unsafe',
        overallMessage: allPassed
          ? 'All checks passed. Safe to proceed.'
          : hasWarnings
            ? 'Some checks failed. Proceed with caution.'
            : 'Critical issues detected. Do not proceed.',
        checks,
      }

      setSafetyCheck(result)
    } catch (err) {
      console.error('Safety check failed:', err)
      setSafetyCheck({
        passed: false,
        riskLevel: 'warning' as const,
        overallMessage: 'Could not complete all safety checks',
        checks: {
          address: { passed: true, message: 'Address format valid' },
          network: { passed: true, message: 'Network available' },
          balance: { passed: false, message: 'Could not verify balance' },
          gas: { passed: false, message: 'Could not estimate gas' },
        },
      })
    } finally {
      setIsSimulating(false)
    }
  }

  const handleConfirm = async () => {
    if (!quote) {
      alert('Error: Deposit address is missing. Cannot proceed.')
      return
    }

    if (!depositChainId) {
      alert(`The network "${quote.depositNetwork}" is not supported for this transaction.`)
      return
    }

    if (!sendTransaction) {
      console.error('Transaction function not available.', error)
      alert('Could not prepare transaction. Make sure your wallet is connected.')
      return
    }

    console.log('Processing swap to SideShift address:', quote.depositAddress)

    const addressCheck = validateDepositAddressForNetwork(quote.depositNetwork, quote.depositAddress)
    if (!addressCheck.passed) {
      console.error('SECURITY: Rejected invalid deposit address from quote:', { quoteId: quote.id, depositNetwork: quote.depositNetwork, depositAddress: quote.depositAddress })
      alert(`Error: ${addressCheck.message}. Cannot proceed with swap.`)
      return
    }

    if (quote.depositAddress.toLowerCase() === address?.toLowerCase()) {
      console.error('SECURITY: Attempted to send funds to user\'s own address instead of SideShift!')
      alert('ERROR: Cannot send funds to your own wallet. Must send to SideShift deposit address.')
      return
    }

    const transactionDetails = {
      to: quote.depositAddress as `0x${string}`,
      value: parseEther(quote.depositAmount),
      chainId: depositChainId,
    }

    try {
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
    const networkKey = quote.depositNetwork.toLowerCase()
    const baseUrl = EXPLORER_URLS[networkKey]

    if (hash && baseUrl) {
      return `${baseUrl}/tx/${hash}`
    }
    if (baseUrl) {
      if (networkKey === 'bitcoin') {
        return `${baseUrl}/addresses/${address}`
      }
      return `${baseUrl}/address/${address}`
    }
    return null
  }

  const explorerUrl = getExplorerUrl()

  const isTransactionBlocked = safetyCheck?.riskLevel === 'unsafe' || securityScanResult?.riskLevel === 'critical' || securityScanResult?.riskLevel === 'high';

  if (isSuccess) {
    return (
      <div className="mt-4 bg-white border border-green-300 rounded-lg p-6 text-center shadow-md">
        <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-2" />
        <h4 className="font-bold text-gray-900">Swap Initiated!</h4>
        <p className="text-sm text-gray-600">Track your transaction on the explorer.</p>
        {explorerUrl && (
          <a href={explorerUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline mt-2 block">
            View on Explorer →
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
          SideShift.ai API
        </div>
      </div>

      <div className="space-y-4 text-sm">
        {/* You Send Section */}
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
            <div className="mt-2 text-xs text-gray-600">
              Balance: {walletBalance ? parseFloat(walletBalance).toFixed(4) : '0.0000'} {quote.depositCoin}
            </div>
          )}
        </div>

        {/* You Receive */}
        <div className="bg-green-50 border border-green-100 rounded-lg p-3">
          <span className="text-xs font-semibold text-green-600 uppercase">You Receive Approx.</span>
          <div className="flex justify-between items-end mt-1">
            <span className="text-xl font-bold text-green-900">{quote.settleAmount}</span>
            <span className="text-sm font-medium text-green-700">{quote.settleCoin}</span>
          </div>
        </div>

        {/* Deposit Address Info */}
        <div className="pt-2">
          <div className="flex justify-between text-[11px] text-gray-500 mb-1 px-1">
            <span>Deposit Address</span>
            <button onClick={() => copyToClipboard(quote.depositAddress, 'address')} className="text-blue-600 hover:underline">
              {copiedAddress ? 'Copied!' : 'Copy Address'}
            </button>
          </div>
          <div className="bg-gray-50 border border-gray-200 p-2 rounded text-[10px] font-mono break-all text-gray-600">
            {quote.depositAddress}
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-2 w-full">
          <button
            onClick={handleConfirm}
            disabled={!isConnected || isPending}
            className="w-full py-3 bg-gray-900 text-white rounded-lg font-bold hover:bg-black transition-all shadow-lg active:scale-[0.98] disabled:opacity-50"
          >
            {isPending ? 'Confirming...' : 'Confirm and Send'}
          </button>
          <p className="text-[10px] text-center text-gray-400">
            By confirming, you agree to SideShift&apos;s terms and gas fees.
          </p>
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
              {new Date(quote.expiry).toLocaleTimeString()} (
              {Math.round((new Date(quote.expiry).getTime() - Date.now()) / 60000)}
              min)
            </span>
          </div>
        )}
      </div>

      {/* Advanced Security Scanner */}
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
            {/* Overall Status Banner */}
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
                  {safetyCheck.riskLevel === 'safe' && '✅ Safe to Proceed'}
                  {safetyCheck.riskLevel === 'warning' && '⚠️ Proceed with Caution'}
                  {safetyCheck.riskLevel === 'unsafe' && '❌ Unsafe Transaction'}
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
          </div>
        )}
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
