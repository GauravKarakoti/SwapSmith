/**
 * Bridge Comparison Component
 * Displays and compares quotes from multiple bridge protocols
 */

import { useState } from 'react';
import { 
  Clock, 
  Zap, 
  Shield, 
  ChevronDown, 
  CheckCircle, 
  AlertCircle,
  Loader2,
  Info,
  TrendingUp,
  DollarSign,
  CloudLightning
} from 'lucide-react';

interface BridgeQuote {
  bridge: string;
  displayName: string;
  fromChain: string;
  toChain: string;
  fromToken: string;
  toToken: string;
  fromAmount: string;
  toAmount: string;
  rate: string;
  gasFee: string;
  bridgeFee: string;
  totalFee: string;
  estimatedTime: {
    min: number;
    max: number;
  };
  instant: boolean;
  confidence: number;
  depositAddress?: string;
}

interface BridgeComparisonProps {
  quotes: BridgeQuote[];
  recommendedQuote?: BridgeQuote;
  isLoading?: boolean;
  error?: string | null;
  onSelectBridge?: (quote: BridgeQuote) => void;
  selectedBridge?: string;
  showDetails?: boolean;
  compact?: boolean;
}

type SortOption = 'output' | 'fee' | 'time' | 'reliability';
type FilterOption = 'all' | 'instant' | 'reliable';

export default function BridgeComparison({
  quotes,
  recommendedQuote,
  isLoading = false,
  error,
  onSelectBridge,
  selectedBridge,
  showDetails = true,
  compact = false,
}: BridgeComparisonProps) {
  const [sortBy, setSortBy] = useState<SortOption>('output');
  const [filterBy, setFilterBy] = useState<FilterOption>('all');
  const [expandedBridge, setExpandedBridge] = useState<string | null>(null);

  // Filter and sort quotes
  const filteredQuotes = quotes
    .filter(q => {
      if (filterBy === 'instant') return q.instant;
      if (filterBy === 'reliable') return q.confidence >= 90;
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'output':
          return Number(b.toAmount) - Number(a.toAmount);
        case 'fee':
          return Number(a.totalFee || '0') - Number(b.totalFee || '0');
        case 'time':
          return (a.estimatedTime?.max || 60) - (b.estimatedTime?.max || 60);
        case 'reliability':
          return b.confidence - a.confidence;
        default:
          return 0;
      }
    });

  // Get best values for highlighting
  const bestOutput = Math.max(...quotes.map(q => Number(q.toAmount)));
  const bestTime = Math.min(...quotes.map(q => q.estimatedTime?.max || 60));
  const bestReliability = Math.max(...quotes.map(q => q.confidence));

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-center gap-3 py-8">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          <span className="text-gray-600 dark:text-gray-400">Loading bridge quotes...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-red-200 dark:border-red-800 p-6">
        <div className="flex items-center gap-3 text-red-600">
          <AlertCircle className="w-5 h-5" />
          <span>Error loading quotes: {error}</span>
        </div>
      </div>
    );
  }

  if (quotes.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center gap-3 text-gray-500">
          <Info className="w-5 h-5" />
          <span>No bridge quotes available for this route</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h3 className="font-semibold text-gray-900 dark:text-white">
            Bridge Comparison
            <span className="ml-2 text-sm font-normal text-gray-500">
              ({filteredQuotes.length} routes)
            </span>
          </h3>
          
          <div className="flex gap-2">
            {/* Filter */}
            <select
              value={filterBy}
              onChange={(e) => setFilterBy(e.target.value as FilterOption)}
              className="text-sm border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              <option value="all">All Routes</option>
              <option value="instant">Instant</option>
              <option value="reliable">High Reliability</option>
            </select>

            {/* Sort */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="text-sm border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              <option value="output">Best Output</option>
              <option value="fee">Lowest Fee</option>
              <option value="time">Fastest</option>
              <option value="reliability">Most Reliable</option>
            </select>
          </div>
        </div>
      </div>

      {/* Quote List */}
      <div className="divide-y divide-gray-200 dark:divide-gray-700">
        {filteredQuotes.map((quote) => {
          const isRecommended = recommendedQuote?.bridge === quote.bridge;
          const isSelected = selectedBridge === quote.bridge;
          const isExpanded = expandedBridge === quote.bridge;
          
          return (
            <div
              key={quote.bridge}
              className={`transition-colors ${
                isSelected 
                  ? 'bg-blue-50 dark:bg-blue-900/20' 
                  : isRecommended 
                    ? 'bg-green-50 dark:bg-green-900/20'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
              }`}
            >
              {/* Main Row */}
              <div 
                className="p-4 cursor-pointer"
                onClick={() => setExpandedBridge(isExpanded ? null : quote.bridge)}
              >
                <div className="flex items-center justify-between gap-4">
                  {/* Bridge Info */}
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                      isRecommended 
                        ? 'bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                    }`}>
                      {quote.displayName.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 dark:text-white">
                          {quote.displayName}
                        </span>
                        {isRecommended && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300">
                            <CheckCircle className="w-3 h-3" />
                            Recommended
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {quote.fromChain} → {quote.toChain}
                      </div>
                    </div>
                  </div>

                  {/* Output Amount */}
                  <div className="text-right">
                    <div className="font-semibold text-gray-900 dark:text-white">
                      {Number(quote.toAmount).toFixed(6)} {quote.toToken}
                    </div>
                    {Number(quote.toAmount) === bestOutput && (
                      <div className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1 justify-end">
                        <TrendingUp className="w-3 h-3" />
                        Best
                      </div>
                    )}
                  </div>

                  {/* Time & Reliability */}
                  <div className="hidden md:flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      <span>{quote.estimatedTime?.max || 60}min</span>
                      {quote.estimatedTime?.max === bestTime && (
                        <span className="text-green-600 dark:text-green-400">• Fastest</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Shield className="w-4 h-4" />
                      <span>{quote.confidence}%</span>
                      {quote.confidence === bestReliability && (
                        <span className="text-green-600 dark:text-green-400">• Best</span>
                      )}
                    </div>
                    {quote.instant && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300">
                        <Zap className="w-3 h-3" />
                        Instant
                      </span>
                    )}
                  </div>

                  {/* Action Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectBridge?.(quote);
                    }}
                    className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                      isSelected
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {isSelected ? 'Selected' : 'Select'}
                  </button>

                  {/* Expand Icon */}
                  <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </div>
              </div>

              {/* Expanded Details */}
              {isExpanded && showDetails && (
                <div className="px-4 pb-4 border-t border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50">
                  <div className="pt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">You Send</div>
                      <div className="font-medium text-gray-900 dark:text-white">
                        {quote.fromAmount} {quote.fromToken}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">You Receive</div>
                      <div className="font-medium text-gray-900 dark:text-white">
                        {quote.toAmount} {quote.toToken}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Rate</div>
                      <div className="font-medium text-gray-900 dark:text-white">
                        1 {quote.fromToken} = {quote.rate} {quote.toToken}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Total Fees</div>
                      <div className="font-medium text-gray-900 dark:text-white">
                        {Number(quote.totalFee || '0') > 0 
                          ? `$${quote.totalFee}` 
                          : 'Included'}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Gas Fee</div>
                      <div className="font-medium text-gray-900 dark:text-white">
                        {quote.gasFee || '~'}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Bridge Fee</div>
                      <div className="font-medium text-gray-900 dark:text-white">
                        {quote.bridgeFee || '~'}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Execution Time</div>
                      <div className="font-medium text-gray-900 dark:text-white">
                        {quote.estimatedTime?.min}-{quote.estimatedTime?.max} min
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Reliability</div>
                      <div className="font-medium text-gray-900 dark:text-white">
                        {quote.confidence}% uptime
                      </div>
                    </div>
                  </div>

                  {quote.depositAddress && (
                    <div className="mt-4 p-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Deposit Address</div>
                      <div className="font-mono text-sm text-gray-900 dark:text-white break-all">
                        {quote.depositAddress}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer Stats */}
      {!compact && (
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-green-600" />
              <span className="text-gray-600 dark:text-gray-400">
                Best Output: <span className="font-medium text-gray-900 dark:text-white">{bestOutput.toFixed(6)}</span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <CloudLightning className="w-4 h-4 text-blue-600" />
              <span className="text-gray-600 dark:text-gray-400">
                Fastest: <span className="font-medium text-gray-900 dark:text-white">{bestTime}min</span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-purple-600" />
              <span className="text-gray-600 dark:text-gray-400">
                Most Reliable: <span className="font-medium text-gray-900 dark:text-white">{bestReliability}%</span>
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
