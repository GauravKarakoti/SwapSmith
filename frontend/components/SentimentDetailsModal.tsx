import React from "react";
import { MarketSentiment, TradingSignal } from "@/lib/market-sentiment";
import { getFearGreedEmoji, getFearGreedLabel, getFearGreedColor } from "@/lib/fear-greed";

interface SentimentData {
  bullish: number;
  neutral: number;
  bearish: number;
}

interface SentimentDetailsModalProps {
  open: boolean;
  onClose: () => void;
  sentiment: SentimentData;
}

export default function SentimentDetailsModal({ open, onClose, sentiment, signal }: SentimentDetailsModalProps) {
  if (!open) return null;

  // Get Fear & Greed display values
  const fearGreedValue = sentiment.fearGreed?.value ?? 50;
  const fearGreedEmoji = getFearGreedEmoji(fearGreedValue);
  const fearGreedLabelText = getFearGreedLabel(fearGreedValue);
  const fearGreedColorValue = getFearGreedColor(fearGreedValue);

  // Get trading signal display
  const signalEmoji = signal?.recommendation === 'buy' ? '⬆️' : signal?.recommendation === 'sell' ? '⬇️' : '➡️';
  const signalColor = signal?.recommendation === 'buy' ? 'text-green-500' : signal?.recommendation === 'sell' ? 'text-red-500' : 'text-yellow-500';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl p-6 w-full max-w-md relative max-h-[80vh] overflow-y-auto">
        <button
          className="absolute top-3 right-3 text-zinc-400 hover:text-zinc-900 dark:hover:text-white text-2xl"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>
        <h2 className="text-xl font-bold mb-2">Market Sentiment Details</h2>
        <div className="mb-4 text-zinc-600 dark:text-zinc-300 text-sm">
          This sentiment is calculated using CoinGecko&apos;s top 50 coins, based on 24h price and volume trends. <br />
          <a href="https://www.coingecko.com/en" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">View on CoinGecko</a>
        </div>
        
        {/* Market Sentiment Section */}
        <div className="mb-4">
          <h3 className="font-semibold mb-2 text-sm text-zinc-500 dark:text-zinc-400">Market Sentiment</h3>
          <ul className="space-y-2">
            <li className="flex items-center gap-2"><span className="text-green-500 text-lg">🟢</span> Bullish: <span className="font-semibold">{sentiment.bullish}%</span></li>
            <li className="flex items-center gap-2"><span className="text-yellow-500 text-lg">🟡</span> Neutral: <span className="font-semibold">{sentiment.neutral}%</span></li>
            <li className="flex items-center gap-2"><span className="text-red-500 text-lg">🔴</span> Bearish: <span className="font-semibold">{sentiment.bearish}%</span></li>
          </ul>
        </div>

        {/* Fear & Greed Index Section */}
        {sentiment.fearGreed && (
          <div className="mb-4 pt-4 border-t border-zinc-200 dark:border-zinc-700">
            <h3 className="font-semibold mb-2 text-sm text-zinc-500 dark:text-zinc-400">Fear & Greed Index</h3>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-zinc-100 dark:bg-zinc-800">
              <span className="text-3xl">{fearGreedEmoji}</span>
              <div>
                <div className="text-2xl font-bold" style={{ color: fearGreedColorValue }}>
                  {fearGreedValue}
                </div>
                <div className="text-sm" style={{ color: fearGreedColorValue }}>
                  {fearGreedLabelText}
                </div>
              </div>
            </div>
            {sentiment.fearGreedHistory && sentiment.fearGreedHistory.length > 0 && (
              <div className="mt-2 text-xs text-zinc-500">
                Last 7 days: {sentiment.fearGreedHistory.map(d => d.value).join(' → ')}
              </div>
            )}
          </div>
        )}

        {/* AI Trading Signal Section */}
        {signal && (
          <div className="mb-4 pt-4 border-t border-zinc-200 dark:border-zinc-700">
            <h3 className="font-semibold mb-2 text-sm text-zinc-500 dark:text-zinc-400">AI Trading Signal</h3>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-zinc-100 dark:bg-zinc-800">
              <span className="text-3xl">{signalEmoji}</span>
              <div>
                <div className={`text-xl font-bold ${signalColor}`}>
                  {signal.recommendation.toUpperCase()}
                </div>
                <div className="text-sm text-zinc-500">
                  {signal.confidence}% confidence
                </div>
              </div>
            </div>
            <div className="mt-2 text-sm">
              Risk Level: <span className={signal.riskLevel === 'low' ? 'text-green-500 font-semibold' : signal.riskLevel === 'high' ? 'text-red-500 font-semibold' : 'text-yellow-500 font-semibold'}>{signal.riskLevel.toUpperCase()}</span>
            </div>
            <div className="mt-2 text-sm text-zinc-600 dark:text-zinc-400 italic">
              "{signal.reasoning}"
            </div>
          </div>
        )}

        <div className="mt-4 text-xs text-zinc-400">
          Data updates automatically every time you open this modal.
          {sentiment.lastUpdated && (
            <div>Last updated: {new Date(sentiment.lastUpdated).toLocaleString()}</div>
          )}
        </div>
      </div>
    </div>
  );
}
