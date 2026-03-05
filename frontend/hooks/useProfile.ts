/**
 * Custom hooks for Profile functionality
 * Separates profile data fetching and user operations from UI components
 */

import { useState, useCallback } from 'react';

export interface EmailNotificationPrefs {
  enabled: boolean;
  walletReminders: boolean;
  priceAlerts: boolean;
  generalUpdates: boolean;
  frequency: 'daily' | 'weekly';
}

export interface UserPreferences {
  soundEnabled: boolean;
  autoConfirmSwaps: boolean;
  currency: string;
  theme?: 'light' | 'dark' | 'system';
}

export interface SwapHistoryItem {
  id: string;
  userId: string;
  walletAddress?: string;
  depositCoin?: string;
  settleCoin?: string;
  depositAmount?: string;
  settleAmount?: string;
  status?: string;
  createdAt: string;
  fromAsset: string;
  toAsset: string;
  fromAmount: string;
  fromNetwork?: string;
  toNetwork?: string;
  sideshiftOrderId?: string;
}

/**
 * Hook for managing user profile data
 */
export function useUserProfile() {
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/user/profile');
      if (!response.ok) throw new Error('Failed to fetch profile');
      const data = await response.json();
      setProfile(data);
      setError(null);
    } catch (err) {
      setError('Failed to load profile');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const updateProfile = useCallback(async (updates: Partial<Record<string, unknown>>) => {
    try {
      const response = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!response.ok) throw new Error('Failed to update profile');
      const updated = await response.json();
      setProfile(updated);
      return updated;
    } catch (err) {
      console.error('Failed to update profile:', err);
      throw err;
    }
  }, []);

  return { profile, loading, error, fetchProfile, updateProfile };
}

/**
 * Hook for managing user swap history
 */
export function useSwapHistory() {
  const [swaps, setSwaps] = useState<SwapHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSwapHistory = useCallback(async (limit: number = 50) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/user/swap-history?limit=${limit}`);
      if (!response.ok) throw new Error('Failed to fetch swap history');
      const data = await response.json();
      setSwaps(data);
      setError(null);
    } catch (err) {
      setError('Failed to load swap history');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const downloadSwapHistory = useCallback(async (format: 'csv' | 'json' = 'csv') => {
    try {
      const response = await fetch(`/api/user/swap-history/export?format=${format}`);
      if (!response.ok) throw new Error('Failed to download history');
      return await response.blob();
    } catch (err) {
      console.error('Failed to download:', err);
      throw err;
    }
  }, []);

  return { swaps, loading, error, fetchSwapHistory, downloadSwapHistory };
}

/**
 * Hook for managing user preferences
 */
export function useUserPreferences() {
  const [preferences, setPreferences] = useState<UserPreferences>({
    soundEnabled: true,
    autoConfirmSwaps: false,
    currency: 'USD',
    theme: 'system',
  });
  const [loading, setLoading] = useState(true);

  const fetchPreferences = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/user/preferences');
      if (!response.ok) throw new Error('Failed to fetch preferences');
      const data = await response.json();
      setPreferences(data);
    } catch (err) {
      console.error('Failed to fetch preferences:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const updatePreferences = useCallback(async (updates: Partial<UserPreferences>) => {
    try {
      const newPrefs = { ...preferences, ...updates };
      const response = await fetch('/api/user/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPrefs),
      });
      if (!response.ok) throw new Error('Failed to update preferences');
      setPreferences(newPrefs);
      return newPrefs;
    } catch (err) {
      console.error('Failed to update preferences:', err);
      throw err;
    }
  }, [preferences]);

  return { preferences, loading, fetchPreferences, updatePreferences };
}

/**
 * Hook for managing email notification preferences
 */
export function useEmailNotifications() {
  const [emailPrefs, setEmailPrefs] = useState<EmailNotificationPrefs>({
    enabled: true,
    walletReminders: true,
    priceAlerts: true,
    generalUpdates: true,
    frequency: 'daily',
  });
  const [loading, setLoading] = useState(true);

  const fetchEmailPreferences = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/user/email-preferences');
      if (!response.ok) throw new Error('Failed to fetch email preferences');
      const data = await response.json();
      setEmailPrefs(data);
    } catch (err) {
      console.error('Failed to fetch email preferences:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const updateEmailPreferences = useCallback(
    async (updates: Partial<EmailNotificationPrefs>) => {
      try {
        const newPrefs = { ...emailPrefs, ...updates };
        const response = await fetch('/api/user/email-preferences', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newPrefs),
        });
        if (!response.ok) throw new Error('Failed to update email preferences');
        setEmailPrefs(newPrefs);
        return newPrefs;
      } catch (err) {
        console.error('Failed to update email preferences:', err);
        throw err;
      }
    },
    [emailPrefs]
  );

  return { emailPrefs, loading, fetchEmailPreferences, updateEmailPreferences };
}

/**
 * Hook for managing user password
 */
export function usePasswordManagement() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updatePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/user/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update password');
      }

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update password';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { updatePassword, loading, error };
}
