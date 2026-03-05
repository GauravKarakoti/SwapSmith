import { NextResponse } from 'next/server';
import { getAgentReputation } from '@/lib/database';

export const dynamic = 'force-dynamic'; // Ensure allow dynamic updates

/**
 * GET /api/agent/reputation
 * Returns the agent's trust score based on successful swaps.
 */
export async function GET() {
  try {
    const stats = await getAgentReputation();
    
    return NextResponse.json({
      success: true,
      data: {
        score: stats.successRate, // Trust Score (percentage)
        totalSwaps: stats.totalSwaps,
        successfulSwaps: stats.successCount,
        label: getReputationLabel(stats.successRate)
      }
    });
  } catch (error) {
    console.error('[Agent Reputation API] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch reputation data' },
      { status: 500 }
    );
  }
}

function getReputationLabel(score: number): string {
  if (score >= 98) return 'Elite';
  if (score >= 95) return 'Excellent';
  if (score >= 90) return 'Very Good';
  if (score >= 80) return 'Good';
  return 'Developing';
}
