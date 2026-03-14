/**
 * Natural Language Parser for Limit Orders
 * Handles phrases like:
 * - "Buy ETH if price drops below $2000"
 * - "Sell when BTC hits $50k"
 * - "Convert to USDC when ETH goes above $3000"
 */

export interface LimitOrderNLConfig {
  asset: string;
  targetAsset?: string;
  price: number;
  condition: 'above' | 'below';
  amount?: number;
  amountType?: 'exact' | 'percentage';
}

const LIMIT_ORDER_PATTERNS = [
  // "buy/sell X when/if price [goes] above/below $Y"
  /\b(buy|sell|convert|swap)\s+([A-Z]{2,10})?\s+(?:when|if)?\s+(?:price\s+)?(?:goes?\s+)?(above|below|drops?|rises?|>|<|hits?)\s*\$?(\d+(?:\.\d+)?[km]?)/i,
  
  // "when BTC drops below $40k, sell my ETH"
  /when\s+([A-Z]{2,10})\s+(drops?\s+below|goes?\s+below|hits?\s+below|<)\s*\$?(\d+(?:\.\d+)?[km]?)/i,
  
  // "sell all if ETH above $3000"
  /(?:sell|buy|convert)\s+(?:all|my)?\s+([A-Z]{2,10})?\s+(?:if|when)\s+([A-Z]{2,10})?\s+(?:is|price)?\s+(above|below|>|<)\s*\$?(\d+(?:\.\d+)?[km]?)/i,
  
  // "execute when price reaches $X"
  /(?:execute|trigger|go|convert)\s+(?:when|if)?\s+(?:price\s+)?(?:reaches?|hits?)\s*\$?(\d+(?:\.\d+)?[km]?)/i,
];

const SCALING_SUFFIXES = { k: 1000, m: 1_000_000 };

function parseScaledPrice(rawPrice: string): number {
  const cleaned = rawPrice.toLowerCase().replace(/[^\d.km]/g, '');
  const base = parseFloat(cleaned);
  if (isNaN(base)) return NaN;
  
  const suffix = cleaned.slice(-1) as keyof typeof SCALING_SUFFIXES;
  return SCALING_SUFFIXES[suffix] ? base * SCALING_SUFFIXES[suffix] : base;
}

export function detectLimitOrder(input: string): Partial<LimitOrderNLConfig> | null {
  for (const pattern of LIMIT_ORDER_PATTERNS) {
    const match = input.match(pattern);
    if (!match) continue;

    const config: Partial<LimitOrderNLConfig> = {};

    // Extract action and assets
    const action = match[1]?.toLowerCase();
    const asset = match[2]?.toUpperCase();
    const conditionWord = match[3] || match[5] || match[6];
    const priceStr = match[4] || match[7];

    if (!priceStr) continue;

    config.price = parseScaledPrice(priceStr);
    if (isNaN(config.price)) continue;

    // Determine condition type
    if (/(above|>|rises?|hits?)/i.test(conditionWord as string)) {
      config.condition = 'above';
    } else if (/(below|<|drops?)/i.test(conditionWord as string)) {
      config.condition = 'below';
    } else {
      continue;
    }

    // Set asset
    if (asset && !['PRICE', 'IF', 'WHEN'].includes(asset)) {
      config.asset = asset;
      
      // For "sell/buy X when Y above $Z", X is the asset to trade
      if (/\b(sell|buy|convert|swap)\b/i.test(input) && action) {
        const assetAfterAction = input.match(new RegExp(`\\b${action}\\s+([A-Z]{2,10})`, 'i'));
        if (assetAfterAction) {
          config.asset = assetAfterAction[1]?.toUpperCase();
        }
      }
    }

    if (config.asset && config.condition && config.price) {
      return config;
    }
  }

  return null;
}
