import { authenticatedFetch } from './api-client';

/**
 * Rewards Service - Centralized service for tracking user rewards
 */

export interface RewardResult {
  success: boolean;
  message: string;
  pointsEarned?: number;
  tokensEarned?: string;
  alreadyClaimed?: boolean;
}

/**
 * Track daily login and award points
 */
export async function trackDailyLogin(): Promise<RewardResult> {
  try {
    const response = await authenticatedFetch('/api/rewards/daily-login', {
      method: 'POST',
    });
    
    if (!response.ok) {
      return { success: false, message: 'Failed to track daily login' };
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error tracking daily login:', error);
    return { success: false, message: 'Error tracking daily login' };
  }
}

/**
 * Track wallet connection and award points (one-time)
 */
export async function trackWalletConnection(walletAddress: string): Promise<RewardResult> {
  try {
    const response = await authenticatedFetch('/api/rewards/wallet-connected', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ walletAddress }),
    });
    
    if (!response.ok) {
      return { success: false, message: 'Failed to track wallet connection' };
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error tracking wallet connection:', error);
    return { success: false, message: 'Error tracking wallet connection' };
  }
}

/**
 * Track terminal usage and award points (one-time)
 */
export async function trackTerminalUsage(): Promise<RewardResult> {
  try {
    const response = await authenticatedFetch('/api/rewards/terminal-used', {
      method: 'POST',
    });
    
    if (!response.ok) {
      return { success: false, message: 'Failed to track terminal usage' };
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error tracking terminal usage:', error);
    return { success: false, message: 'Error tracking terminal usage' };
  }
}

/**
 * Track notification enablement and award points (one-time)
 */
export async function trackNotificationEnabled(): Promise<RewardResult> {
  try {
    const response = await authenticatedFetch('/api/rewards/notification-enabled', {
      method: 'POST',
    });
    
    if (!response.ok) {
      return { success: false, message: 'Failed to track notification enable' };
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error tracking notification enable:', error);
    return { success: false, message: 'Error tracking notification enable' };
  }
}

/**
 * Show a toast notification for reward earned
 */
export function showRewardNotification(result: RewardResult) {
  if (result.success && result.pointsEarned) {
    // You can integrate with a toast library here
    console.log(`🎉 ${result.message} You earned ${result.pointsEarned} points!`);
    
    // Dispatch custom event for UI to listen
    window.dispatchEvent(new CustomEvent('rewardEarned', { 
      detail: { 
        message: result.message,
        points: result.pointsEarned,
        tokens: result.tokensEarned 
      } 
    }));
  }
}

/**
 * Initialize reward tracking on app load
 */
export async function initializeRewards() {
  // Track daily login automatically when user opens the app
  const loginResult = await trackDailyLogin();
  if (loginResult.success && !loginResult.alreadyClaimed) {
    showRewardNotification(loginResult);
  }
}
