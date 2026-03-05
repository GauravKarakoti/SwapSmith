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
  'sunday': 0, 'sun': 0,
  'monday': 1, 'mon': 1,
  'tuesday': 2, 'tue': 2,
  'wednesday': 3, 'wed': 3,
  'thursday': 4, 'thu': 4,
  'friday': 5, 'fri': 5,
  'saturday': 6, 'sat': 6
};

export function parseDCA(input: string): Partial<DCAScheduleNLConfig> | null {
  const normalizedInput = input.toLowerCase();
  
  let config: Partial<DCAScheduleNLConfig> = {};
  let matchFound = false;

  // Pattern 1: "$X per/every [period]"
  let match = input.match(DCA_PATTERNS[0]);
  if (match) {
    config.amount = parseFloat(match[1]);
    config.amountType = 'exact';
    config.frequency = FREQUENCY_MAP[match[2].toLowerCase()] || 'daily';
    matchFound = true;
  }

  // Pattern 2: "invest/buy $X [asset] every..."
  if (!matchFound) {
    match = input.match(DCA_PATTERNS[1]);
    if (match) {
      config.amount = parseFloat(match[1]);
      config.amountType = 'exact';
      if (match[2]) config.targetAsset = match[2].toUpperCase();
      const freq = match[3]?.toLowerCase();
      if (freq && FREQUENCY_MAP[freq]) config.frequency = FREQUENCY_MAP[freq];
      matchFound = true;
    }
  }

  // Pattern 3: "buy X tokens every Y"
  if (!matchFound) {
    match = input.match(DCA_PATTERNS[2]);
    if (match) {
      config.amount = parseFloat(match[1]);
      config.amountType = 'exact';
      config.targetAsset = match[2].toUpperCase();
      const freq = match[3]?.toLowerCase();
      if (freq && FREQUENCY_MAP[freq]) config.frequency = FREQUENCY_MAP[freq];
      matchFound = true;
    }
  }

  // Pattern 4: "DCA into [asset] - $X [period]"
  if (!matchFound) {
    match = input.match(DCA_PATTERNS[3]);
    if (match) {
      config.targetAsset = match[1].toUpperCase();
      config.amount = parseFloat(match[2]);
      config.amountType = 'exact';
      const freq = match[3]?.toLowerCase();
      if (freq && FREQUENCY_MAP[freq]) config.frequency = FREQUENCY_MAP[freq];
      matchFound = true;
    }
  }

  // Pattern 5: "set up recurring buy of $X daily/weekly"
  if (!matchFound) {
    match = input.match(DCA_PATTERNS[4]);
    if (match) {
      config.amount = parseFloat(match[1]);
      config.amountType = 'exact';
      const freq = match[2]?.toLowerCase();
      if (freq && FREQUENCY_MAP[freq]) config.frequency = FREQUENCY_MAP[freq];
      matchFound = true;
    }
  }

  // If we found a general intent "start dca" but no strict pattern, maybe we can infer
  if (!matchFound && /\bdca\b/i.test(input)) {
    matchFound = true; // Mark as found to proceed to extraction, maybe partial
  }

  if (!matchFound) return null;

  // Extract specific day (e.g. "every Friday")
  for (const [day, index] of Object.entries(DAY_OF_WEEK_MAP)) {
    if (normalizedInput.includes(day)) {
      config.dayOfWeek = index;
      if (!config.frequency) config.frequency = 'weekly';
      break;
    }
  }

  // Extract specific date (e.g. "on the 1st", "5th")
  const dateMatch = normalizedInput.match(/on\s+the\s+(\d+)(?:st|nd|rd|th)/i);
  if (dateMatch) {
    config.dayOfMonth = parseInt(dateMatch[1]);
    if (!config.frequency) config.frequency = 'monthly';
  }

  return config;
}

    if (normalizedInput.includes(day)) {
      config.dayOfWeek = index;
      if (!config.frequency) config.frequency = 'weekly';
      break;
    }
  }

  // Extract specific date (e.g. "on the 1st", "5th")
  const dateMatch = normalizedInput.match(/on\s+the\s+(\d+)(?:st|nd|rd|th)/i);
  if (dateMatch) {
    config.dayOfMonth = parseInt(dateMatch[1]);
    if (!config.frequency) config.frequency = 'monthly';
  }

  // Asset fallback if not found in pattern but exists in string
  if (!config.targetAsset) {
    const assets = input.match(/\b([A-Z]{2,10})\b/g);
    if (assets) {
      // Filter out keywords
      const keywords = ['DCA', 'BUY', 'SELL', 'INVEST', 'SWAP', 'EVERY', 'DAILY', 'WEEKLY', 'MONTHLY', 'PER', 'IN', 'OF', 'ON', 'THE'];
      const candidates = assets.filter(a => !keywords.includes(a.toUpperCase()));
      if (candidates.length > 0) {
        config.targetAsset = candidates[0].toUpperCase();
      }
    }
  }

  // Assume SOURCE is USDC if not specified? Or leave it empty for prompt?
  // Usually DCA is from Stable/Fiat to Crypto.
  // config.asset = 'USDC'; 

  return config;
}

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
