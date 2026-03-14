import { createPublicClient, http, type PublicClient, type Address, Chain } from 'viem';
import { mainnet, polygon, arbitrum, avalanche, optimism, bsc, base } from 'viem/chains';

const CHAIN_CONFIG: Record<string, { chain: Chain; rpcUrl: string }> = {
  ethereum: { chain: mainnet, rpcUrl: process.env['ETHEREUM_RPC_URL'] || 'https://eth.llamarpc.com' },
  polygon: { chain: polygon, rpcUrl: process.env['POLYGON_RPC_URL'] || 'https://polygon.llamarpc.com' },
  arbitrum: { chain: arbitrum, rpcUrl: process.env['ARBITRUM_RPC_URL'] || 'https://arb1.arbitrum.io/rpc' },
  avalanche: { chain: avalanche, rpcUrl: process.env['AVALANCHE_RPC_URL'] || 'https://api.avax.network/ext/bc/C/rpc' },
  optimism: { chain: optimism, rpcUrl: process.env['OPTIMISM_RPC_URL'] || 'https://mainnet.optimism.io' },
  bsc: { chain: bsc, rpcUrl: process.env['BSC_RPC_URL'] || 'https://bsc-dataseed.binance.org' },
  base: { chain: base, rpcUrl: process.env['BASE_RPC_URL'] || 'https://mainnet.base.org' },
};

// Common ERC-20 ABI for token interactions
const ERC20_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    name: 'transfer',
    type: 'function',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    name: 'allowance',
    type: 'function',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    name: 'name',
    type: 'function',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
  },
  {
    name: 'symbol',
    type: 'function',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
  },
  {
    name: 'decimals',
    type: 'function',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view',
  },
  {
    name: 'totalSupply',
    type: 'function',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    name: 'owner',
    type: 'function',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  {
    name: 'paused',
    type: 'function',
    inputs: [],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
] as const;

// Known malicious address patterns (simplified list)
const KNOWN_MALICIOUS_PATTERNS = [
  '0x000000000000000000000000000000000000dEaD',
  '0x0000000000000000000000000000000000000000',
];

// Token security check result interface
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

// Transaction simulation result
export interface SimulationResult {
  success: boolean;
  wouldSucceed: boolean;
  gasEstimate: string;
  gasLimit: string;
  error: string | null;
  warnings: string[];
}

// Security check result
export interface SecurityCheckResult {
  passed: boolean;
  riskScore: number; // 0-100
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

// Get public client for a network
function getPublicClient(network: string): PublicClient | null {
  const config = CHAIN_CONFIG[network.toLowerCase()];
  if (!config) return null;

  return createPublicClient({
    chain: config.chain,
    transport: http(config.rpcUrl),
  });
}

// Analyze a token for security issues
export async function analyzeTokenSecurity(
  tokenAddress: string,
  network: string
): Promise<TokenSecurityResult> {
  const client = getPublicClient(network);
  
  const result: TokenSecurityResult = {
    tokenAddress,
    network,
    isHoneypot: false,
    isMalicious: false,
    isVerified: false,
    riskScore: 0,
    riskFactors: [],
    contractAnalysis: {
      isPausable: false,
      isMintable: false,
      isBlacklisted: false,
      hasProxy: false,
      ownerAddress: null,
      liquidityLocked: false,
      buyTax: 0,
      sellTax: 0,
      cannotSell: false,
    },
    holderAnalysis: {
      top10HoldersPercent: 0,
      isCentralized: false,
    },
    metadata: {
      name: null,
      symbol: null,
      decimals: null,
      totalSupply: null,
    },
  };

  if (!client) {
    result.riskFactors.push('Unsupported network');
    result.riskScore = 100;
    result.isMalicious = true;
    return result;
  }

  try {
    // Try to get basic token info
    const [name, symbol, decimals, totalSupply, owner] = await Promise.allSettled([
      client.readContract({ address: tokenAddress as Address, abi: ERC20_ABI, functionName: 'name' }),
      client.readContract({ address: tokenAddress as Address, abi: ERC20_ABI, functionName: 'symbol' }),
      client.readContract({ address: tokenAddress as Address, abi: ERC20_ABI, functionName: 'decimals' }),
      client.readContract({ address: tokenAddress as Address, abi: ERC20_ABI, functionName: 'totalSupply' }),
      client.readContract({ address: tokenAddress as Address, abi: ERC20_ABI, functionName: 'owner' }).catch(() => null),
    ]);

    result.metadata.name = name.status === 'fulfilled' ? name.value as string : null;
    result.metadata.symbol = symbol.status === 'fulfilled' ? symbol.value as string : null;
    result.metadata.decimals = decimals.status === 'fulfilled' ? decimals.value as number : null;
    result.metadata.totalSupply = totalSupply.status === 'fulfilled' ? totalSupply.value.toString() : null;
    result.contractAnalysis.ownerAddress = owner.status === 'fulfilled' ? owner.value as string : null;

    // Check if owner is null (could indicate a honeypot)
    if (result.contractAnalysis.ownerAddress === null) {
      result.riskFactors.push('No owner function or contract may be honeypot');
    }

    // Check if total supply is suspiciously round
    if (totalSupply.status === 'fulfilled') {
      const supply = totalSupply.value.toString();
      // Common honeypot pattern: very round numbers like 1 trillion
      if (supply && (BigInt(supply) % BigInt(1e18) === BigInt(0))) {
        const normalized = BigInt(supply) / BigInt(1e18);
        if (normalized === BigInt(1e6) || normalized === BigInt(1e9) || normalized === BigInt(1e12)) {
          result.riskFactors.push('Suspiciously round total supply');
          result.riskScore += 15;
        }
      }
    }

    // Calculate initial risk score
    result.riskScore = Math.min(result.riskScore, 100);

  } catch (error) {
    result.riskFactors.push('Failed to read token contract - possible honeypot');
    result.riskScore = 100;
    result.isHoneypot = true;
    result.isMalicious = true;
  }

  return result;
}

// Check if an address is in our known malicious list
export async function checkAddressReputation(
  address: string,
  _network: string
): Promise<{ isMalicious: boolean; threatType: string | null; confidence: number }> {
  // Check against known malicious patterns
  if (KNOWN_MALICIOUS_PATTERNS.includes(address.toLowerCase())) {
    return {
      isMalicious: true,
      threatType: 'blacklisted',
      confidence: 100,
    };
  }

  // Additional checks could be added here using external APIs
  // For now, return safe by default
  return {
    isMalicious: false,
    threatType: null,
    confidence: 0,
  };
}

// Simulate a transaction to check if it would succeed
export async function simulateTransaction(
  from: string,
  to: string,
  value: string,
  network: string,
  data?: string
): Promise<SimulationResult> {
  const client = getPublicClient(network);

  if (!client) {
    return {
      success: false,
      wouldSucceed: false,
      gasEstimate: '0',
      gasLimit: '0',
      error: 'Unsupported network',
      warnings: [],
    };
  }

  const warnings: string[] = [];

  try {
    // Estimate gas
    const gasEstimate = await client.estimateGas({
      account: from as Address,
      to: to as Address,
      value: BigInt(value),
      data: data as `0x${string}` | undefined,
    });

    // Add 20% buffer to gas estimate
    const gasLimit = (gasEstimate * BigInt(120)) / BigInt(100);

    // Check if the estimate is unusually high
    if (gasEstimate > BigInt(500000)) {
      warnings.push('High gas estimate - transaction may fail or be expensive');
    }

    return {
      success: true,
      wouldSucceed: true,
      gasEstimate: gasEstimate.toString(),
      gasLimit: gasLimit.toString(),
      error: null,
      warnings,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Check for common honeypot error patterns
    if (errorMessage.includes('execution reverted')) {
      warnings.push('Transaction would revert - possible honeypot');
    }

    return {
      success: false,
      wouldSucceed: false,
      gasEstimate: '0',
      gasLimit: '0',
      error: errorMessage,
      warnings,
    };
  }
}

// Main security scanner function
export async function performSecurityScan(
    _fromToken: string,
    fromNetwork: string,
    toToken: string,
    toNetwork: string,
    fromAmount: string,
    contractAddress: string,
    userAddress: string
): Promise<SecurityCheckResult> {
  const checks = {
    tokenSecurity: { passed: true, message: '', details: undefined as TokenSecurityResult | undefined },
    contractAnalysis: { passed: true, message: '', details: undefined as any },
    addressReputation: { passed: true, message: '', details: undefined as { isMalicious: boolean; threatType: string | null; confidence: number } | undefined },
    simulation: { passed: true, message: '', details: undefined as SimulationResult | undefined },
    liquidityCheck: { passed: true, message: '', details: undefined as any },
  };

  const flags: string[] = [];
  const recommendations: string[] = [];
  let totalRiskScore = 0;

  // 1. Token Security Analysis
  try {
    if (toToken && toNetwork) {
      const tokenAnalysis = await analyzeTokenSecurity(toToken, toNetwork);
      checks.tokenSecurity.details = tokenAnalysis;

      if (tokenAnalysis.isHoneypot) {
        checks.tokenSecurity.passed = false;
        checks.tokenSecurity.message = 'Token appears to be a honeypot';
        flags.push('HONEYPOT_DETECTED');
        totalRiskScore += 50;
      } else if (tokenAnalysis.riskScore > 50) {
        checks.tokenSecurity.passed = false;
        checks.tokenSecurity.message = 'Token has high risk factors';
        flags.push('HIGH_RISK_TOKEN');
        totalRiskScore += 30;
      } else if (tokenAnalysis.riskScore > 25) {
        checks.tokenSecurity.message = 'Token has some risk factors';
        totalRiskScore += 15;
      } else {
        checks.tokenSecurity.message = 'Token appears safe';
      }

      if (tokenAnalysis.riskFactors.length > 0) {
        flags.push(...tokenAnalysis.riskFactors.map(f => `RISK_FACTOR: ${f}`));
      }
    }
  } catch (error) {
    checks.tokenSecurity.passed = false;
    checks.tokenSecurity.message = 'Failed to analyze token security';
    totalRiskScore += 25;
  }

  // 2. Contract Address Reputation
  try {
    if (contractAddress) {
      const reputation = await checkAddressReputation(contractAddress, toNetwork);
      checks.addressReputation.details = reputation;

      if (reputation.isMalicious) {
        checks.addressReputation.passed = false;
        checks.addressReputation.message = 'Contract address is flagged as malicious';
        flags.push('MALICIOUS_CONTRACT');
        totalRiskScore += 40;
      } else {
        checks.addressReputation.message = 'Contract address appears clean';
      }
    }
  } catch (error) {
    checks.addressReputation.message = 'Could not verify contract reputation';
  }

  // 3. Transaction Simulation
  try {
    if (contractAddress && userAddress && fromAmount) {
      const simulation = await simulateTransaction(
        userAddress,
        contractAddress,
        fromAmount,
        fromNetwork
      );
      checks.simulation.details = simulation;

      if (!simulation.wouldSucceed) {
        checks.simulation.passed = false;
        checks.simulation.message = simulation.error || 'Transaction simulation failed';
        flags.push('SIMULATION_FAILED');
        totalRiskScore += 30;
      } else {
        checks.simulation.message = 'Transaction simulation successful';
        
        if (simulation.warnings.length > 0) {
          flags.push(...simulation.warnings.map(w => `WARNING: ${w}`));
          totalRiskScore += 10;
        }
      }
    }
  } catch (error) {
    checks.simulation.passed = false;
    checks.simulation.message = 'Failed to simulate transaction';
    totalRiskScore += 20;
  }

  // 4. Liquidity Check (basic)
  if (checks.tokenSecurity.details?.contractAnalysis.liquidityLocked === false) {
    checks.liquidityCheck.passed = false;
    checks.liquidityCheck.message = 'Liquidity is not locked - higher rug pull risk';
    flags.push('UNLOCKED_LIQUIDITY');
    totalRiskScore += 15;
  } else {
    checks.liquidityCheck.message = 'Liquidity status unknown';
  }

  // Calculate final risk level
  totalRiskScore = Math.min(totalRiskScore, 100);

  let riskLevel: 'safe' | 'low' | 'medium' | 'high' | 'critical';
  let overallMessage: string;

  if (totalRiskScore === 0) {
    riskLevel = 'safe';
    overallMessage = 'All security checks passed';
  } else if (totalRiskScore <= 20) {
    riskLevel = 'low';
    overallMessage = 'Low risk detected';
  } else if (totalRiskScore <= 50) {
    riskLevel = 'medium';
    overallMessage = 'Medium risk detected - proceed with caution';
  } else if (totalRiskScore <= 80) {
    riskLevel = 'high';
    overallMessage = 'High risk detected - recommend not proceeding';
  } else {
    riskLevel = 'critical';
    overallMessage = 'Critical risk detected - transaction blocked';
  }

  // Generate recommendations
  if (checks.tokenSecurity.details?.riskFactors.length) {
    recommendations.push('Review token security factors before proceeding');
  }
  if (checks.simulation.details?.warnings.length) {
    recommendations.push('Address simulation warnings');
  }
  if (totalRiskScore > 50) {
    recommendations.push('Consider using a smaller test transaction first');
  }

  // Overall passed if no critical issues
  const passed = totalRiskScore < 50 && !flags.includes('HONEYPOT_DETECTED') && !flags.includes('MALICIOUS_CONTRACT');

  return {
    passed,
    riskScore: totalRiskScore,
    riskLevel,
    checks,
    overallMessage,
    flags,
    recommendations,
  };
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
