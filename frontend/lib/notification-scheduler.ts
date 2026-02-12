import cron from 'node-cron';
import { sendPriceAlertEmail, sendWalletReminderEmail } from '@/lib/email';

// Store active cron jobs
const scheduledJobs: Map<string, ReturnType<typeof cron.schedule>> = new Map();

export interface NotificationSchedule {
  userId: string;
  userEmail: string;
  userName: string;
  type: 'wallet' | 'price' | 'general';
  frequency: 'daily' | 'weekly' | 'custom';
  cronExpression?: string;
}

// Helper to get cron expression based on frequency
function getCronExpression(frequency: string, customCron?: string): string {
  switch (frequency) {
    case 'daily':
      return '0 9 * * *'; // 9 AM daily
    case 'weekly':
      return '0 9 * * 1'; // 9 AM every Monday
    case 'custom':
      return customCron || '0 9 * * *';
    default:
      return '0 9 * * *';
  }
}

// Schedule a notification
export function scheduleNotification(schedule: NotificationSchedule) {
  const jobKey = `${schedule.userId}-${schedule.type}`;
  
  // Stop existing job if any
  if (scheduledJobs.has(jobKey)) {
    scheduledJobs.get(jobKey)?.stop();
  }

  const cronExpression = getCronExpression(schedule.frequency, schedule.cronExpression);
  
  const job = cron.schedule(cronExpression, async () => {
    console.log(`Running scheduled notification for ${schedule.userEmail}`);
    
    try {
      switch (schedule.type) {
        case 'wallet':
          await sendWalletReminderEmail(schedule.userEmail, schedule.userName);
          break;
        
        case 'price':
          // Fetch latest crypto prices and send alert
          // This would integrate with your price API
          const mockPrice = '45,231.50';
          const mockChange = '+2.34';
          await sendPriceAlertEmail(
            schedule.userEmail,
            schedule.userName,
            'Bitcoin',
            mockPrice,
            mockChange
          );
          break;
      }
    } catch (error) {
      console.error('Error sending scheduled notification:', error);
    }
  });

  scheduledJobs.set(jobKey, job);
  console.log(`Scheduled ${schedule.type} notification for ${schedule.userEmail} with cron: ${cronExpression}`);
  
  return { success: true, jobKey, cronExpression };
}

// Stop a scheduled notification
export function stopScheduledNotification(userId: string, type: string) {
  const jobKey = `${userId}-${type}`;
  
  if (scheduledJobs.has(jobKey)) {
    scheduledJobs.get(jobKey)?.stop();
    scheduledJobs.delete(jobKey);
    console.log(`Stopped notification: ${jobKey}`);
    return { success: true };
  }
  
  return { success: false, error: 'Job not found' };
}

// Get all active jobs
export function getActiveJobs() {
  return Array.from(scheduledJobs.keys());
}

// Stop all jobs
export function stopAllJobs() {
  scheduledJobs.forEach((job) => job.stop());
  scheduledJobs.clear();
  console.log('Stopped all scheduled notifications');
}
