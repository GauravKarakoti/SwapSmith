/**
 * Quick Test: Trigger Price Refresh
 * 
 * This script triggers a manual price refresh and shows the results.
 * Run with: npx tsx scripts/trigger-refresh.ts
 */

async function triggerRefresh() {
  console.log('🚀 Triggering manual price refresh...\n');
  
  try {
    const response = await fetch('http://localhost:3000/api/prices/refresh', {
      method: 'POST',
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    
    console.log('✅ Refresh completed successfully!');
    console.log('Response:', JSON.stringify(result, null, 2));
    
    // Wait a moment for database to be updated
    console.log('\n⏳ Waiting 2 seconds for database update...\n');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Fetch and display some prices
    console.log('📊 Fetching prices from database...\n');
    const pricesResponse = await fetch('http://localhost:3000/api/prices');
    
    if (!pricesResponse.ok) {
      throw new Error(`HTTP ${pricesResponse.status}: ${pricesResponse.statusText}`);
    }
    
    const pricesData = await pricesResponse.json();
    
    console.log(`✅ Found ${pricesData.count} coins in cache`);
    console.log(`📈 Sample prices:\n`);
    
    pricesData.prices.slice(0, 10).forEach((coin: { coin: string; name: string; usdPrice?: string }, index: number) => {
      const price = coin.usdPrice ? `$${parseFloat(coin.usdPrice).toFixed(2)}` : 'N/A';
      console.log(`  ${index + 1}. ${coin.coin.toUpperCase()} (${coin.name}): ${price}`);
    });
    
    console.log('\n✅ Price refresh test completed successfully!');
    console.log('\n💡 Now check:');
    console.log('   - Database: SELECT * FROM coin_price_cache LIMIT 10;');
    console.log('   - Frontend: http://localhost:3000/prices');
    
  } catch (error) {
    console.error('\n❌ Error:', error);
    console.log('\n💡 Make sure:');
    console.log('   1. Next.js server is running (npm run dev)');
    console.log('   2. DATABASE_URL is configured');
    console.log('   3. Server is accessible at http://localhost:3000');
    process.exit(1);
  }
}

triggerRefresh();
