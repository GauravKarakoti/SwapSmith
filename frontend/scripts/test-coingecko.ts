/**
 * Test getCoinPrices function directly
 */

import { getCoinPrices } from '../utils/sideshift-client';

async function test() {
  console.log('Testing getCoinPrices...\n');
  
  try {
    const prices = await getCoinPrices();
    console.log(`✅ Got ${prices.length} coins with prices\n`);
    
    prices.forEach(coin => {
      console.log(`${coin.coin.toUpperCase()} (${coin.name}): $${coin.usdPrice}`);
    });
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

test();
