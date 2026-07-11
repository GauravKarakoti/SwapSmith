/**
 * Natural Language Parser for Dollar Cost Averaging (DCA)
 * Handles phrases like:
 * - "Invest $100 in Bitcoin daily"
 * - "Buy $50 of ETH every week"
 * - "DCA 0.5 BTC monthly"
 * - "Swap $200 to USDC bi-weekly"
 */

import { ParsedCommand } from "./parseUserCommand";

export interface DCAScheduleNLConfig {
  asset: string;
  targetAsset: string;
  amount: number;
  amountType: 'exact' | 'percentage';
  frequency: 'daily' | 'weekly' | 'bi-weekly' | 'monthly' | 'quarterly';
  dayOfWeek?: number; // 0-6 (Sunday-Saturday)
  dayOfMonth?: number; // 1-28
}

const DCA_PATTERNS = [
  /\$(\d+(?:\.\d+)?)\s+(?:per|every|each)\s+(day|week|bi-?week|month|quarter|daily|weekly|monthly|quarterly)/i,
  /(?:invest|buy|swap|convert|dca)\s+\$(\d+(?:\.\d+)?)\s+(?:in|of|into)?\s+([A-Z]{2,10})?\s+(?:every|per|each|daily|weekly|bi-?weekly|monthly|quarterly|each\s+)?(\w+)?/i,
  /(?:invest|buy|swap|convert|dca)\s+([0-9.]+)\s+([A-Z]{2,10})\s+(?:every|per|each|daily|weekly|bi-?weekly|monthly|quarterly|each\s+)?(\w+)?/i,
  /dca\s+(?:into|in)\s+([A-Z]{2,10})\s+[-–:]\s*\$(\d+(?:\.\d+)?)\s+(?:per|every)?\s*(\w+)/i,
  /(?:recurring|scheduled|set\s+up)\s+(?:buy|investment|dca)\s+(?:of)?s*\$(\d+(?:\.\d+)?)\s+(?:every\s+)?(\w+)/i,
];

const FREQUENCY_MAP: Record<string, "daily" | "weekly" | "monthly"> = {
  'day': 'daily', 'daily': 'daily',
  'week': 'weekly', 'weekly': 'weekly',
  'month': 'monthly', 'monthly': 'monthly'
};

export function parseDCA(input: string): Partial<ParsedCommand> | null {
  const normalizedInput = input.toLowerCase();
  let config: Partial<ParsedCommand> = { intent: 'dca' };
  let matchFound = false;

  for (let i = 0; i < DCA_PATTERNS.length; i++) {
    const match = input.match(DCA_PATTERNS[i]!);
    if (match) {
      if (i === 0) {
        config.amount = parseFloat(match[1]!);
        config.frequency = FREQUENCY_MAP[match[2]!.toLowerCase()] || 'daily';
      } else {
        config.amount = parseFloat(match[1]!);
        if (match[2] && i !== 4) config.toAsset = match[2].toUpperCase();
        const freq = match[3]?.toLowerCase();
        if (freq && FREQUENCY_MAP[freq]) config.frequency = FREQUENCY_MAP[freq];
      }
      matchFound = true;
      break;
    }
  }

  if (!matchFound && /\bdca\b/i.test(input)) matchFound = true;
  if (!matchFound) return null;

  if (!config.frequency) {
    if (/weekly|week/i.test(normalizedInput)) config.frequency = 'weekly';
    else if (/monthly|month/i.test(normalizedInput)) config.frequency = 'monthly';
    else config.frequency = 'daily';
  }

  if (!config.toAsset) {
    const assets = input.match(/\b([A-Z]{2,10})\b/g);
    if (assets) {
      const keywords = ['DCA', 'BUY', 'SELL', 'INVEST', 'SWAP', 'EVERY', 'DAILY', 'WEEKLY', 'MONTHLY'];
      const candidates = assets.filter(a => !keywords.includes(a.toUpperCase()));
      if (candidates.length > 0) config.toAsset = candidates[0]!.toUpperCase();
    }
  }

  return config.amount && config.toAsset ? config : null;
}