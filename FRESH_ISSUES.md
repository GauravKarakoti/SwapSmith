# 10 Fresh High-Quality Issues for SwapSmith

These issues were identified through a fresh audit of the codebase and are **not** currently reported in the repository.

---

## 1. 🚨 Critical: Financial Precision Loss in Database Schema
**Severity:** High | **Component:** Database (`shared/schema.ts`)

**Description:**
The `checkouts` table uses the `real` data type for `settle_amount`. The `real` type (floating point) is imprecise for crypto assets and can lead to rounding errors (e.g., storing `0.00000001` as `0.0`).

**Code Location:**
`shared/schema.ts` Line 65:
```typescript
settleAmount: real('settle_amount').notNull(),
```

**Proposed Fix:**
Change the type to `numeric` or `text` to preserve exact decimal precision, matching the `users.totalToeknsClaimed` implementation.

---

## 2. 🛡️ Privacy: Hardcoded Dummy IP in Checkout Creation
**Severity:** Medium | **Component:** Bot (`bot/src/bot.ts`)

**Description:**
The `createCheckout` function is called with a hardcoded IP address `1.1.1.1`. This is likely a violation of SideShift's API terms (spoofing IP) and prevents accurate geo-compliance checks.

**Code Location:**
`bot/src/bot.ts` Line 405:
```typescript
settleAsset!, settleNetwork!, settleAmount!, settleAddress!, '1.1.1.1' // dummy IP
```

**Proposed Fix:**
Pass the actual user's IP if available, or omit if the API allows/handles server-to-server requests without it.

---

## 3. 🐛 Bug: Incomplete Bitcoin Address Validation
**Severity:** Medium | **Component:** Bot (`bot/src/bot.ts`)

**Description:**
The regex used to validate Bitcoin addresses supports legacy (`1`), P2SH (`3`), and SegWit v0 (`bc1q`), but technically fails for SegWit v1 (Taproot, `bc1p`) which are increasingly common.

**Code Location:**
`bot/src/bot.ts` Line 52:
```typescript
bitcoin: /^(1|3|bc1)[a-zA-Z0-9]{25,39}$/,
```

**Proposed Fix:**
Update regex to support Taproot or use a dedicated validation library like `multicoin-address-validator`.

---

## 4. 🐳 DevOps: Docker Build Context Optimization
**Severity:** Low | **Component:** Docker (`bot/Dockerfile`)

**Description:**
The `Dockerfile` performs `COPY . .` without a robust `.dockerignore` file defined in the root (only gitignore exists). This causes `node_modules`, `.git`, and other unnecessary files to be copied into the build context, slowing down builds and increasing image size.

**Code Location:**
`bot/Dockerfile` Line 22

**Proposed Fix:**
Create a `.dockerignore` file explicitly excluding `node_modules`, `.git`, `dist`, `coverage`, and `tests`.

---

## 5. 🛑 Reliability: Order Monitor Graceful Shutdown Missing
**Severity:** Medium | **Component:** Bot (`bot/src/bot.ts`)

**Description:**
When the bot receives `SIGINT` or `SIGTERM`, it calls `bot.stop()`. However, it does not stop the `OrderMonitor` interval or close the database connection pool. This can lead to hanging processes or database warnings.

**Code Location:**
`bot/src/bot.ts` Lines 484-485

**Proposed Fix:**
Implement a `shutdown()` method in `OrderMonitor` and call it inside the process signal handlers.

---

## 6. ♻️ Refactor: Yield API Returns Pre-formatted String
**Severity:** Low | **Component:** Bot (`bot/src/services/yield-client.ts`)

**Description:**
The function `getTopStablecoinYields` returns a formatted Markdown string (`Promise<string>`). This couples the data fetching logic with the presentation layer, making it impossible for the frontend or other consumers to format the data differently (e.g., as a table or list).

**Code Location:**
`bot/src/services/yield-client.ts` Line 71

**Proposed Fix:**
Return `Promise<YieldPool[]>` and let the consumer (`bot.ts` or `ChatInterface`) handle the formatting.

---

## 7. 🔒 Security: Error Logging Swallowed
**Severity:** Medium | **Component:** Bot (`bot/src/bot.ts`)

**Description:**
The `logAnalytics` function only sends alerts if `ADMIN_CHAT_ID` is present. If this env var is missing, critical validation errors and runtime exceptions are just printed to `console.error` and might be lost in production logs without proper context/alerting.

**Code Location:**
`bot/src/bot.ts` Line 77

**Proposed Fix:**
Integrate a proper logging service (e.g., Sentry, Datadog) or ensure `winston` logs to a persistent file/stream regardless of Telegram config.

---

## 8. ⚡ Performance: Missing Database Index on Order Status
**Severity:** Low | **Component:** Database (`shared/schema.ts`)

**Description:**
The `orders` table is frequently updated and queried by `status` (e.g., `OrderMonitor` polling for 'pending' orders). However, there is no database index on the `status` column, which will degrade performance as the table grows.

**Code Location:**
`shared/schema.ts` Line 41 (Order definition)

**Proposed Fix:**
Add `index("idx_orders_status").on(table.status)` to the schema definitions.

---

## 9. 📐 Type Safety: `any` usage in Core Logic
**Severity:** Low | **Component:** Bot (`bot/src/bot.ts`)

**Description:**
The `handleTextMessage` function accepts `ctx: any`. This defeats the purpose of TypeScript and hides potential bugs related to the Telegraf context structure (e.g., missing `from` property).

**Code Location:**
`bot/src/bot.ts` Line 219

**Proposed Fix:**
Refine the type to `Context` from `telegraf` or a custom interface extending it.

---

## 10. 🎧 UX: Voice Input Failure Degradation
**Severity:** Low | **Component:** Frontend (`ChatInterface.tsx`)

**Description:**
When `useAudioRecorder` fails (e.g., permission denied), it shows an error message but the UI remains in a state where the user might not know they can immediately type. The error handling logic is reactive rather than proactive.

**Code Location:**
`frontend/components/ChatInterface.tsx` Lines 106-110

**Proposed Fix:**
Automatically focus the text input field if voice recording fails, guiding the user to the fallback seamlessly.
