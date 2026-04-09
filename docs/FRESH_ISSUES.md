# 20 Fresh High-Quality Issues for SwapSmith

These issues were identified through two deep audits of the codebase. They cover security, reliability, performance, and UX.

---

## 🚀 Issues 1-10: Architecture & Critical Logic

### 1. 🚨 Critical: Financial Precision Loss in Database Schema
**Component:** Database (`shared/schema.ts`)
The `checkouts` table uses the `real` data type (floating point) for `settle_amount`. This can lead to rounding errors for crypto assets (e.g., storing `0.00000001` as `0.0`).
**Fix:** Use `numeric` or `text`.

### 2. 🛡️ Privacy: Hardcoded Dummy IP in Checkout Creation
**Component:** Bot (`bot/src/bot.ts`)
`createCheckout` is called with hardcoded IP `1.1.1.1`. This prevents accurate geo-compliance checks and violates API best practices.
**Fix:** Pass the actual user's IP or omit.

### 3. 🐛 Bug: Incomplete Bitcoin Address Validation
**Component:** Bot (`bot/src/bot.ts`)
The regex fails for SegWit v1 (Taproot, `bc1p`) addresses.
**Fix:** Update regex to support `bc1p` or use a validation library.

### 4. 🐳 DevOps: Docker Build Context Optimization
**Component:** Docker (`bot/Dockerfile`)
The `Dockerfile` performs `COPY . .` without a robust `.dockerignore`. This copies `node_modules` and `.git` into the build context, slowing down builds.
**Fix:** Add a `.dockerignore` file.

### 5. 🛑 Reliability: Order Monitor Graceful Shutdown Missing
**Component:** Bot (`bot/src/bot.ts`)
`bot.stop()` is called on exit, but the `OrderMonitor` interval and DB pools are not stopped, leading to hanging processes.
**Fix:** Implement a proper `shutdown` sequence.

### 6. ♻️ Refactor: Yield API Returns Pre-formatted String
**Component:** Bot (`bot/src/services/yield-client.ts`)
`getTopStablecoinYields` returns a formatted Markdown string, coupling data with presentation.
**Fix:** Return an array of objects and let UI handle formatting.

### 7. 🔒 Security: Error Logging Swallowed
**Component:** Bot (`bot/src/bot.ts`)
Critical errors are only alerted if `ADMIN_CHAT_ID` is present. Otherwise, they only print to console.
**Fix:** Integrate a logging aggregator (e.g., Sentry).

### 8. ⚡ Performance: Missing Database Index on Order Status
**Component:** Database (`shared/schema.ts`)
`OrderMonitor` polls the `orders` table by `status` frequently, but the column lacks an index.
**Fix:** Add an index on `status`.

### 9. 📐 Type Safety: `any` usage in Core Logic
**Component:** Bot (`bot/src/bot.ts`)
`handleTextMessage` accepts `ctx: any`, losing type safety for Telegraf context.
**Fix:** Use `Context` type from `telegraf`.

### 10. 🎧 UX: Voice Input Failure Degradation
**Component:** Frontend (`ChatInterface.tsx`)
When voice recording fails, the UI doesn't guide the user back to the text input field seamlessly.
**Fix:** Auto-focus the text input on voice failure.

---

## 🚀 Issues 11-20: Security & Dev Experience

### 11. 🔒 Security: Secret Exposure in Docker Build Args
**Component:** Docker (`docker-compose.yaml`)
`GROQ_API_KEY` is passed as a build argument. This key can be leaked in image layer metadata if the image is shared.
**Fix:** Pass as a runtime environment variable instead.

### 12. 🛡️ Security: Missing CSRF Protection on API Routes
**Component:** Frontend (`frontend/pages/api/*`)
API routes lack explicit CSRF protection, which is critical for financial apps.
**Fix:** Implement CSRF tokens or check `Origin`/`Referer` headers.

### 13. 📉 Reliability: Missing Rate Limiting on Bot
**Component:** Bot (`bot/src/bot.ts`)
The bot currently processes every message without limits, making it vulnerable to spam/DDoS.
**Fix:** Use `telegraf-ratelimit` middleware.

### 14. 🛠️ Robustness: Brittle SideShift API Handling
**Component:** Shared (`bot/src/services/sideshift-client.ts`)
If SideShift returns an unexpected response, the client might crash.
**Fix:** Use Zod or a validator to ensure API response shapes.

### 15. 📊 UX: Hardcoded Confidence Metrics
**Component:** Frontend (`ChatInterface.tsx`)
The UI displays trust indicators based on a `confidence` prop that is often hardcoded.
**Fix:** Ensure AI confidence is actually derived from the parse result.

### 16. 🧨 Security: Shell Injection Risk in FFmpeg call
**Component:** Bot (`bot/src/bot.ts`)
`exec` is used for `ffmpeg` with template strings. While inputs are sanitized, `spawn` is safer.
**Fix:** Refactor from `exec` to `spawn`.

### 17. 🔗 Maintainability: Hardcoded SideShift URLs
**Component:** Shared
SideShift tracking and API URLs are hardcoded in multiple places.
**Fix:** Centralize URLs in a config file.

### 18. 🔎 Performance: Missing Index on Telegram ID
**Component:** Database (`shared/schema.ts`)
The `watched_orders` and `limit_orders` tables are queried by `telegramId` but lack indexing.
**Fix:** Add indexes on all user FK columns.

### 19. ➕ Feature: Missing "Max" Button in Swap Interface
**Component:** Frontend (`SwapConfirmation.tsx`)
Users cannot easily swap their entire balance without manual entry.
**Fix:** Add a "Max" button linked to the connected wallet's balance.

### 20. 🏗️ CI/CD: Missing PR Workflows
**Component:** Infrastructure
The repository lacks GitHub Actions for automated linting or testing.
**Fix:** Add `.github/workflows/ci.yml`.
