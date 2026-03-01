// Re-export security scanner functions for frontend use
// This file acts as a bridge between the shared service and frontend

export interface TokenSecurityResult {
  tokenAddress: string;
  network: string;
  isHoneypot: boolean;
  isMalicious: boolean;
  isVerified: boolean;
  riskScore: number;
  riskFactors: string[];
  contractAnalysis: {
    isPausable: boolean;
    isMintable: boolean;
    isBlacklisted: boolean;
    hasProxy: boolean;
    ownerAddress: string | null;
    liquidityLocked: boolean;
    buyTax: number;
    sellTax: number;
    cannotSell: boolean;
  };
  holderAnalysis: {
    top10HoldersPercent: number;
    isCentralized: boolean;
  };
  metadata: {
    name: string | null;
    symbol: string | null;
    decimals: number | null;
    totalSupply: string | null;
  };
}

export interface SimulationResult {
  success: boolean;
  wouldSucceed: boolean;
  gasEstimate: string;
  gasLimit: string;
  error: string | null;
  warnings: string[];
}

export interface SecurityCheckResult {
  passed: boolean;
  riskScore: number;
  riskLevel: 'safe' | 'low' | 'medium' | 'high' | 'critical';
  checks: {
    tokenSecurity: { passed: boolean; message: string; details?: TokenSecurityResult };
    contractAnalysis: { passed: boolean; message: string; details?: any };
    addressReputation: { passed: boolean; message: string; details?: any };
    simulation: { passed: boolean; message: string; details?: SimulationResult };
    liquidityCheck: { passed: boolean; message: string; details?: any };
  };
  overallMessage: string;
  flags: string[];
  recommendations: string[];
}

export interface SecurityScanResponse {
  success: boolean;
  scanResult: SecurityCheckResult;
  metadata: {
    scannedAt: string;
    fromToken: string;
    fromNetwork: string;
    toToken: string;
    toNetwork: string;
    userId: string;
  };
  error?: string;
}

// Function to perform security scan via API
export async function performSecurityScan(
  fromToken: string,
  fromNetwork: string,
  toToken: string,
  toNetwork: string,
  fromAmount: string,
  contractAddress?: string,
  userAddress?: string,
  userId?: string
): Promise<SecurityScanResponse> {
  const response = await fetch('/api/security-scan', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fromToken,
      fromNetwork,
      toToken,
      toNetwork,
      fromAmount,
      contractAddress,
      userAddress,
      userId
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Security scan failed');
  }

  return response.json();
}

// Helper to format risk level for display
export function getRiskLevelLabel(level: 'safe' | 'low' | 'medium' | 'high' | 'critical'): string {
  const labels = {
    safe: '✅ Safe',
    low: '🟢 Low Risk',
    medium: '⚠️ Medium Risk',
    high: '🔴 High Risk',
    critical: '🚫 Critical Risk',
  };
  return labels[level];
}

// Helper to get color for risk score
export function getRiskScoreColor(score: number): string {
  if (score === 0) return '#22c55e'; // green
  if (score <= 20) return '#84cc16'; // lime
  if (score <= 50) return '#eab308'; // yellow
  if (score <= 80) return '#f97316'; // orange
  return '#ef4444'; // red
}

// Get icon for risk level
export function getRiskIcon(level: 'safe' | 'low' | 'medium' | 'high' | 'critical'): string {
  const icons = {
    safe: '✓',
    low: '✓',
    medium: '!',
    high: '!!',
    critical: '✕',
  };
  return icons[level];
}
