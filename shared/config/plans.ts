/**
 * Plan limits configuration for SwapSmith
 * Controls daily usage limits for Terminal and Chatbox features
 */

export type Plan = 'free' | 'premium' | 'pro';

export interface PlanConfig {
  name: string;
  displayName: string;
  description: string;
  dailyChatLimit: number;       // -1 means unlimited
  dailyTerminalLimit: number;   // -1 means unlimited
  coinsCost: number;            // SwapSmith coins required for 30-day subscription
  durationDays: number;
  features: string[];
  color: string;
  badge?: string;
}

export const PLAN_CONFIGS: Record<Plan, PlanConfig> = {
  free: {
    name: 'free',
    displayName: 'Free',
    description: 'Get started with basic SwapSmith features',
    dailyChatLimit: 20,
    dailyTerminalLimit: 5,
    coinsCost: 0,
    durationDays: 0,
    features: [
      '20 chat messages/day',
      '5 terminal executions/day',
      'Basic swap functionality',
      'Public market data',
    ],
    color: 'text-gray-400',
  },
  premium: {
    name: 'premium',
    displayName: 'Premium',
    description: 'More power for active traders',
    dailyChatLimit: 200,
    dailyTerminalLimit: 50,
    coinsCost: 500,
    durationDays: 30,
    features: [
      '200 chat messages/day',
      '50 terminal executions/day',
      'Priority response speed',
      'Ad-free experience',
      'Advanced analytics',
      'Export transaction history',
    ],
    color: 'text-blue-400',
    badge: 'Popular',
  },
  pro: {
    name: 'pro',
    displayName: 'Pro',
    description: 'Unlimited power for professional traders',
    dailyChatLimit: -1,
    dailyTerminalLimit: -1,
    coinsCost: 1500,
    durationDays: 30,
    features: [
      'Unlimited chat messages',
      'Unlimited terminal executions',
      'Highest priority processing',
      'Ad-free experience',
      'All Premium features',
      'Early access to new features',
      'Dedicated support',
    ],
    color: 'text-purple-400',
    badge: 'Best Value',
  },
};

/**
 * Get the limit for a specific plan and feature
 */
export function getPlanLimit(plan: Plan, feature: 'chat' | 'terminal'): number {
  const config = PLAN_CONFIGS[plan];
  return feature === 'chat' ? config.dailyChatLimit : config.dailyTerminalLimit;
}

/**
 * Check if a given usage count exceeds the plan limit
 */
export function isLimitExceeded(plan: Plan, feature: 'chat' | 'terminal', currentCount: number): boolean {
  const limit = getPlanLimit(plan, feature);
  if (limit === -1) return false; // unlimited
  return currentCount >= limit;
}

/**
 * Format limit display (returns "Unlimited" for -1)
 */
export function formatLimit(limit: number): string {
  return limit === -1 ? 'Unlimited' : limit.toString();
}
