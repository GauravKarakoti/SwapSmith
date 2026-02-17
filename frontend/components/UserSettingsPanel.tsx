/**
 * UserSettingsPanel Component
 * 
 * Display and edit user preferences stored in the database
 * Integrates with Firebase authentication and Neon PostgreSQL
 */

'use client';

import { useState, useEffect } from 'react';
import { useUserSettings } from '@/hooks/useCachedData';
import { useAuth } from '@/hooks/useAuth';
import { invalidateCache } from '@/lib/cache-utils';

export function UserSettingsPanel() {
  const { user } = useAuth();
  const { data, isLoading, refetch } = useUserSettings(user?.uid);
  
  const [settings, setSettings] = useState({
    theme: 'dark',
    slippageTolerance: 0.5,
    notificationsEnabled: true,
    defaultFromAsset: '',
    defaultToAsset: '',
    emailNotifications: false,
    telegramNotifications: false,
  });
  
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

  useEffect(() => {
    if (data?.preferences) {
      try {
        const parsedPrefs = typeof data.preferences === 'string' 
          ? JSON.parse(data.preferences) 
          : data.preferences;
        setSettings({
          theme: parsedPrefs.theme || 'dark',
          slippageTolerance: parsedPrefs.slippageTolerance || 0.5,
          notificationsEnabled: parsedPrefs.notificationsEnabled ?? true,
          defaultFromAsset: parsedPrefs.defaultFromAsset || '',
          defaultToAsset: parsedPrefs.defaultToAsset || '',
          emailNotifications: parsedPrefs.emailNotifications ?? false,
          telegramNotifications: parsedPrefs.telegramNotifications ?? false,
        });
      } catch (err) {
        console.error('Failed to parse preferences:', err);
      }
    }
  }, [data]);

  const handleSave = async () => {
    if (!user?.uid) return;

    setIsSaving(true);
    setSaveStatus('idle');

    try {
      const response = await fetch('/api/user/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          preferences: JSON.stringify(settings),
          emailNotifications: JSON.stringify({ enabled: settings.emailNotifications }),
        }),
      });

      if (!response.ok) throw new Error('Failed to save settings');

      setSaveStatus('success');
      invalidateCache(`/api/user/settings?userId=${user.uid}`);
      
      setTimeout(() => {
        refetch();
        setSaveStatus('idle');
      }, 2000);
    } catch (error) {
      console.error('Error saving settings:', error);
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  };

  if (!user) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 text-center">
        <p className="text-gray-400">Please sign in to view settings</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="animate-pulse space-y-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-12 bg-gray-700 rounded" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <h2 className="text-2xl font-bold mb-6">User Settings</h2>

      <div className="space-y-6">
        {/* Theme */}
        <div>
          <label className="block text-sm font-medium mb-2">Theme</label>
          <select
            value={settings.theme}
            onChange={(e) => setSettings({ ...settings, theme: e.target.value })}
            className="w-full px-4 py-2 bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="dark">Dark</option>
            <option value="light">Light</option>
            <option value="auto">Auto</option>
          </select>
        </div>

        {/* Slippage Tolerance */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Slippage Tolerance: {settings.slippageTolerance}%
          </label>
          <input
            type="range"
            min="0.1"
            max="5"
            step="0.1"
            value={settings.slippageTolerance}
            onChange={(e) => setSettings({ ...settings, slippageTolerance: parseFloat(e.target.value) })}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>0.1%</span>
            <span>5%</span>
          </div>
        </div>

        {/* Default Assets */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Default From Asset</label>
            <input
              type="text"
              placeholder="e.g., BTC"
              value={settings.defaultFromAsset}
              onChange={(e) => setSettings({ ...settings, defaultFromAsset: e.target.value })}
              className="w-full px-4 py-2 bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Default To Asset</label>
            <input
              type="text"
              placeholder="e.g., ETH"
              value={settings.defaultToAsset}
              onChange={(e) => setSettings({ ...settings, defaultToAsset: e.target.value })}
              className="w-full px-4 py-2 bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Notifications */}
        <div className="space-y-3">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={settings.notificationsEnabled}
              onChange={(e) => setSettings({ ...settings, notificationsEnabled: e.target.checked })}
              className="w-5 h-5 rounded"
            />
            <span>Enable notifications</span>
          </label>

          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={settings.emailNotifications}
              onChange={(e) => setSettings({ ...settings, emailNotifications: e.target.checked })}
              className="w-5 h-5 rounded"
            />
            <span>Email notifications</span>
          </label>

          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={settings.telegramNotifications}
              onChange={(e) => setSettings({ ...settings, telegramNotifications: e.target.checked })}
              className="w-5 h-5 rounded"
            />
            <span>Telegram notifications</span>
          </label>
        </div>

        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={isSaving}
          className={`w-full py-3 rounded-lg font-medium transition-all ${
            saveStatus === 'success'
              ? 'bg-green-500 text-white'
              : saveStatus === 'error'
              ? 'bg-red-500 text-white'
              : 'bg-blue-500 hover:bg-blue-600 text-white'
          } disabled:opacity-50`}
        >
          {isSaving ? 'Saving...' : saveStatus === 'success' ? '✓ Saved!' : saveStatus === 'error' ? 'Error' : 'Save Settings'}
        </button>

        {!data?.preferences && (
          <p className="text-sm text-gray-400 text-center">
            Using default settings. Save to persist your preferences.
          </p>
        )}
      </div>
    </div>
  );
}
