"use client";

import React, { useEffect, useState, useRef } from "react";
import { fetchMarketSentiment } from "@/lib/market-sentiment";
import Link from "next/link";

export default function MarketSentimentWidget() {
  const [sentiment, setSentiment] = useState({
    bullish: 72,
    neutral: 18,
    bearish: 10,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [popupOpen, setPopupOpen] = useState(false);
  const [popupSticky, setPopupSticky] = useState(false);
  const widgetRef = useRef<HTMLDivElement | null>(null);

  // Fetch sentiment
  const fetchSentiment = async () => {
    setRefreshing(true);
    const data = await fetchMarketSentiment();
    setSentiment(data);
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    fetchSentiment();
  }, []);

  let sentimentLabel = "Neutral";
  let sentimentIcon = "🟡";
  let sentimentPercent: number | null = null;
  let sentimentColor = "text-yellow-500";

  if (sentiment.bullish > 60) {
    sentimentLabel = "Bullish";
    sentimentIcon = "🟢";
    sentimentPercent = sentiment.bullish;
    sentimentColor = "text-green-500";
  } else if (sentiment.bearish > 60) {
    sentimentLabel = "Bearish";
    sentimentIcon = "🔴";
    sentimentPercent = sentiment.bearish;
    sentimentColor = "text-red-500";
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    fetchSentiment();
  };

  const handleDoubleClick = () => {
    // window.open("https://www.coingecko.com/en", "_blank");
    // No redirect on double click
  };

  const handleMouseEnter = () => {
    if (!popupSticky) setPopupOpen(true);
  };

  const handleMouseLeave = () => {
    if (!popupSticky) setPopupOpen(false);
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPopupOpen(true);
    setPopupSticky(true);
  };

  useEffect(() => {
    if (!popupSticky) return;

    function handleDocumentClick(e: MouseEvent) {
      if (
        widgetRef.current &&
        !widgetRef.current.contains(e.target as Node)
      ) {
        setPopupOpen(false);
        setPopupSticky(false);
      }
    }

    document.addEventListener("mousedown", handleDocumentClick);
    return () =>
      document.removeEventListener("mousedown", handleDocumentClick);
  }, [popupSticky]);

  return (
    <div className="relative inline-block" ref={widgetRef}>
      <div
        className={`flex items-center gap-2 px-3 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 shadow-sm select-none cursor-pointer ${sentimentColor} text-sm font-semibold transition-opacity ${
          refreshing ? "opacity-60" : ""
        }`}
        title="AI Market Sentiment (Live, based on Live Prices trends)"
        onContextMenu={handleContextMenu}
        onDoubleClick={handleDoubleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        tabIndex={0}
        role="button"
        aria-label="Show market sentiment details"
      >
        <span className="text-lg">{sentimentIcon}</span>
        <span>
          {loading ? "Loading..." : sentimentLabel}
          {!loading && sentimentPercent !== null && (
            <span className="ml-1">({sentimentPercent}%)</span>
          )}
        </span>
        {refreshing && (
          <span className="ml-2 animate-spin">↻</span>
        )}
      </div>

      {popupOpen && (
        <div className="absolute left-1/2 z-50 mt-2 -translate-x-1/2 min-w-[260px]">
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl p-4 border border-zinc-200 dark:border-zinc-800 text-xs">
            <div className="mb-2 text-zinc-600 dark:text-zinc-300">
              <b>Market Sentiment Details</b><br />
              Based on top 50 coins 24h price & volume trends.<br />
              <Link
                href="/prices"
                className="text-blue-600 underline"
              >
                View on Live Prices
              </Link>
            </div>

            <ul className="space-y-1 mb-1">
              <li className="flex items-center gap-2">
                🟢 Bullish:
                <span className="font-semibold">
                  {sentiment.bullish}%
                </span>
              </li>
              <li className="flex items-center gap-2">
                🟡 Neutral:
                <span className="font-semibold">
                  {sentiment.neutral}%
                </span>
              </li>
              <li className="flex items-center gap-2">
                🔴 Bearish:
                <span className="font-semibold">
                  {sentiment.bearish}%
                </span>
              </li>
            </ul>

            <div className="text-zinc-400">
              Data updates automatically when opened.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}