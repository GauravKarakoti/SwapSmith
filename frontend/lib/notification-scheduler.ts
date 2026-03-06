import cron from 'node-cron';
import { sendPriceAlertEmail, sendWalletReminderEmail } from '@/lib/email';
import { getActivePriceAlerts, getCachedPrice } from '@/lib/database';
import logger from '@/lib/logger';

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
    logger.info('Running scheduled notification', { userEmail: schedule.userEmail });
    
    try {
      switch (schedule.type) {
        case 'wallet':
          await sendWalletReminderEmail(schedule.userEmail, schedule.userName);
          break;
        
        case 'price':
          // Fetch user's active price alerts
          const alerts = await getActivePriceAlerts(schedule.userId);
          
          if (alerts.length === 0) {
            logger.info('No active price alerts for user', { userId: schedule.userId });
            break;
          }
          
          // Check each alert and send notification if triggered
          for (const alert of alerts) {
            try {
              const priceData = await getCachedPrice(alert.coin, alert.network);
              
              if (!priceData || !priceData.usdPrice) {
                logger.warn('No price data available for alert', {
                  coin: alert.coin,
                  network: alert.network
                });
                continue;
              }
              
              const currentPrice = parseFloat(priceData.usdPrice);
              const targetPrice = parseFloat(alert.targetPrice as string);
              
              // Calculate price change
              const priceChange = ((currentPrice - targetPrice) / targetPrice * 100).toFixed(2);
              const priceChangeStr = priceChange.startsWith('-') ? priceChange : `+${priceChange}`;
              
              // Send email with real price data
              await sendPriceAlertEmail(
                schedule.userEmail,
                schedule.userName,
                alert.name,
                currentPrice.toFixed(2),
                `${priceChangeStr}%`
              );
              
              logger.info('Sent price alert email', {
                userId: schedule.userId,
                coin: alert.name,
                currentPrice,
                targetPrice
              });
              
            } catch (error) {
              logger.error('Error processing price alert', {
                alertId: alert.id,
                error: error instanceof Error ? error.message : String(error)
              });
            }
          }
          break;
      }
    } catch (error) {
      logger.error('Error sending scheduled notification', { 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  });

  scheduledJobs.set(jobKey, job);
  logger.info('Scheduled notification', { 
    type: schedule.type, 
    userEmail: schedule.userEmail, 
    cronExpression 
  });
  
  return { success: true, jobKey, cronExpression };
}

// Stop a scheduled notification
export function stopScheduledNotification(userId: string, type: string) {
  const jobKey = `${userId}-${type}`;
  
  if (scheduledJobs.has(jobKey)) {
    scheduledJobs.get(jobKey)?.stop();
    scheduledJobs.delete(jobKey);
    logger.info('Stopped notification', { jobKey });
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
  logger.info('Stopped all scheduled notifications');
}
