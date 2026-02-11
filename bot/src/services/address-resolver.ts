import { ethers } from 'ethers';
import { resolveNickname } from './database';

// Initialize Ethereum provider for ENS resolution
const provider = new ethers.JsonRpcProvider('https://eth.llamarpc.com'); // Public RPC for ENS

export async function resolveENS(ensName: string): Promise<string | null> {
  try {
    const address = await provider.resolveName(ensName);
    return address;
  } catch (error) {
    console.error('ENS resolution error:', error);
    return null;
  }
}

export async function resolveLens(lensHandle: string): Promise<string | null> {
  // Lens Protocol resolution (simplified - would need Lens SDK or API)
  // For now, return null as Lens resolution is more complex
  // TODO: Implement Lens resolution if needed
  return null;
}

export async function resolveAddress(telegramId: number, input: string): Promise<{ address: string | null, type: 'nickname' | 'ens' | 'lens' | 'raw' }> {
  // 1. Check if it's a nickname
  const nicknameAddress = await resolveNickname(telegramId, input);
  if (nicknameAddress) {
    return { address: nicknameAddress, type: 'nickname' };
  }

  // 2. Check if it's an ENS name
  if (input.endsWith('.eth')) {
    const ensAddress = await resolveENS(input);
    if (ensAddress) {
      return { address: ensAddress, type: 'ens' };
    }
  }

  // 3. Check if it's a Lens handle (e.g., vitalik.lens)
  if (input.endsWith('.lens')) {
    const lensAddress = await resolveLens(input);
    if (lensAddress) {
      return { address: lensAddress, type: 'lens' };
    }
  }

  // 4. Assume it's a raw address
  return { address: input, type: 'raw' };
}
