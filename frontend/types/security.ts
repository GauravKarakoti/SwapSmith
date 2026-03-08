export interface SecurityReport {
  tokenAddress: string;
  chain: string;
  contractVerified: boolean;
  honeypotLikelihood: 'low' | 'medium' | 'high';
  ownershipRenounced: boolean;
  mintable: boolean;
  buyTax: number;
  sellTax: number;
  overallRiskScore: number; // 0 (safe) - 100 (scam)
  simulationResult: {
    canBuy: boolean;
    canSell: boolean;
    maxSellAmount?: string;
  };
  holderAnalysis: {
    topHoldersShare: number; // Percentage held by top 10
    totalHolders: number;
  };
  details: string[];
}
