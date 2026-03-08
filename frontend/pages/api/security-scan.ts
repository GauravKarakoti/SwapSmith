import { NextApiRequest, NextApiResponse } from 'next';
import { performSecurityScan } from '@/utils/security-scanner';
import { csrfGuard } from '@/lib/csrf';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // CSRF Protection
  if (!csrfGuard(req, res)) {
    return;
  }

  const {
    fromToken,
    fromNetwork,
    toToken,
    toNetwork,
    fromAmount,
    contractAddress,
    userAddress,
    userId
  } = req.body;

  if (!fromToken || !fromNetwork || !toToken || !toNetwork || !fromAmount) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  try {
    // Perform the security scan
    const result = await performSecurityScan(
      fromToken,
      fromNetwork,
      toToken,
      toNetwork,
      fromAmount,
      contractAddress || '',
      userAddress || ''
    );

    // Return the security scan result
    res.status(200).json({
      success: true,
      scanResult: result,
      metadata: {
        scannedAt: new Date().toISOString(),
        fromToken,
        fromNetwork,
        toToken,
        toNetwork,
        userId: userId || 'anonymous'
      }
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    console.error('Security scan error:', errorMessage);
    
    res.status(500).json({
      success: false,
      error: errorMessage,
      scanResult: {
        passed: false,
        riskScore: 100,
        riskLevel: 'critical' as const,
        checks: {},
        overallMessage: 'Security scan failed',
        flags: ['SCAN_ERROR'],
        recommendations: ['Please try again later']
      }
    });
  }
}
