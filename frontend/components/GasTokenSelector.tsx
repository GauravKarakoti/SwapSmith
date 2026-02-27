'use client';

import { useState, useEffect } from 'react';
import { Coins, Check, Info, ChevronDown } from 'lucide-react';

interface GasToken {
  symbol: string;
  name: string;
  contractAddress: string;
  chain: string;
  network: string;
  decimals: number;
  tokenType: string;
  discountPercent: number;
  isActive: boolean;
  balance?: string;
}

interface GasTokenSelectorProps {
  chain: string;
  userId?: string;
  selectedToken?: string;
  onSelect: (token: GasToken | null) => void;
  showSavings?: boolean;
  estimatedGas?: number;
  disabled?: boolean;
  className?: string;
}

export default function GasTokenSelector({
  chain,
  userId,
  selectedToken,
  onSelect,
  showSavings = true,
  estimatedGas = 21000,
  disabled = false,
  className = '',
}: GasTokenSelectorProps) {
  const [tokens, setTokens] = useState<GasToken[]>([]);
  const [preferences, setPreferences] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [savings, setSavings] = useState<{ saved: number; percent: number; tokenCost?: number } | null>(null);

  useEffect(() => {
    fetchTokens();
  }, [chain, userId]);

  useEffect(() => {
    if (selectedToken && estimatedGas) {
      calculateSavings(selectedToken, estimatedGas);
    }
  }, [selectedToken, estimatedGas]);

  const fetchTokens = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        chain,
        ...(userId && { userId }),
      });

      const response = await fetch(`/api/gas-tokens?${params}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch gas tokens');
      }

      setTokens(data.availableTokens || []);
      setPreferences(data.preferences);

      // Auto-select recommended token if none selected
      if (!selectedToken && data.recommendedToken) {
        onSelect(data.recommendedToken);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch tokens');
    } finally {
      setLoading(false);
    }
  };

  const calculateSavings = async (tokenSymbol: string, gasAmount: number) => {
    try {
      const response = await fetch('/api/gas-tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: 'calculate-savings',
          tokenSymbol,
          gasAmount,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setSavings(data.savings);
      }
    } catch (err) {
      console.error('Error calculating savings:', err);
    }
  };

  const handleSelect = (token: GasToken | null) => {
    onSelect(token);
    setIsOpen(false);
    if (token && estimatedGas) {
      calculateSavings(token.symbol, estimatedGas);
    } else {
      setSavings(null);
    }
  };

  const getSelectedToken = () => {
    return tokens.find(t => t.symbol === selectedToken) || null;
  };

  const formatSavings = () => {
    if (!savings) return null;
    return `${savings.percent.toFixed(1)}% (${savings.saved.toFixed(4)} ETH)`;
  };

  if (loading) {
    return (
      <div className={`bg-white/5 border border-white/10 rounded-xl p-4 ${className}`}>
        <div className="animate-pulse flex items-center gap-3">
          <div className="w-8 h-8 bg-white/10 rounded-lg" />
          <div className="flex-1">
            <div className="h-4 bg-white/10 rounded w-32" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-red-500/10 border border-red-500/20 rounded-xl p-4 ${className}`}>
        <p className="text-sm text-red-400">{error}</p>
      </div>
    );
  }

  if (tokens.length === 0) {
    return (
      <div className={`bg-white/5 border border-white/10 rounded-xl p-4 ${className}`}>
        <div className="flex items-center gap-2 text-gray-400">
          <Info className="w-4 h-4" />
          <span className="text-sm">No gas tokens available for {chain}</span>
        </div>
      </div>
    );
  }

  const selected = getSelectedToken();

  return (
    <div className={`bg-white/5 border border-white/10 rounded-xl p-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <div className="p-2 bg-purple-500/10 rounded-lg">
          <Coins className="w-5 h-5 text-purple-400" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white">Gas Token</h3>
          <p className="text-xs text-gray-400">Reduce transaction costs</p>
        </div>
      </div>

      {/* Selector */}
      <div className="relative">
        <button
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          className={`w-full flex items-center justify-between p-3 bg-white/5 border border-white/10 rounded-lg transition-colors ${
            disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-white/10'
          }`}
        >
          <div className="flex items-center gap-3">
            {selected ? (
              <>
                <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                  {selected.symbol.slice(0, 2)}
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium text-white">{selected.name}</p>
                  <p className="text-xs text-green-400">{selected.discountPercent}% discount</p>
                </div>
              </>
            ) : (
              <span className="text-sm text-gray-400">Select a gas token</span>
            )}
          </div>
          <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {/* Dropdown */}
        {isOpen && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-[#1a1d21] border border-white/10 rounded-lg shadow-xl z-50 max-h-60 overflow-y-auto">
            {/* No Token Option */}
            <button
              onClick={() => handleSelect(null)}
              className="w-full flex items-center gap-3 p-3 hover:bg-white/5 transition-colors border-b border-white/5"
            >
              <div className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center">
                <span className="text-gray-400 text-xs">None</span>
              </div>
              <div className="text-left">
                <p className="text-sm font-medium text-white">No Gas Token</p>
                <p className="text-xs text-gray-400">Pay standard gas fees</p>
              </div>
              {!selected && <Check className="w-4 h-4 text-green-400 ml-auto" />}
            </button>

            {/* Token Options */}
            {tokens.map((token) => (
              <button
                key={token.symbol}
                onClick={() => handleSelect(token)}
                className="w-full flex items-center gap-3 p-3 hover:bg-white/5 transition-colors border-b border-white/5 last:border-0"
              >
                <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                  {token.symbol.slice(0, 2)}
                </div>
                <div className="text-left flex-1">
                  <p className="text-sm font-medium text-white">{token.name}</p>
                  <p className="text-xs text-green-400">{token.discountPercent}% discount</p>
                </div>
                {selected?.symbol === token.symbol && (
                  <Check className="w-4 h-4 text-green-400" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Savings Display */}
      {showSavings && savings && selected && (
        <div className="mt-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-400">Estimated Savings</span>
            <span className="text-sm font-bold text-green-400">{formatSavings()}</span>
          </div>
          {savings.tokenCost && (
            <p className="text-xs text-gray-500 mt-1">
              Token cost: ~{savings.tokenCost.toFixed(4)} ETH
            </p>
          )}
        </div>
      )}

      {/* Info */}
      <div className="mt-4 flex items-start gap-2">
        <Info className="w-4 h-4 text-gray-500 mt-0.5" />
        <p className="text-xs text-gray-500">
          Gas tokens can reduce your transaction costs by up to 50%. 
          The token is automatically minted/burned during your transaction.
        </p>
      </div>

      {/* Auto-optimize toggle */}
      {preferences && (
        <div className="mt-4 pt-4 border-t border-white/10">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={preferences.autoOptimize}
              onChange={async (e) => {
                const newValue = e.target.checked;
                try {
                  await fetch('/api/gas-tokens', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      userId,
                      preferences: { autoOptimize: newValue },
                    }),
                  });
                  setPreferences({ ...preferences, autoOptimize: newValue });
                } catch (err) {
                  console.error('Error updating preferences:', err);
                }
              }}
              className="w-4 h-4 rounded border-white/20 bg-white/5 text-blue-500 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-300">Auto-optimize gas for all transactions</span>
          </label>
        </div>
      )}
    </div>
  );
}
