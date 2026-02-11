export interface ParsedLimitOrder {
  success: boolean;
  fromAsset?: string;
  toAsset?: string;
  amount?: number;
  conditionAsset?: string; // New field
  conditionType?: 'above' | 'below';
  targetPrice?: number;
  error?: string;
}

export function parseLimitOrder(input: string): ParsedLimitOrder {
  const cleanInput = input.trim().replace(/\$/g, '').replace(/,/g, '');

  // Regex pattern
  // Group 4: conditionAsset (optional)
  const regex = /Swap\s+(\d+(?:\.\d+)?)\s+([a-zA-Z0-9]+)\s+(?:for|to|into)\s+([a-zA-Z0-9]+)\s+(?:if|when)\s+(?:([a-zA-Z0-9]+)\s+)?(drops\s+below|below|<|rises\s+above|above|>)\s+(\d+(?:\.\d+)?)(k?)/i;

  const match = cleanInput.match(regex);

  if (!match) {
    return {
      success: false,
      error: "Could not parse limit order. usage: 'Swap 1 ETH for BTC if BTC drops below 40k'"
    };
  }

  const amount = parseFloat(match[1]);
  const fromAsset = match[2].toUpperCase();
  const toAsset = match[3].toUpperCase();
  const conditionAsset = match[4] ? match[4].toUpperCase() : undefined; // Capture condition asset

  let conditionTypeRaw = match[5].toLowerCase();
  let conditionType: 'above' | 'below';

  if (['drops below', 'below', '<'].includes(conditionTypeRaw)) {
    conditionType = 'below';
  } else if (['rises above', 'above', '>'].includes(conditionTypeRaw)) {
    conditionType = 'above';
  } else {
    return { success: false, error: "Invalid condition type" };
  }

  let priceRaw = parseFloat(match[6]);
  const kSuffix = match[7];

  if (kSuffix && kSuffix.toLowerCase() === 'k') {
    priceRaw *= 1000;
  }

  return {
    success: true,
    fromAsset,
    toAsset,
    amount,
    conditionAsset,
    conditionType,
    targetPrice: priceRaw
  };
}
