/**
 * Real Sepolia blockchain token service.
 * Calls rewardUser() on the deployed SwapSmith (SMTH) ERC20 contract
 * using the owner wallet private key stored in server-side env vars.
 *
 * Required env vars (add to frontend/.env.local):
 *   REWARD_TOKEN_ADDRESS            – deployed contract address on Sepolia
 *   REWARD_TOKEN_OWNER_PRIVATE_KEY  – deployer/owner wallet private key (0x…)
 *   SEPOLIA_RPC_URL                 – Alchemy or Infura Sepolia HTTPS endpoint
 */

import {
  createWalletClient,
  createPublicClient,
  http,
  parseEther,
  isAddress,
} from 'viem'
import { sepolia } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'

// Minimal ABI – only the functions we call from the backend.
const REWARD_TOKEN_ABI = [
  {
    name: 'rewardUser',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'user',   type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const

interface MintResult {
  txHash: string
  blockNumber: number
  success: boolean
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getConfig() {
  const contractAddress = process.env.REWARD_TOKEN_ADDRESS ?? process.env.NEXT_PUBLIC_REWARD_TOKEN_ADDRESS
  const privateKey      = process.env.REWARD_TOKEN_OWNER_PRIVATE_KEY
  const rpcUrl          = process.env.SEPOLIA_RPC_URL

  if (!contractAddress || !privateKey || !rpcUrl) {
    throw new Error(
      'Missing required env vars: REWARD_TOKEN_ADDRESS, ' +
      'REWARD_TOKEN_OWNER_PRIVATE_KEY, SEPOLIA_RPC_URL. ' +
      'Add them to frontend/.env.local'
    )
  }

  if (!isAddress(contractAddress)) {
    throw new Error(`REWARD_TOKEN_ADDRESS is not a valid address: ${contractAddress}`)
  }

  // Normalise private key – ensure it starts with 0x
  const normKey = privateKey.startsWith('0x')
    ? privateKey as `0x${string}`
    : (`0x${privateKey}` as `0x${string}`)

  const account = privateKeyToAccount(normKey)

  const walletClient = createWalletClient({
    account,
    chain: sepolia,
    transport: http(rpcUrl),
  })

  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(rpcUrl),
  })

  return { account, walletClient, publicClient, contractAddress: contractAddress as `0x${string}` }
}

// ---------------------------------------------------------------------------
// mintTokens – calls rewardUser() on Sepolia
// ---------------------------------------------------------------------------

/**
 * Send SMTH tokens to a recipient by calling rewardUser() on Sepolia.
 * @param recipientAddress  User's MetaMask wallet address (0x…)
 * @param amount            Token amount as a decimal string (e.g. "10.5")
 */
export async function mintTokens(
  recipientAddress: string,
  amount: string
): Promise<MintResult> {
  if (!isAddress(recipientAddress)) {
    throw new Error(`Invalid recipient address: ${recipientAddress}`)
  }

  const amountFloat = parseFloat(amount)
  if (isNaN(amountFloat) || amountFloat <= 0) {
    throw new Error(`Invalid token amount: ${amount}`)
  }

  const { walletClient, publicClient, contractAddress } = getConfig()

  console.log(
    `[Token Service] Sending ${amount} SMTH to ${recipientAddress} ` +
    `via contract ${contractAddress} on Sepolia`
  )

  // Send transaction
  const hash = await walletClient.writeContract({
    address: contractAddress,
    abi: REWARD_TOKEN_ABI,
    functionName: 'rewardUser',
    args: [recipientAddress as `0x${string}`, parseEther(amount)],
  })

  console.log(`[Token Service] Transaction submitted: ${hash}`)

  // Wait for confirmation (1 block)
  const receipt = await publicClient.waitForTransactionReceipt({
    hash,
    confirmations: 1,
  })

  const success = receipt.status === 'success'
  console.log(
    `[Token Service] Transaction ${success ? 'confirmed ✅' : 'failed ❌'} ` +
    `| block ${receipt.blockNumber} | tx ${hash}`
  )

  return {
    txHash:      hash,
    blockNumber: Number(receipt.blockNumber),
    success,
  }
}

// ---------------------------------------------------------------------------
// getTokenBalance – read SMTH balance for any address
// ---------------------------------------------------------------------------

export async function getTokenBalance(address: string): Promise<string> {
  if (!isAddress(address)) return '0'

  try {
    const { publicClient, contractAddress } = getConfig()

    const raw = await publicClient.readContract({
      address: contractAddress,
      abi: REWARD_TOKEN_ABI,
      functionName: 'balanceOf',
      args: [address as `0x${string}`],
    })

    // Convert from wei (18 decimals) to human-readable
    const human = Number(raw) / 1e18
    return human.toFixed(6)
  } catch {
    return '0'
  }
}
