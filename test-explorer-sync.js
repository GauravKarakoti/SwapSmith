// Test script to verify blockchain explorer coverage sync
// Run with: node test-explorer-sync.js

const fs = require('fs');
const path = require('path');

console.log('========================================');
console.log('BLOCKCHAIN EXPLORER SYNC VERIFICATION');
console.log('========================================\n');

// Read chains.ts
const chainsPath = path.join(__dirname, 'bot', 'src', 'config', 'chains.ts');
const chainsContent = fs.readFileSync(chainsPath, 'utf8');

// Extract chain names from chains.ts
const chainMatches = chainsContent.matchAll(/'([^']+)':\s*'[\d]+'/g);
const supportedChains = Array.from(chainMatches, m => m[1]);

console.log(`✅ Found ${supportedChains.length} chains in bot/src/config/chains.ts`);
console.log(`   Chains: ${supportedChains.slice(0, 5).join(', ')}...`);
console.log('');

// Read blockchain-explorer.ts
const explorerPath = path.join(__dirname, 'frontend', 'utils', 'blockchain-explorer.ts');
const explorerContent = fs.readFileSync(explorerPath, 'utf8');

// Extract explorer configs
const explorerMatches = explorerContent.matchAll(/(\w+):\s*\{[^}]*baseUrl:/g);
const explorerChains = Array.from(explorerMatches, m => m[1]);

console.log(`✅ Found ${explorerChains.length} explorer configs in frontend/utils/blockchain-explorer.ts`);
console.log(`   Chains: ${explorerChains.slice(0, 5).join(', ')}...`);
console.log('');

// Find missing chains
const missingChains = supportedChains.filter(chain => !explorerChains.includes(chain));

console.log('========================================');
console.log('COVERAGE ANALYSIS');
console.log('========================================');
console.log(`Total chains in chains.ts: ${supportedChains.length}`);
console.log(`Total explorers configured: ${explorerChains.length}`);
console.log(`Coverage: ${((explorerChains.length / supportedChains.length) * 100).toFixed(1)}%`);
console.log('');

if (missingChains.length > 0) {
  console.log(`❌ Missing explorer configs for ${missingChains.length} chains:`);
  missingChains.forEach(chain => console.log(`   - ${chain}`));
  console.log('');
  process.exit(1);
} else {
  console.log('✅ All chains from chains.ts have explorer configurations!');
  console.log('');
}

// Show some sample explorer URLs
console.log('========================================');
console.log('SAMPLE EXPLORER CONFIGURATIONS');
console.log('========================================');

const sampleChains = ['fantom', 'moonbeam', 'xdc', 'cronos', 'aurora'];
sampleChains.forEach(chain => {
  const regex = new RegExp(`${chain}:\\s*\\{[^}]*baseUrl:\\s*'([^']+)'[^}]*name:\\s*'([^']+)'`, 's');
  const match = explorerContent.match(regex);
  if (match) {
    console.log(`✅ ${chain.padEnd(15)} - ${match[2]}`);
    console.log(`   URL: ${match[1]}`);
  } else {
    console.log(`❌ ${chain.padEnd(15)} - Not found`);
  }
});

console.log('');
console.log('========================================');
console.log('BEFORE vs AFTER');
console.log('========================================');

// Count how many were there before (from the issue description)
const beforeCount = 9; // ethereum, bitcoin, polygon, arbitrum, avalanche, optimism, bsc, base, solana
const afterCount = explorerChains.length;
const added = afterCount - beforeCount;

console.log(`Before this fix: ${beforeCount} chains`);
console.log(`After this fix:  ${afterCount} chains`);
console.log(`Added:           ${added} new chains (+${((added / beforeCount) * 100).toFixed(0)}%)`);
console.log('');

console.log('✅ TEST PASSED - All chains are now covered!');
console.log('========================================');
