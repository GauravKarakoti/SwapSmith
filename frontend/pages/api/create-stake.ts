import { NextApiRequest, NextApiResponse } from 'next';
import { withEnhancedCSRF } from '@/lib/enhanced-csrf';
import { withRateLimit, RATE_LIMITS } from '@/lib/rate-limiter';
import logger from '@/lib/logger';

// Staking protocol configurations
const STAKING_PROTOCOLS = {
  ethereum: {
    lido: {
      name: 'Lido',
      token: 'stETH',
      apy: '3.2%',
      description: 'Most popular liquid staking protocol',
      minAmount: 0.01,
      fee: '10%'
    },
    rocket_pool: {
      name: 'Rocket Pool',
      token: 'rETH',
      apy: '3.1%',
      description: 'Decentralized liquid staking',
      minAmount: 0.01,
      fee: '15%'
    }
  },
  solana: {
    marinade: {
      name: 'Marinade',
      token: 'mSOL',
      apy: '7.2%',
      description: 'Leading Solana liquid staking',
      minAmount: 0.1,
      fee: '6%'
    }
  }
};

interface StakeRequest {
  fromAsset: string;
  fromChain: string;
  amount: number;
  amountType: 'exact' | 'percentage' | 'all';
  protocol?: string;
}

interface StakeQuote {
  success: boolean;
  fromAsset: string;
  fromChain: string;
  toAsset: string;
  toChain: string;
  amount: number;
  amountType: string;
  protocol: {
    name: string;
    apy: string;
    fee: string;
    description: string;
  };
  estimatedOutput: number;
  fees: {
    protocolFee: number;
    networkFee: number;
    total: number;
  };
  timeToStake: string;
  risks: string[];
  instructions: string[];
}

async function createStakeHandler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { fromAsset, fromChain, amount, amountType, protocol }: StakeRequest = req.body;

  if (!fromAsset || !fromChain || (!amount && amountType !== 'all')) {
    return res.status(400).json({
      error: 'Missing required parameters'
    });
  }

  try {
    const chainProtocols =
      STAKING_PROTOCOLS[fromChain.toLowerCase() as keyof typeof STAKING_PROTOCOLS];

    if (!chainProtocols) {
      return res.status(400).json({
        error: 'Unsupported chain'
      });
    }

    const selectedProtocol =
      protocol?.toLowerCase() || Object.keys(chainProtocols)[0];

    const protocolConfig =
      chainProtocols[selectedProtocol as keyof typeof chainProtocols] as any;

    if (!protocolConfig) {
      return res.status(400).json({
        error: 'Unsupported protocol'
      });
    }

    const protocolFeeRate =
      parseFloat(protocolConfig.fee.replace('%', '')) / 100;

    const networkFee = 0.005;

    const protocolFee = amount * protocolFeeRate;
    const totalFees = protocolFee + networkFee;
    const estimatedOutput = amount - totalFees;

    const quote: StakeQuote = {
      success: true,
      fromAsset,
      fromChain,
      toAsset: protocolConfig.token,
      toChain: fromChain,
      amount,
      amountType,
      protocol: {
        name: protocolConfig.name,
        apy: protocolConfig.apy,
        fee: protocolConfig.fee,
        description: protocolConfig.description
      },
      estimatedOutput,
      fees: {
        protocolFee,
        networkFee,
        total: totalFees
      },
      timeToStake: '~2-5 minutes',
      risks: [
        'Smart contract risk',
        'Validator slashing risk',
        'Liquidity risk'
      ],
      instructions: [
        `Send ${amount} ${fromAsset} to the staking contract`,
        `Receive ${estimatedOutput.toFixed(6)} ${protocolConfig.token}`,
        `Earn ~${protocolConfig.apy} APY`
      ]
    };

    logger.info('Staking quote generated', { ...quote });

    return res.status(200).json(quote);

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal error';

    logger.error('Staking API error', { message });

    return res.status(500).json({
      error: 'Failed to generate staking quote'
    });
  }
}

export default withRateLimit(
  withEnhancedCSRF(createStakeHandler),
  { ...RATE_LIMITS.swap }
);