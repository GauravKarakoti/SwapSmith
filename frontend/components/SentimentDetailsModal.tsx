import React from "react";

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

export default function SentimentDetailsModal({ open, onClose, sentiment }: SentimentDetailsModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl p-6 w-full max-w-md relative">
        <button
          className="absolute top-3 right-3 text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
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
        <ul className="space-y-2">
          <li className="flex items-center gap-2"><span className="text-green-500 text-lg">🟢</span> Bullish: <span className="font-semibold">{sentiment.bullish}%</span></li>
          <li className="flex items-center gap-2"><span className="text-yellow-500 text-lg">🟡</span> Neutral: <span className="font-semibold">{sentiment.neutral}%</span></li>
          <li className="flex items-center gap-2"><span className="text-red-500 text-lg">🔴</span> Bearish: <span className="font-semibold">{sentiment.bearish}%</span></li>
        </ul>
        <div className="mt-6 text-xs text-zinc-400">Data updates automatically every time you open this modal.</div>
      </div>
    </div>
  );
}
