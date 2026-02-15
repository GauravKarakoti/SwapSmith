import { getTopYieldPools } from '../services/yield-client';

async function testYieldLogic() {
    console.log("Testing getTopYieldPools()...");
    const pools = await getTopYieldPools();

    if (!Array.isArray(pools)) {
        console.error("❌ Failed: getTopYieldPools did not return an array");
        return;
    }

    if (pools.length === 0) {
        console.warn("⚠️ Warning: No pools returned (API might be down or filtering too strict)");
    } else {
        console.log(`✅ Success: Got ${pools.length} pools`);
        console.log("First pool:", pools[0]);

        // Check structure
        const p = pools[0];
        if (p.chain && p.symbol && p.project && typeof p.apy === 'number') {
            console.log("✅ Structure looks correct");
        } else {
            console.error("❌ Invalid pool structure:", p);
        }
    }

    // Simulate Matching Logic
    const testAsset = 'ETH';
    // In our simplified logic, we map ETH -> matchingPool (which are stables). 
    // Wait, the logic in bot.ts tries to find `p.symbol === parsed.fromAsset`. 
    // Since our yields are only stables (USDC, USDT, DAI), checking for 'ETH' will fail.
    // This highlights a logic gap: We need to allow swapping *into* the yield asset.

    console.log("\nSimulating Yield Discovery for 'USDC'...");
    const usdcPool = pools.find(p => p.symbol === 'USDC');
    if (usdcPool) {
        console.log(`✅ Found USDC pool on ${usdcPool.chain} (${usdcPool.apy.toFixed(2)}%)`);
    } else {
        console.log("❌ No USDC pool found");
    }

}

testYieldLogic().catch(console.error);
