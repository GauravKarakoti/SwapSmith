import { ethers } from 'ethers';
import { resolveNickname } from './database';

// Initialize Ethereum provider for ENS resolution
const provider = new ethers.JsonRpcProvider('https://eth.llamarpc.com'); // Public RPC for ENS

// Supported naming service domains
const NAMING_SERVICES = {
  ENS: ['.eth'],
  LENS: ['.lens'],
  UNSTOPPABLE: [
    '.crypto', '.nft', '.blockchain', '.bitcoin', '.coin', '.wallet',
    '.888', '.dao', '.x', '.zil', '.polygon'
  ]
};

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
  try {
    // Placeholder for Lens Protocol resolution
    // In production, integration with Lens API/SDK is required
    console.log(`Lens resolution requested for: ${lensHandle}`);
    return null;
  } catch (error) {
    console.error('Lens resolution error:', error);
    return null;
  }
}

export async function resolveUnstoppableDomain(domain: string): Promise<string | null> {
  try {
    // Unstoppable Domains are stored on Polygon
    const polygonProvider = new ethers.JsonRpcProvider('https://polygon-rpc.com');
    
    // Try to resolve using the provider's built-in resolution (standard EIP-137)
    const address = await polygonProvider.resolveName(domain);
    return address;
  } catch (error) {
    console.error('Unstoppable Domain resolution error:', error);
    return null;
  }
}

export function isNamingService(input: string): boolean {
  if (!input) return false;
  const lowerInput = input.toLowerCase();
  
  // Check ENS
  if (NAMING_SERVICES.ENS.some(suffix => lowerInput.endsWith(suffix))) {
    return true;
  }
  
  // Check Lens
  if (NAMING_SERVICES.LENS.some(suffix => lowerInput.endsWith(suffix))) {
    return true;
  }
  
  // Check Unstoppable Domains
  if (NAMING_SERVICES.UNSTOPPABLE.some(suffix => lowerInput.endsWith(suffix))) {
    return true;
  }
  
  return false;
}

export async function resolveAddress(telegramId: number, input: string): Promise<{ address: string | null, type: 'nickname' | 'ens' | 'lens' | 'unstoppable' | 'raw', originalInput?: string }> {
  const trimmedInput = input.trim();
  
  // 1. Check if it's a nickname
  const nicknameAddress = await resolveNickname(telegramId, trimmedInput);
  if (nicknameAddress) {
    return { address: nicknameAddress, type: 'nickname', originalInput: trimmedInput };
  }

  // 2. Check if it's an ENS name (.eth)
  if (NAMING_SERVICES.ENS.some(suffix => trimmedInput.toLowerCase().endsWith(suffix))) {
    const ensAddress = await resolveENS(trimmedInput);
    if (ensAddress) {
      return { address: ensAddress, type: 'ens', originalInput: trimmedInput };
    }
    return { address: null, type: 'ens', originalInput: trimmedInput };
  }

  // 3. Check if it's a Lens handle (.lens)
  if (NAMING_SERVICES.LENS.some(suffix => trimmedInput.toLowerCase().endsWith(suffix))) {
    const lensAddress = await resolveLens(trimmedInput);
    if (lensAddress) {
      return { address: lensAddress, type: 'lens', originalInput: trimmedInput };
    }
    return { address: null, type: 'lens', originalInput: trimmedInput };
  }

  // 4. Check if it's an Unstoppable Domain
  if (NAMING_SERVICES.UNSTOPPABLE.some(suffix => trimmedInput.toLowerCase().endsWith(suffix))) {
    const unstoppableAddress = await resolveUnstoppableDomain(trimmedInput);
    if (unstoppableAddress) {
      return { address: unstoppableAddress, type: 'unstoppable', originalInput: trimmedInput };
    }
    return { address: null, type: 'unstoppable', originalInput: trimmedInput };
  }

  // 5. Assume it's a raw address
  return { address: trimmedInput, type: 'raw' };
}