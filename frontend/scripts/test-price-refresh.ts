/**
 * Test Script: Price Refresh System
 * 
 * This script tests the price refresh functionality without starting the full server.
 * Run with: npx tsx scripts/test-price-refresh.ts
 * 
 * Note: Make sure DATABASE_URL is set in your environment or .env.local file
 */

async function testPriceRefresh() {
  console.log('=== Testing Price Refresh System ===\n');
  
  // Check environment variables
  console.log('1. Checking environment variables...');
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL is not set!');
    console.log('\nPlease set DATABASE_URL in .env.local or run:');
    console.log('  export DATABASE_URL="your-connection-string"');
    process.exit(1);
  }
  console.log('✅ DATABASE_URL is configured\n');
  
  // Import functions after env vars are loaded
  const { getCoins } = await import('../utils/sideshift-client');
  const { getAllCachedPrices, clearAllCachedPrices, setCachedPrice } = await import('../lib/database');
  
  // Test 1: Fetch from SideShift
  console.log('2. Testing SideShift API connection...');
  try {
    const coins = await getCoins();
    console.log(`✅ Fetched ${coins.length} coins from SideShift\n`);
    
    // Show sample coins
    console.log('Sample coins:');
    coins.slice(0, 5).forEach(coin => {
      const networkCount = Object.keys(coin.networks || {}).length;
      console.log(`  - ${coin.coin} (${coin.name}): ${networkCount} networks`);
    });
    console.log('');
  } catch (error) {
    console.error('❌ Failed to fetch from SideShift:', error);
    process.exit(1);
  }
  
  // Test 2: Check current cache
  console.log('3. Checking current cache...');
  try {
    const cached = await getAllCachedPrices();
    console.log(`✅ Found ${cached.length} cached prices\n`);
    
    if (cached.length > 0) {
      const sample = cached[0];
      console.log('Sample cached entry:');
      console.log(`  Coin: ${sample.coin}`);
      console.log(`  Network: ${sample.network}`);
      console.log(`  Name: ${sample.name}`);
      console.log(`  Available: ${sample.available}`);
      console.log(`  Expires: ${sample.expiresAt}`);
      console.log('');
    }
  } catch (error) {
    console.error('❌ Failed to query cache:', error);
    process.exit(1);
  }
  
  // Test 3: Clear cache
  console.log('4. Testing cache clear...');
  try {
    await clearAllCachedPrices();
    console.log('✅ Cache cleared successfully\n');
  } catch (error) {
    console.error('❌ Failed to clear cache:', error);
    process.exit(1);
  }
  
  // Test 4: Add test entries
  console.log('5. Testing cache insertion...');
  try {
    await setCachedPrice(
      'BTC',
      'bitcoin',
      'Bitcoin',
      undefined,
      undefined,
      true,
      360 // 6 hours
    );
    
    await setCachedPrice(
      'ETH',
      'ethereum',
      'Ethereum',
      undefined,
      undefined,
      true,
      360
    );
    
    console.log('✅ Successfully added 2 test entries\n');
  } catch (error) {
    console.error('❌ Failed to insert cache:', error);
    process.exit(1);
  }
  
  // Test 5: Verify insertion
  console.log('6. Verifying inserted data...');
  try {
    const cached = await getAllCachedPrices();
    console.log(`✅ Cache now contains ${cached.length} entries\n`);
    
    cached.forEach(item => {
      console.log(`  - ${item.coin}/${item.network}: ${item.name} (expires: ${item.expiresAt})`);
    });
  } catch (error) {
    console.error('❌ Failed to verify cache:', error);
    process.exit(1);
  }
  
  console.log('\n=== All tests passed! ===');
  console.log('\nTo test the full refresh cycle:');
  console.log('  1. Start the server: npm run dev');
  console.log('  2. Trigger manual refresh: curl -X POST http://localhost:3000/api/prices/refresh');
  console.log('  3. Check results: curl http://localhost:3000/api/prices');
  
  process.exit(0);
}

testPriceRefresh().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
