import { getTopYieldPools } from '../services/yield-client';
import logger from '../services/logger';


async function testYieldLogic() {
    logger.info("Testing getTopYieldPools()...");

    const pools = await getTopYieldPools();

    if (!Array.isArray(pools)) {
        logger.error("❌ Failed: getTopYieldPools did not return an array");
        return;
    }


    if (pools.length === 0) {
        logger.warn("⚠️ Warning: No pools returned (API might be down or filtering too strict)");
    } else {
        logger.info(`✅ Success: Got ${pools.length} pools`);
        logger.info("First pool:", pools[0]);

        // Check structure
        const p = pools[0];
        if (p.chain && p.symbol && p.project && typeof p.apy === 'number') {
            logger.info("✅ Structure looks correct");
        } else {
            logger.error("❌ Invalid pool structure:", p);
        }
    }


    // Simulate Matching Logic
    const testAsset = 'ETH';
    // In our simplified logic, we map ETH -> matchingPool (which are stables). 
    // Wait, the logic in bot.ts tries to find `p.symbol === parsed.fromAsset`. 
    // Since our yields are only stables (USDC, USDT, DAI), checking for 'ETH' will fail.
    // This highlights a logic gap: We need to allow swapping *into* the yield asset.

    logger.info("\nSimulating Yield Discovery for 'USDC'...");
    const usdcPool = pools.find(p => p.symbol === 'USDC');
    if (usdcPool) {
        logger.info(`✅ Found USDC pool on ${usdcPool.chain} (${usdcPool.apy.toFixed(2)}%)`);
    } else {
        logger.info("❌ No USDC pool found");
    }

}

testYieldLogic().catch((err) => logger.error(err));
