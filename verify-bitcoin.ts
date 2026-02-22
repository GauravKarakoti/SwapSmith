import { isValidAddress } from '../bot/src/config/address-patterns';

const testAddresses = [
    { address: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa', expected: true, type: 'Legacy' },
    { address: '3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy', expected: true, type: 'SegWit' },
    { address: 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4', expected: true, type: 'Native SegWit' },
    { address: 'bc1p0xl6y8v6jhy2cl66f6r03923u5w7m92v58dcnre6q0fxt8xrfeps67m4yv', expected: true, type: 'Taproot' },
    { address: 'bc1pinvalidcharacters!!!', expected: false, type: 'Invalid Taproot' },
    { address: 'bc1pqpzry9x8gf2tvdw0s3jn54khce6mua7lqpzry9x8gf2tvdw0s3jn54khce6mua7l', expected: true, type: 'Full Length Taproot (Mock)' },
];

console.log('--- Bitcoin Address Validation Test ---');
testAddresses.forEach(({ address, expected, type }) => {
    const result = isValidAddress(address, 'bitcoin');
    const status = result === expected ? '✅ PASS' : '❌ FAIL';
    console.log(`[${type}] ${address} -> Expected: ${expected}, Got: ${result} ${status}`);
});
