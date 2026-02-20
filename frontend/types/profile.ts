export interface EmailNotificationPrefs {
  enabled: boolean;
  walletReminders: boolean;
  priceAlerts: boolean;
  generalUpdates: boolean;
  frequency: 'daily' | 'weekly';
}
