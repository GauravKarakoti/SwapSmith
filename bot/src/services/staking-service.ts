import { ethers } from 'ethers';
import { getStakingAbi } from '../config/staking-abis';
import {
  createStakeOrder,
  updateStakeOrderSwapStatus,
  updateStakeOrderStakeStatus,
  getStakeOrder,
  type StakeOrder,
} from './database';
import logger from './logger';

/**
 * Interface for staking execution context
 */
export interface StakingContext {
  sideshiftOrderId: string;
  walletAddress: string;
  stakingProtocol: string;
  stakingAsset: string;
  stakingNetwork: string;
  amount: string;
  rpcUrl?: string;
  privateKey?: string;
}

/**
 * Mapping of staking protocols to their contract addresses per chain
 */
const STAKING_ADDRESSES: Record<string, Record<string, string>> = {
  Lido: {
    ethereum: '0xae7ab96520de3a18e5e111b5eaab095312d7fe84', // stETH contract
  },
  RocketPool: {
    ethereum: '0xc8c0cf13231b0c5e10396edc7e236255253956a7', // rETH contract
  },
  Frax: {
    ethereum: '0xac3e0cda7d6ff902f7b7c3f7db198844796341bc', // sfrxETH contract
  },
  Coinbase: {
    ethereum: '0xbe9895146f7bb532eceaef57b02906b1708f8ebb', // cbETH contract
  },
  Stader: {
    ethereum: '0xa35b76e4935449e33c56ab0b5694865568bde860', // ETHx contract
  },
  Marinade: {
    solana: 'mSoLzYCxHdgf1NttzpPrY8JMUaAsdNYBVw7nWUL9xVb', // mSOL mint
  },
};

/**
 * Create a swap and stake order in the database
 */
export async function createSwapAndStakeOrder(
  telegramId: number,
  sideshiftOrderId: string,
  fromAsset: string,
  fromNetwork: string,
  fromAmount: string,
  toAsset: string,
  toNetwork: string,
  stakingProtocol: string,
  stakerAddress: string,
  estimatedApy?: number
): Promise<StakeOrder> {
  return await createStakeOrder(
    telegramId,
    sideshiftOrderId,
    fromAsset,
    fromNetwork,
    fromAmount,
    toAsset,
    toNetwork,
    stakingProtocol,
    stakerAddress,
    estimatedApy
  );
}

/**
 * Execute staking transaction after a swap completes
 * This will be called by the order monitor when a swap settles
 */
export async function executeStaking(
  context: StakingContext,
  swapSettleAmount: string
): Promise<string | null> {
  try {
    logger.info('Executing staking for:', context);

    // Get staking contract address
    const stakingAddress = STAKING_ADDRESSES[context.stakingProtocol]?.[context.stakingNetwork.toLowerCase()];
    if (!stakingAddress) {
      throw new Error(
        `No staking address found for ${context.stakingProtocol} on ${context.stakingNetwork}`
      );
    }

    // For Solana, we would implement this differently
    if (context.stakingNetwork.toLowerCase() === 'solana') {
      return await executeStakingSolana(context, swapSettleAmount);
    }

    // For EVM chains
    return await executeStakingEVM(context, stakingAddress, swapSettleAmount);
  } catch (error) {
    logger.error('Staking execution error:', error);
    // Update database with error
    await updateStakeOrderStakeStatus(
      context.sideshiftOrderId,
      'failed'
    );
    throw error;
  }
}

/**
 * Execute staking on EVM chains
 */
async function executeStakingEVM(
  context: StakingContext,
  stakingAddress: string,
  swapSettleAmount: string
): Promise<string | null> {
  try {
    // Get the RPC URL from environment or context
    const rpcUrl = context.rpcUrl || process.env[`${context.stakingNetwork.toUpperCase()}_RPC_URL`];
    if (!rpcUrl) {
      throw new Error(`RPC URL not found for ${context.stakingNetwork}`);
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    let signer;

    // If private key is provided, use it to sign transactions
    if (context.privateKey) {
      signer = new ethers.Wallet(context.privateKey, provider);
    } else {
      // Otherwise, just return the transaction data for frontend signing
      return await generateStakingTransactionData(
        context,
        stakingAddress,
        swapSettleAmount
      );
    }

    // Get the staking ABI
    const abi = getStakingAbi(context.stakingProtocol);

    // Create contract instance
    const contract = new ethers.Contract(stakingAddress, abi, signer);

    // Execute staking based on protocol
    let txHash = await executeStakingByProtocol(
      contract,
      context.stakingProtocol,
      swapSettleAmount,
      signer
    );

    // Update database with transaction hash
    await updateStakeOrderStakeStatus(
      context.sideshiftOrderId,
      'processing',
      txHash
    );

    return txHash;
  } catch (error) {
    logger.error('EVM staking error:', error);
    throw error;
  }
}

/**
 * Generate transaction data for staking (to be signed by frontend)
 */
async function generateStakingTransactionData(
  context: StakingContext,
  stakingAddress: string,
  swapSettleAmount: string
): Promise<string | null> {
  try {
    const abi = getStakingAbi(context.stakingProtocol);
    const iface = new ethers.Interface(abi);

    let encodedData: string;
    const amount = ethers.parseEther(swapSettleAmount);

    // Encode function call based on protocol
    switch (context.stakingProtocol) {
      case 'Lido':
        // submit(address _referral) - eth value = amount
        encodedData = iface.encodeFunctionData('submit', [context.walletAddress]);
        break;

      case 'RocketPool':
        // deposit()
        encodedData = iface.encodeFunctionData('deposit', []);
        break;

      case 'Frax':
        // depositAndStake()
        encodedData = iface.encodeFunctionData('depositAndStake', []);
        break;

      case 'Coinbase':
        // mint()
        encodedData = iface.encodeFunctionData('mint', []);
        break;

      case 'Stader':
        // deposit(address _receiver)
        encodedData = iface.encodeFunctionData('deposit', [context.walletAddress]);
        break;

      default:
        throw new Error(`No encoding for protocol: ${context.stakingProtocol}`);
    }

    // Return JSON string with transaction data
    return JSON.stringify({
      to: stakingAddress,
      value: amount.toString(),
      data: encodedData,
    });
  } catch (error) {
    logger.error('Error generating staking transaction data:', error);
    throw error;
  }
}

/**
 * Execute staking by protocol
 */
async function executeStakingByProtocol(
  contract: ethers.Contract,
  protocol: string,
  amount: string,
  signer: ethers.Signer
): Promise<string> {
  const amountWei = ethers.parseEther(amount);
  let tx;

  switch (protocol) {
    case 'Lido':
      // submit(address) with ETH sent as value
      tx = await contract.submit(await signer.getAddress(), {
        value: amountWei,
      });
      break;

    case 'RocketPool':
      // deposit() with ETH sent as value
      tx = await contract.deposit({
        value: amountWei,
      });
      break;

    case 'Frax':
      // depositAndStake() with ETH sent as value
      tx = await contract.depositAndStake({
        value: amountWei,
      });
      break;

    case 'Coinbase':
      // mint() with ETH sent as value
      tx = await contract.mint({
        value: amountWei,
      });
      break;

    case 'Stader':
      // deposit(address) with ETH sent as value
      tx = await contract.deposit(await signer.getAddress(), {
        value: amountWei,
      });
      break;

    default:
      throw new Error(`Protocol not implemented: ${protocol}`);
  }

  // Wait for confirmation
  const receipt = await tx.wait();
  return receipt?.hash || tx.hash;
}

/**
 * Execute staking on Solana
 */
async function executeStakingSolana(
  context: StakingContext,
  swapSettleAmount: string
): Promise<string | null> {
  try {
    // This would require Solana wallet integration
    // For now, return null and implement in a separate Solana service
    logger.info('Solana staking - would be executed via frontend wallet', context);
    return null;
  } catch (error) {
    logger.error('Solana staking error:', error);
    throw error;
  }
}

/**
 * Monitor and update staking order status
 */
export async function monitorStakingOrder(sideshiftOrderId: string): Promise<StakeOrder | null> {
  try {
    const order = await getStakeOrder(sideshiftOrderId);
    if (!order) return null;

    // If staking is pending, check transaction status
    if (order.stakeStatus === 'processing' && order.stakeTxHash) {
      // Check transaction receipt
      logger.info(`Monitoring staking tx: ${order.stakeTxHash}`);

      // This would check the actual transaction status
      // For now, we update it manually via the order monitor
    }

    return order;
  } catch (error) {
    logger.error('Error monitoring staking order:', error);
    return null;
  }
}

/**
 * Get estimated APY for a staking protocol and asset
 */
export async function getEstimatedAPY(
  protocol: string,
  asset: string = 'ETH'
): Promise<number> {
  // These are approximate values - in production, fetch from DeFi Llama or similar
  const apyMap: Record<string, Record<string, number>> = {
    Lido: { ETH: 3.5 },
    RocketPool: { ETH: 3.8 },
    Frax: { ETH: 3.6 },
    Coinbase: { ETH: 3.2 },
    Stader: { ETH: 3.4 },
    Marinade: { SOL: 7.5 },
  };

  return apyMap[protocol]?.[asset.toUpperCase()] || 3.5;
}

export default {
  createSwapAndStakeOrder,
  executeStaking,
  monitorStakingOrder,
  getEstimatedAPY,
};
