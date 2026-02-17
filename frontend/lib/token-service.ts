/**
 * Mock Web3 Token Implementation
 * This simulates blockchain token minting without requiring real blockchain setup
 * Perfect for development and testing
 */

interface MintResult {
  txHash: string;
  blockNumber: number;
  success: boolean;
}

// Mock token balance storage (in production, this would be on-chain)
const mockBalances = new Map<string, number>();

/**
 * Mock token minting function
 * Simulates blockchain transaction without actual Web3 calls
 */
export async function mockMintTokens(
  recipientAddress: string,
  amount: string
): Promise<MintResult> {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Generate fake transaction hash
  const txHash = `0x${Math.random().toString(16).substring(2, 66)}`;
  const blockNumber = Math.floor(Math.random() * 1000000) + 15000000;

  // Update mock balance
  const currentBalance = mockBalances.get(recipientAddress) || 0;
  mockBalances.set(recipientAddress, currentBalance + parseFloat(amount));

  console.log(`[Mock Token] Minted ${amount} tokens to ${recipientAddress}`);
  console.log(`[Mock Token] TX: ${txHash}`);
  console.log(`[Mock Token] Block: ${blockNumber}`);

  return {
    txHash,
    blockNumber,
    success: true,
  };
}

/**
 * Get mock token balance
 */
export async function getMockTokenBalance(address: string): Promise<string> {
  const balance = mockBalances.get(address) || 0;
  return balance.toFixed(8);
}

/**
 * Clear all mock balances (for testing)
 */
export function resetMockBalances() {
  mockBalances.clear();
}

/**
 * Production-ready function that switches between mock and real implementation
 */
export async function mintTokens(
  recipientAddress: string,
  amount: string
): Promise<MintResult> {
  const useMock = process.env.USE_MOCK_WEB3 !== 'false'; // Default to mock

  if (useMock) {
    console.log('[Token Service] Using mock Web3 implementation');
    return mockMintTokens(recipientAddress, amount);
  }

  // In production, you would use real Web3 here:
  // const { ethers } = require('ethers');
  // const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL);
  // ... actual minting logic

  throw new Error('Real Web3 implementation not configured. Set USE_MOCK_WEB3=false and configure RPC_URL, PRIVATE_KEY, TOKEN_CONTRACT_ADDRESS');
}

/**
 * Get token balance (switches between mock and real)
 */
export async function getTokenBalance(address: string): Promise<string> {
  const useMock = process.env.USE_MOCK_WEB3 !== 'false';

  if (useMock) {
    return getMockTokenBalance(address);
  }

  // Real implementation would go here
  throw new Error('Real Web3 implementation not configured');
}
