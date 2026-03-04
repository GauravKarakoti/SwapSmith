import { Telegraf } from 'telegraf';
import { checkAndRebalancePortfolios, executePortfolioRebalance } from '../services/portfolio-rebalancer';
import { analyzePortfolioDrift } from '../services/portfolio-analyzer';
import logger from '../services/logger';

const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export class PortfolioRebalanceWorker {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private bot: Telegraf | null = null;

  constructor() {
    // Constructor - no initialization needed
  }

  public async start(bot: Telegraf) {
    if (this.isRunning) return;
    this.isRunning = true;
    this.bot = bot;

    logger.info('🚀 Starting Portfolio Rebalance Worker...');

    // Run immediately
    this.checkPortfolios();

    this.intervalId = setInterval(() => {
      this.checkPortfolios();
    }, CHECK_INTERVAL_MS);
  }

  public stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    logger.info('🛑 Portfolio Rebalance Worker stopped.');
  }

  private async checkPortfolios() {
    try {
      logger.info('🔍 Checking portfolios for rebalancing...');

      const result = await checkAndRebalancePortfolios();

      logger.info(`✅ Portfolio check complete: ${result.checked} checked, ${result.rebalanced} rebalanced`);

      if (result.errors.length > 0) {
        logger.warn(`⚠️ Portfolio rebalance errors: ${result.errors.join(', ')}`);
      }

    } catch (error) {
      logger.error('❌ Error in Portfolio Rebalance Worker:', error);
    }
  }

  /**
   * Manually trigger rebalancing for a specific portfolio
   */
  public async triggerRebalance(
    portfolioTargetId: number,
    telegramId?: number
  ): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      logger.info(`🔄 Manual rebalance triggered for portfolio ${portfolioTargetId}`);

      // First analyze the drift
      const analysis = await analyzePortfolioDrift(portfolioTargetId);

      if (!analysis) {
        return { success: false, message: 'Portfolio not found' };
      }

      if (!analysis.needsRebalance) {
        return { 
          success: true, 
          message: `Portfolio is within threshold. Total drift: ${analysis.totalDrift.toFixed(2)}%` 
        };
      }

      // Execute the rebalance
      const result = await executePortfolioRebalance(portfolioTargetId, 'manual');

      // Send notification via Telegram if available
      if (this.bot && telegramId) {
        const message = this.formatRebalanceMessage(result, analysis);
        try {
          await this.bot.telegram.sendMessage(telegramId, message, { parse_mode: 'Markdown' });
        } catch (err) {
          logger.error('Failed to send Telegram notification:', err);
        }
      }

      return {
        success: result.success,
        message: result.success 
          ? `Rebalanced successfully! ${result.swapsExecuted.length} swaps executed.`
          : `Rebalancing failed: ${result.error}`
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('❌ Manual rebalance error:', error);
      return { success: false, message: errorMessage };
    }
  }

  private formatRebalanceMessage(
    result: Awaited<ReturnType<typeof executePortfolioRebalance>>,
    analysis: Awaited<ReturnType<typeof analyzePortfolioDrift>>
  ): string {
    let message = `📊 *Portfolio Rebalanced*\n\n`;
    
    message += `Status: ${result.success ? '✅ Success' : '❌ Failed'}\n`;
    message += `Swaps Executed: ${result.swapsExecuted.length}\n\n`;
    
    if (result.swapsExecuted.length > 0) {
      message += `*Swaps:*\n`;
      for (const swap of result.swapsExecuted) {
        const statusIcon = swap.status === 'completed' ? '✅' : '❌';
        message += `${statusIcon} ${swap.fromAmount} ${swap.fromAsset} → ${swap.toAmount} ${swap.toAsset}\n`;
      }
    }

    if (result.error) {
      message += `\n⚠️ Error: ${result.error}`;
    }

    return message;
  }
}

export const portfolioRebalanceWorker = new PortfolioRebalanceWorker();
