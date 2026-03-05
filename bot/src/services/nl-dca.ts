/**
 * Natural Language Parser for Dollar Cost Averaging (DCA)
 * Handles phrases like:
 * - "Invest $100 in Bitcoin daily"
 * - "Buy $50 of ETH every week"
 * - "DCA 0.5 BTC monthly"
 * - "Swap $200 to USDC bi-weekly"
 */

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
  // "$X per/every [period]"
  /\$(\d+(?:\.\d+)?)\s+(?:per|every|each)\s+(day|week|bi-?week|month|quarter|daily|weekly|monthly|quarterly)/i,
  
  // "invest/buy $X [asset] every/daily/weekly/monthly"
  /(?:invest|buy|swap|convert|dca)\s+\$(\d+(?:\.\d+)?)\s+(?:in|of|into)?\s+([A-Z]{2,10})?\s+(?:every|per|each|daily|weekly|bi-?weekly|monthly|quarterly|each\s+)?(\w+)?/i,
  
  // "buy X tokens every Y"
  /(?:invest|buy|swap|convert|dca)\s+([0-9.]+)\s+([A-Z]{2,10})\s+(?:every|per|each|daily|weekly|bi-?weekly|monthly|quarterly|each\s+)?(\w+)?/i,
  
  // "DCA into [asset] - $X [period]"
  /dca\s+(?:into|into|in)\s+([A-Z]{2,10})\s+[-–:]\s*\$(\d+(?:\.\d+)?)\s+(?:per|every)?\s*(\w+)/i,
  
  // "set up recurring buy of $X daily/weekly"
  /(?:recurring|scheduled|set\s+up)\s+(?:buy|investment|dca)\s+(?:of)?s*\$(\d+(?:\.\d+)?)\s+(?:every\s+)?(\w+)/i,
];

const FREQUENCY_MAP: Record<string, DCAScheduleNLConfig['frequency']> = {
  'day': 'daily',
  'daily': 'daily',
  'week': 'weekly',
  'weekly': 'weekly',
  'bi-week': 'bi-weekly',
  'biweek': 'bi-weekly',
  'month': 'monthly',
  'monthly': 'monthly',
  'quarter': 'quarterly',
  'quarterly': 'quarterly',
};

const DAY_OF_WEEK_MAP: Record<string, number> = {
  'monday': 1,
  'tuesday': 2,
  'wednesday': 3,
  'thursday': 4,
  'friday': 5,
  'saturday': 6,
  'sunday': 0,
};

function parseFrequency(freqStr: string): DCAScheduleNLConfig['frequency'] | null {
  const normalized = freqStr.toLowerCase().replace(/s$/, '');
  return FREQUENCY_MAP[normalized] || null;
}

function extractDayOfWeek(input: string): number | undefined {
  const match = input.match(/(?:every|each|on|each)\s+(\w+day|monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i);
  if (match) {
    return DAY_OF_WEEK_MAP[match[1].toLowerCase()];
  }
  return undefined;
}

function extractDayOfMonth(input: string): number | undefined {
  const match = input.match(/(?:on\s+the\s+)?(\d{1,2})(?:st|nd|rd|th)?(?:\s+of)?/i);
  if (match) {
    const day = parseInt(match[1]);
    return day >= 1 && day <= 28 ? day : undefined;
  }
  return undefined;
}

export function detectDCA(input: string): Partial<DCAScheduleNLConfig> | null {
  // Quick check for DCA keywords
  const hasDCAKeyword = /\b(dca|recurring|scheduled|every|daily|weekly|bi-?weekly|monthly|quarterly)\b/i.test(input);
  if (!hasDCAKeyword) return null;

  for (const pattern of DCA_PATTERNS) {
    const match = input.match(pattern);
    if (!match) continue;

    const config: Partial<DCAScheduleNLConfig> = {
      amountType: 'exact',
    };

    // Extract amount ($X or X tokens)
    let amount: number | null = null;
    let asset: string | null = null;
    let targetAsset: string | null = null;

    if (match[1]) {
      amount = parseFloat(match[1]);
    }

    // Extract assets
    if (match[2]) {
      const extracted = match[2].toUpperCase();
      if (extracted && !/\b(per|every|each|daily|weekly|monthly|quarterly)\b/i.test(extracted)) {
        asset = extracted;
      }
    }

    if (match[3]) {
      const freq = parseFrequency(match[3]);
      if (freq) {
        config.frequency = freq;
      } else if (/[A-Z]{2,10}/.test(match[3])) {
        targetAsset = match[3].toUpperCase();
      }
    }

    // Fallback: extract assets from input
    if (!asset) {
      const assetMatch = input.match(/(?:buy|invest|swap|convert|into|in|of)\s+([A-Z]{2,10})/i);
      if (assetMatch) {
        asset = assetMatch[1].toUpperCase();
      }
    }

    if (!targetAsset) {
      const targetMatch = input.match(/(?:to|into|for|in)\s+([A-Z]{2,10})/i);
      if (targetMatch && targetMatch[1] !== asset) {
        targetAsset = targetMatch[1].toUpperCase();
      }
    }

    // Parse frequency if not already done
    if (!config.frequency) {
      const freqMatch = input.match(/(?:daily|weekly|bi-?weekly|monthly|quarterly|every\s+(\w+))/i);
      if (freqMatch) {
        const freq = parseFrequency(freqMatch[1] || freqMatch[0]);
        if (freq) config.frequency = freq;
      }
    }

    // Extract day information
    config.dayOfWeek = extractDayOfWeek(input);
    config.dayOfMonth = extractDayOfMonth(input);

    // Build final config
    if (amount && (asset || targetAsset) && config.frequency) {
      config.amount = amount;
      config.asset = asset || 'USDC';
      config.targetAsset = targetAsset || 'USDC';
      return config;
    }
  }

  return null;
}
