## Description

Consolidates address validation patterns into a single source of truth. Previously, ADDRESS_PATTERNS, DEFAULT_EVM_PATTERN, and the isValidAddress function were hardcoded inline in bot/src/bot.ts (80+ lines). This PR extracts them into a dedicated config module at bot/src/config/address-patterns.ts and updates bot.ts to import from it. A comprehensive test suite is added that imports directly from the production config, ensuring tests can never drift out of sync with the patterns the bot actually uses at runtime.

## Related Issue

Closes #163

## Type of Change

- [ ] 🐛 Bug fix (non-breaking change which fixes an issue)
- [ ] ✨ New feature (non-breaking change which adds functionality)
- [ ] 💥 Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] 📝 Documentation update
- [ ] 🎨 UI/UX improvement
- [x] ♻️ Code refactoring
- [ ] ⚡ Performance improvement
- [x] ✅ Test addition/update

## Changes Made

- Created bot/src/config/address-patterns.ts as the single source of truth for ADDRESS_PATTERNS, DEFAULT_EVM_PATTERN, and the isValidAddress function
- Removed 80+ lines of inline address validation code from bot/src/bot.ts and replaced with a single import from the new config module
- Added bot/src/tests/address-validation.test.ts with 22 tests covering all chain patterns, edge cases, and validation logic, importing directly from the production config

## Screenshots/Demo (if applicable)

Not applicable (backend refactoring, no UI changes)

## Testing Done

- [ ] Tested locally (npm run dev)
- [ ] Production build successful (npm run build)
- [ ] All lint checks pass (npm run lint)
- [x] No TypeScript errors (only pre-existing getTopYieldPools error unrelated to this PR)
- [ ] Tested in multiple browsers (Chrome, Firefox, Safari)
- [ ] Voice input tested (if applicable)
- [ ] Wallet connection tested (if applicable)

## Checklist

- [x] My code follows the project's code style
- [x] I have performed a self-review of my code
- [x] I have commented my code, particularly in hard-to-understand areas
- [x] My changes generate no new warnings or errors
- [x] I have tested my changes thoroughly
- [x] Any dependent changes have been merged and published

## Additional Notes

The address-patterns.ts module exports ADDRESS_PATTERNS, DEFAULT_EVM_PATTERN, and isValidAddress so that any future scripts, tests, or services that need address validation can import from the same config. Supported chains include EVM (Ethereum, BSC, Polygon, Arbitrum, Base, Avalanche, Optimism, Fantom), Bitcoin, Litecoin, Solana, Tron, Ripple/XRP, Dogecoin, Cosmos, Polkadot, Cardano, Monero, and Zcash. Unknown chains fall back to EVM pattern matching.

---

**By submitting this PR, I confirm that:**

- I have read and followed the [Contributing Guidelines](../CONTRIBUTING.md)
- I have read and agree to the [Code of Conduct](../CODE_OF_CONDUCT.md)
- This contribution is my own work and I have the right to license it
## CI/CD Improvements

- Added GitHub Action workflow (`.github/workflows/bot_pr_checks.yml`) to run tests and build checks on PRs.
- Fixed build errors in `bot/src/bot.ts` and `bot/src/services/yield-client.ts`.
- Resolved test failures in `bot/src/tests/parse-command.test.ts` by correcting mock implementation.

## Verification

- `npm run build` passes locally.
- `npm test` passes locally (6/6 tests).
