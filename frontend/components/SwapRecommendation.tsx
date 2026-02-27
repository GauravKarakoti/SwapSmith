"use client";

import React, { useEffect, useState } from "react";
import { fetchMarketSentiment, generateTradingSignal, MarketSentiment, TradingSignal } from "@/lib/market-sentiment";
import { TrendingUp, TrendingDown, Minus, AlertTriangle, Info, Clock, RefreshCw } from "lucide-react";

interface SwapRecommendationProps {
  showDetails?: boolean;
  compact?: boolean;
}

export default function SwapRecommendation({ showDetails = true, compact = false }: SwapRecommendationProps) {
  const [sentiment, setSentiment] = useState<MarketSentiment | null>(null);
  const [signal, setSignal] = useState<TradingSignal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchMarketSentiment();
      setSentiment(data);
      const tradingSignal = generateTradingSignal(data);
      setSignal(tradingSignal);
    } catch (err) {
      setError("Failed to fetch market data");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className={`bg-zinc-50 dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 ${compact ? 'p-2' : 'p-4'}`}>
        <div className="flex items-center gap-2 text-zinc-500">
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span className="text-sm">Analyzing market conditions...</span>
        </div>
      </div>
    );
  }

  if (error || !signal) {
    return (
      <div className={`bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800 ${compact ? 'p-2' : 'p-4'}`}>
        <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-400">
          <AlertTriangle className="w-4 h-4" />
          <span className="text-sm">Unable to analyze market. Proceed with caution.</span>
        </div>
      </div>
    );
  }

  // Determine display values based on signal
  const isGoodTime = signal.recommendation === 'buy';
  const isBadTime = signal.recommendation === 'sell';
  const isNeutral = signal.recommendation === 'hold';

  const iconBgColor = isGoodTime 
    ? 'bg-green-100 dark:bg-green-900/30' 
    : isBadTime 
      ? 'bg-red-100 dark:bg-red-900/30' 
      : 'bg-yellow-100 dark:bg-yellow-900/30';

  const iconColor = isGoodTime 
    ? 'text-green-600 dark:text-green-400' 
    : isBadTime 
      ? 'text-red-600 dark:text-red-400' 
      : 'text-yellow-600 dark:text-yellow-400';

  const borderColor = isGoodTime 
    ? 'border-green-200 dark:border-green-800' 
    : isBadTime 
      ? 'border-red-200 dark:border-red-800' 
      : 'border-yellow-200 dark:border-yellow-800';

  const bgColor = isGoodTime 
    ? 'bg-green-50 dark:bg-green-900/10' 
    : isBadTime 
      ? 'bg-red-50 dark:bg-red-900/10' 
      : 'bg-yellow-50 dark:bg-yellow-900/10';

  const recommendationText = isGoodTime 
    ? 'Good Time to Swap' 
    : isBadTime 
      ? 'Wait for Better Timing' 
      : 'Neutral Market Conditions';

  const recommendationIcon = isGoodTime 
    ? <TrendingUp className="w-5 h-5" /> 
    : isBadTime 
      ? <TrendingDown className="w-5 h-5" /> 
      : <Minus className="w-5 h-5" />;

  if (compact) {
    return (
      <div 
        className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${borderColor} ${bgColor} cursor-help`}
        title={`${recommendationText} - ${signal.confidence}% confidence`}
      >
        <div className={`p-1 rounded-full ${iconBgColor} ${iconColor}`}>
          {recommendationIcon}
        </div>
        <div className="flex-1 min-w-0">
          <div className={`text-sm font-semibold ${iconColor}`}>
            {isGoodTime ? '✅ Good' : isBadTime ? '⏸️ Wait' : '➡️ Neutral'}
          </div>
        </div>
        <div className="text-xs text-zinc-500">
          {signal.confidence}%
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-lg border ${borderColor} ${bgColor}`}>
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-full ${iconBgColor} ${iconColor}`}>
            {recommendationIcon}
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <h4 className={`font-semibold ${iconColor}`}>
                {recommendationText}
              </h4>
              <span className="text-xs bg-zinc-200 dark:bg-zinc-700 px-2 py-1 rounded-full text-zinc-600 dark:text-zinc-300">
                {signal.confidence}% confidence
              </span>
            </div>
            
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
              {signal.reasoning}
            </p>

            {showDetails && (
              <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-700">
                <div className="flex items-center gap-4 text-xs">
                  <div className="flex items-center gap-1">
                    <span className="text-zinc-500">Risk Level:</span>
                    <span className={`font-semibold ${
                      signal.riskLevel === 'low' 
                        ? 'text-green-600 dark:text-green-400' 
                        : signal.riskLevel === 'high' 
                          ? 'text-red-600 dark:text-red-400' 
                          : 'text-yellow-600 dark:text-yellow-400'
                    }`}>
                      {signal.riskLevel.toUpperCase()}
                    </span>
                  </div>
                  
                  {sentiment?.fearGreed && (
                    <div className="flex items-center gap-1">
                      <span className="text-zinc-500">Fear & Greed:</span>
                      <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                        {sentiment.fearGreed.value} - {sentiment.fearGreed.value_classification}
                      </span>
                    </div>
                  )}
                </div>

                {/* Market Sentiment Summary */}
                {sentiment && (
                  <div className="mt-2 flex items-center gap-2 text-xs">
                    <span className="text-zinc-500">Market:</span>
                    <span className="text-green-600 dark:text-green-400">🟢 {sentiment.bullish}%</span>
                    <span className="text-yellow-600 dark:text-yellow-400">🟡 {sentiment.neutral}%</span>
                    <span className="text-red-600 dark:text-red-400">🔴 {sentiment.bearish}%</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Disclaimer */}
        <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-700">
          <div className="flex items-start gap-2 text-xs text-zinc-500">
            <Info className="w-3 h-3 flex-shrink-0 mt-0.5" />
            <span>
              This is an automated analysis based on market data and should not be considered financial advice. 
              Always do your own research before making trading decisions.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
