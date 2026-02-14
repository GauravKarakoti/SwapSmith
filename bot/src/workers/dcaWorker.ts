import cron from 'node-cron';
import { Telegraf } from 'telegraf';
import * as db from '../services/database';
import { inferNetwork } from '../utils/network';
import { getPricesWithChange } from '../services/price-client';
import { createQuote, createOrder } from '../services/sideshift-client';

export function startDcaWorker(bot: Telegraf) {
  console.log('👷 DCA Worker started...');

  cron.schedule('* * * * *', async () => {
    console.log('👷 Checking DCA plans...');
    try {
      const duePlans = await db.getDueDcaPlans();
      if (duePlans.length === 0) return;

      const assets = [...new Set(duePlans.map(p => p.toAsset))];
      const marketData = await getPricesWithChange(assets);

      for (const plan of duePlans) {
        // Smart DCA Logic
        const assetData = marketData[plan.toAsset.toUpperCase()];
        let multiplier = 1.0;

        if (assetData) {
            // If price dropped > 5%, buy 1.5x (Buy the dip)
            if (assetData.change24h < -5) multiplier = 1.5;
            // If price pumped > 5%, buy 0.5x (Don't FOMO)
            else if (assetData.change24h > 5) multiplier = 0.5;
        }

        const adjustedAmount = parseFloat((plan.amount * multiplier).toFixed(6));

        console.log(`Processing DCA Plan ${plan.id}: Base ${plan.amount}, Multiplier ${multiplier}, Adjusted ${adjustedAmount}`);

        try {
             const fromNetwork = plan.fromNetwork || inferNetwork(plan.fromAsset);
             const toNetwork = plan.toNetwork || inferNetwork(plan.toAsset);

             // 1. Create Quote
            const quote = await createQuote(
                plan.fromAsset,
                fromNetwork,
                plan.toAsset,
                toNetwork,
                adjustedAmount,
                '1.1.1.1'
            );

            if (quote.error || !quote.id) throw new Error(quote.error?.message || "Quote failed");

            // 2. Create Order
            // If settleAddress is missing, we can't execute. Ideally we check this before.
            if (!plan.settleAddress) {
                 // Log error or notify user to set address
                 console.error(`DCA Plan ${plan.id} missing settle address.`);
                 continue;
            }

            const order = await createOrder(quote.id, plan.settleAddress, plan.settleAddress);

            // 3. Notify User
            const depositAddress = typeof order.depositAddress === 'string'
                ? order.depositAddress
                : order.depositAddress.address;

            const msg =
                `📅 *Smart DCA Execution*\n\n` +
                `Market Condition: ${assetData?.change24h ? assetData.change24h.toFixed(2) : '0'}% (24h)\n` +
                `Multiplier: ${multiplier}x\n\n` +
                `Creating swap for *${adjustedAmount} ${plan.fromAsset}* → *${plan.toAsset}*\n` +
                `Please send funds to: \`${depositAddress}\`\n\n` +
                `Next run: ${new Date(Date.now() + plan.frequencyDays * 24 * 60 * 60 * 1000).toLocaleString()}`;

            await bot.telegram.sendMessage(plan.telegramId, msg, { parse_mode: 'Markdown' });

            // 4. Update Next Run
            const nextRun = new Date();
            nextRun.setDate(nextRun.getDate() + plan.frequencyDays);
            await db.updateDcaRun(plan.id, nextRun);

        } catch (error) {
            console.error(`DCA Plan ${plan.id} failed:`, error);
            await bot.telegram.sendMessage(plan.telegramId, `⚠️ DCA execution failed: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

    } catch (error) {
      console.error('DCA Worker Error:', error);
    }
  });
}
