import { formatYieldPools, YieldPool } from '../bot/src/services/yield-client';

const mockYields: YieldPool[] = [
    { chain: 'Base', project: 'Aave', symbol: 'USDC', tvlUsd: 5000000, apy: 12.4, poolId: 'base-aave-usdc' },
    { chain: 'Arbitrum', project: 'Radiant', symbol: 'USDC', tvlUsd: 6000000, apy: 15.2, poolId: 'arb-radiant-usdc' }
];

console.log('--- Yield Formatting Test ---');
const formatted = formatYieldPools(mockYields);
console.log('Formatted Output:');
console.log(formatted);

if (formatted.includes('Aave') && formatted.includes('12.40%')) {
    console.log('✅ PASS');
} else {
    console.log('❌ FAIL');
}
