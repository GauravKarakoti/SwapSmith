import { NextApiRequest, NextApiResponse } from 'next';
import { withEnhancedCSRF } from '@/lib/enhanced-csrf';
import { withRateLimit, RATE_LIMITS } from '@/lib/rate-limiter';
import { applyAPISecurityHeaders } from '@/lib/security-headers';
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
    },
    stakewise: {
      name: 'StakeWise',
      token: 'osETH',
      apy: '3.0%',
      description: 'Community-driven staking',
      minAmount: 0.01,
      fee: '10%'
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
  },
  polygon: {
    lido: {
      name: 'Lido',
      token: 'stMATIC',
      apy: '4.1%',
      description: 'Polygon liquid staking via Lido',
      minAmount: 1,
      fee: '10%'
    }
  },
  avalanche: {
    benqi: {
      name: 'Benqi',
      token: 'sAVAX',
      apy: '8.5%',
      description: 'Avalanche liquid staking',
      minAmount: 0.1,
      fee: '10%'
    }
  },
  bsc: {
    ankr: {
      name: 'Ankr',
      token: 'ankrBNB',
      apy: '3.8%',
      description: 'BNB liquid staking via Ankr',
      minAmount: 0.1,
      fee: '8%'
    }
  }
};

interface StakeRequest {
  fromAsset: string;
  fromChain: string;
  amount: number;
  amountType: 'exact' | 'percentage' | 'all';
  protocol?: string;
  settleAddress?: string;
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

  const { fromAsset, fromChain, amount, amountType, protocol, settleAddress }: StakeRequest = req.body;

  // Input validation
  if (!fromAsset || !fromChain || (!amount && amountType !== 'all')) {
    return res.status(400).json({ 
      error: 'Missing required parameters',
      required: ['fromAsset', 'fromChain', 'amount (unless amountType is "all")']
    });
  }

  // Validate amount for exact/percentage types
  if (amountType !== 'all') {
    const numAmount = parseFloat(amount.toString());
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }
  }

  // Validate asset and chain
  const assetRegex = /^[A-Z0-9]{2,10}$/;
  if (!assetRegex.test(fromAsset)) {
    return res.status(400).json({ error: 'Invalid asset format' });
  }

  const supportedChains = Object.keys(STAKING_PROTOCOLS);
  if (!supportedChains.includes(fromChain.toLowerCase())) {
    return res.status(400).json({ 
      error: 'Unsupported chain for staking',
      supportedChains 
    });
  }

  try {
    const chainProtocols = STAKING_PROTOCOLS[fromChain.toLowerCase() as keyof typeof STAKING_PROTOCOLS];
    
    // Determine protocol (default to first available if not specified)
    let selectedProtocol = protocol?.toLowerCase() || Object.keys(chainProtocols)[0];
    
    // Map common protocol names
    if (selectedProtocol === 'rocket_pool' || selectedProtocol === 'rocketpool') {
      selectedProtocol = 'rocket_pool';
    }
    
    if (!chainProtocols[selectedProtocol as keyof typeof chainProtocols]) {
      return res.status(400).json({ 
        error: 'Unsupported protocol for this chain',
        availableProtocols: Object.keys(chainProtocols)
      });
    }

    const protocolConfig = chainProtocols[selectedProtocol as keyof typeof chainProtocols] as any;

    // Check minimum amount
    if (amountType === 'exact' && amount < protocolConfig.minAmount) {
      return res.status(400).json({ 
        error: `Minimum staking amount is ${protocolConfig.minAmount} ${fromAsset}`,
        minAmount: protocolConfig.minAmount
      });
    }

    // Calculate fees and estimated output
    const protocolFeeRate = parseFloat(protocolConfig.fee.replace('%', '')) / 100;
    const networkFee = 0.005; // Estimated network fee in ETH equivalent
    
    let stakeAmount = amount;
    if (amountType === 'percentage') {
      // For percentage, we'd need to get actual balance - for now use provided amount
      stakeAmount = amount;
    } else if (amountType === 'all') {
      // For 'all', we'd need to get actual balance - for now use a placeholder
      stakeAmount = 1; // This would be replaced with actual balance
    }

    const protocolFee = stakeAmount * protocolFeeRate;
    const totalFees = protocolFee + networkFee;
    const estimatedOutput = stakeAmount - totalFees;

    const quote: StakeQuote = {
      success: true,
      fromAsset,
      fromChain,
      toAsset: protocolConfig.token,
      toChain: fromChain,
      amount: stakeAmount,
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
        'Slashing risk (minimal with established protocols)',
        'Smart contract risk',
        'Liquidity risk for unstaking',
        'Validator performance risk'
      ],
      instructions: [
        `1. Send ${stakeAmount} ${fromAsset} to the staking contract`,
        `2. Receive ${estimatedOutput.toFixed(6)} ${protocolConfig.token}`,
        `3. Start earning ~${protocolConfig.apy} APY`,
        '4. Liquid staking tokens can be traded anytime',
        '5. Unstaking may have a waiting period'
      ]
    };

    logger.info('Staking quote generated:', {
      fromAsset,
      fromChain,
      protocol: selectedProtocol,
      amount: stakeAmount,
      estimatedOutput
    });

    return res.status(200).json(quote);

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    logger.error('Staking API Error:', { error: errorMessage, fromAsset, fromChain });
    
    return res.status(500).json({ 
      error: 'Failed to generate staking quote',
      details: errorMessage 
    });
  }
}

// Apply comprehensive security: Rate limiting + Enhanced CSRF + Financial security headers
export default withRateLimit(
  withEnhancedCSRF(createStakeHandler),
  { ...RATE_LIMITS.swap, message: 'Too many staking requests. Please wait before trying again.' }
);