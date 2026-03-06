import { isValidAddress } from '../bot/src/config/address-patterns';

const testAddresses = [
    { address: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa', expected: true, type: 'Legacy' },
    { address: '3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy', expected: true, type: 'SegWit' },
    { address: 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4', expected: true, type: 'Native SegWit' },
    { address: 'bc1p0xl6y8v6jhy2cl66f6r03923u5w7m92v58dcnre6q0fxt8xrfeps67m4yv', expected: true, type: 'Taproot - 62 chars' },
    { address: 'bc1pinvalidcharacters!!!', expected: false, type: 'Invalid characters' },
    { address: 'bc1p9wvz6txukxhlv9un7sry3qry8t6lkd0r5jhdu3snpauulcmq0wwfm2kdau', expected: true, type: 'Taproot - valid 62 chars' },
    // Test too long Taproot addresses (should fail - valid Taproot is always 62 chars)
    { address: 'bc1p0xl6y8v6jhy2cl66f6r03923u5w7m92v58dcnre6q0fxt8xrfeps67m4yvABCD', expected: false, type: 'Too Long Taproot (66 chars)' },
];

console.log('--- Bitcoin Address Validation Test ---');
testAddresses.forEach(({ address, expected, type }) => {
    const result = isValidAddress(address, 'bitcoin');
    const status = result === expected ? '✅ PASS' : '❌ FAIL';
    console.log(`[${type}] ${address} -> Expected: ${expected}, Got: ${result} ${status}`);
});
