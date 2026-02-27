import { useState } from 'react';
import { RefreshCcw, CheckCircle, AlertCircle, Loader, ArrowRight } from 'lucide-react';

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

export interface PortfolioItem {
  id: string;
  fromAsset: string;
  toAsset: string;
  amount: number;
  status: 'pending' | 'success' | 'error';
  error?: string;
  quote?: QuoteData;
  fromChain?: string;
  toChain?: string;
}

interface PortfolioSummaryProps {
  items: PortfolioItem[];
  onRetry: (failedItems: PortfolioItem[]) => void;
}

export default function PortfolioSummary({ items, onRetry }: PortfolioSummaryProps) {
  const [isRetrying, setIsRetrying] = useState(false);

  const failedItems = items.filter(item => item.status === 'error');
  const successItems = items.filter(item => item.status === 'success');
  const pendingItems = items.filter(item => item.status === 'pending');

  const handleRetry = async () => {
    setIsRetrying(true);
    await onRetry(failedItems);
    setIsRetrying(false);
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 shadow-lg w-full max-w-md my-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-white">Portfolio Rebalance Summary</h3>
        <div className="text-sm text-gray-400">
          {successItems.length}/{items.length} Successful
        </div>
      </div>

      <div className="space-y-3">
        {items.map((item) => (
          <div 
            key={item.id} 
            className={`flex items-center justify-between p-3 rounded-md border ${
              item.status === 'error' ? 'border-red-500/30 bg-red-500/10' : 
              item.status === 'success' ? 'border-green-500/30 bg-green-500/10' : 
              'border-gray-600 bg-gray-700/50'
            }`}
          >
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0">
                {item.status === 'pending' && <Loader className="animate-spin text-blue-400 w-5 h-5" />}
                {item.status === 'success' && <CheckCircle className="text-green-400 w-5 h-5" />}
                {item.status === 'error' && <AlertCircle className="text-red-400 w-5 h-5" />}
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-medium text-gray-200">
                  {item.amount} {item.fromAsset} <ArrowRight className="inline w-3 h-3 mx-1"/> {item.toAsset}
                </span>
                {item.status === 'error' && (
                  <span className="text-xs text-red-300 truncate max-w-[200px]" title={item.error}>
                    {item.error}
                  </span>
                )}
                {item.status === 'success' && item.quote && (
                  <span className="text-xs text-green-300">
                    Receive ~{parseFloat(item.quote.settleAmount).toFixed(4)} {item.quote.settleCoin}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {failedItems.length > 0 && (
        <div className="mt-4 flex justify-end">
          <button
            onClick={handleRetry}
            disabled={isRetrying || pendingItems.length > 0}
            className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              isRetrying || pendingItems.length > 0
                ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {isRetrying ? (
              <>
                <Loader className="animate-spin w-4 h-4 mr-2" />
                Retrying...
              </>
            ) : (
              <>
                <RefreshCcw className="w-4 h-4 mr-2" />
                Retry Failed Swaps ({failedItems.length})
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
