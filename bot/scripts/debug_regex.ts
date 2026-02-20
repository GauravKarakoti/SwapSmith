
const REGEX_MULTI_SOURCE = /([A-Z]+)\s+(?:and|&)\s+([A-Z]+)\s+(?:to|into|for)/i;

const inputs = [
    "Swap my ETH and MATIC for USDC on Arbitrum",
    "Swap ETH and MATIC to USDC",
    "Convert BTC & ETH to USDC"
];

inputs.forEach(input => {
    const match = REGEX_MULTI_SOURCE.test(input);
    console.log(`Input: "${input}" | Matches: ${match}`);
    if (match) {
        const m = input.match(REGEX_MULTI_SOURCE);
        console.log(` - Captured: ${m ? m.slice(1).join(', ') : 'none'}`);
    }
});
