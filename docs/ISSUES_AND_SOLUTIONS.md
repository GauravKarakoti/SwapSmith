# SwapSmith Issues and Solutions Guide

This document outlines the top 10 high-priority issues in the SwapSmith repository, along with reproduction steps, detailed technical analysis, and proposed solutions.

---

## 🚀 How to Execute & Reproduce

To reproduce these issues, follow the standard setup instructions:

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/GauravKarakoti/SwapSmith.git
    cd SwapSmith
    ```

2.  **Install Dependencies:**
    ```bash
    npm install
    cd frontend && npm install
    cd ../bot && npm install
    ```

3.  **Run Development Server:**
    ```bash
    # Root directory
    npm run dev
    ```

---

## 1. 🐛 Bot Container Fails on Startup
**Issue #238**

### 🔴 The Issue
The bot container defined in `docker-compose.yaml` fails to start.
- **Error:** Command failed or script missing.
- **Context:** The command is `sh -c "npm run db:migrate && npm run start"`.

### 🔍 Analysis
In `bot/package.json`, the `db:migrate` script is defined as `"drizzle-kit migrate"`.
However, for this to work inside the container:
1.  The `DATABASE_URL` must be reachable.
2.  `drizzle-kit` must be installed and executable.
3.  The migration files must be present in the expected directory.

### ✅ Proposed Solution
1.  **Verify Environment:** Ensure `DATABASE_URL` in `bot/.env` (or passed via docker-compose) points to the `db` service (e.g., `postgres://user:pass@db:5432/swapsmith`).
2.  **Wait for DB:** The `depends_on` in docker-compose is good, but `pg_isready` check is better.
3.  **Fix Code:**
    modify `docker-compose.yaml` to ensure strictly that the db is ready before migration runs, or add a wait script.
    
    *Additionally, check `order-worker.ts` for null reference:*
    ```typescript
    // In bot/src/workers/order-worker.ts
    // Add null check before accessing priceMonitor
    if (!priceMonitor) {
        console.error("Price monitor not initialized");
        return;
    }
    ```

---

## 2. 🚨 Wrong Swap Destination (Critical Bug)
**Issue #237**

### 🔴 The Issue
In `frontend/components/SwapConfirmation.tsx`, the transaction sends funds to the **user's own wallet** instead of the SideShift deposit address.

### 🔍 Analysis
Line ~99 of `SwapConfirmation.tsx`:
```typescript
const transactionDetails = {
    to: address, // BUG: 'address' is the user's connected wallet!
    value: parseEther(quote.depositAmount),
    chainId: depositChainId,
};
```
This effectively makes the user pay gas to send money to themselves, and no swap occurs.

### ✅ Proposed Solution
1.  **Update Interface:** Update `QuoteData` interface in `SwapConfirmation.tsx` to include the deposit address.
    ```typescript
    interface QuoteData {
        // ... existing fields
        depositAddress: string; // Add this
    }
    ```
2.  **Fix Component:**
    ```typescript
    const transactionDetails = {
        to: quote.depositAddress, // Correct destination
        value: parseEther(quote.depositAmount),
        chainId: depositChainId,
    };
    ```
3.  **Update Parent:** Ensure the parent component (likely `ChatInterface`) passes the `depositAddress` from the SideShift API response into the `quote` prop.

---

## 3. [FEATURE] Added Security Page
**Issue #231**

### 🔴 The Request
Add a `/security` page to inform users about audits, smart contract safety, and best practices.

### ✅ Proposed Solution
1.  Create `frontend/pages/security.tsx` (or `app/security/page.tsx` if using App Router).
2.  Add content sections:
    - **Audits:** Links to any PDF audit reports.
    - **Risks:** Disclaimer about slippage and cross-chain risks.
    - **Verification:** Instructions on how to verify the contract address.
3.  Add "Security" link to the Navbar and Footer.

---

## 4. Configure Jest/Vitest for Frontend
**Issue #224**

### 🔴 The Issue
The `frontend` package has no test runner.

### ✅ Proposed Solution
1.  **Install Vitest:**
    ```bash
    cd frontend
    npm install -D vitest @testing-library/react jsdom
    ```
2.  **Configure:** Create `frontend/vitest.config.ts`.
    ```typescript
    import { defineConfig } from 'vitest/config'
    import react from '@vitejs/plugin-react'
    
    export default defineConfig({
      plugins: [react()],
      test: {
        environment: 'jsdom',
        globals: true,
      },
    })
    ```
3.  **Add Script:** In `frontend/package.json`: `"test": "vitest"`.
4.  **Create Test:** `frontend/components/__tests__/ChatInterface.test.tsx`.

---

## 5. Implement On-Chain Agent Reputation System
**Issue #223**

### 🔴 The Request
Calculate and display a "Trust Score" for the agent based on successful swaps.

### ✅ Proposed Solution
1.  **Backend:** In `bot` service, create an endpoint `GET /api/reputation`.
    - Query `swapHistory` table.
    - `Score = (Successful Swaps / Total Swaps) * 100`.
2.  **Frontend:** Fetch this score and display it in the Chat UI header.
    ```tsx
    // Example UI
    <div className="badge">
        Create Score: 98% (500+ Swaps)
    </div>
    ```

---

## 6. Support "Swap and Stake"
**Issue #222**

### 🔴 The Request
Allow users to say "Swap ETH for stETH" or "Stake my ETH".

### ✅ Proposed Solution
1.  **NLP:** Update the system prompt in `bot/src/services/ai.ts` to recognize "STAKE" intent.
2.  **Mapping:** Map "STAKE" intent to liquid staking providers (e.g., Lido).
    - If user wants to stake ETH, swap ETH -> stETH via the DEX aggregator or SideShift if supported.
3.  **UI:** Show "Staking APR" in the confirmation box.

---

## 7. Connect NLP Link to Limit Order Backend
**Issue #221**

### 🔴 The Issue
Backend has `limitOrderWorker.ts` but the AI doesn't trigger it.

### ✅ Proposed Solution
1.  **Prompt Engineering:**
    - "If user says 'Buy ETH when price is $2000', output intent: LIMIT_ORDER."
2.  **API Handler:**
    - Create `POST /api/orders/limit` endpoint.
    - Payload: `{ source, target, targetPrice, amount }`.
3.  **Database:** Insert into `limit_orders` table. The existing `limitOrderWorker` should pick it up.

---

## 8. Fix Complex Multi-Step Command Parsing
**Issue #220**

### 🔴 The Issue
The agent fails on conditionals like "Swap X if Y".

### ✅ Proposed Solution
Improve the OpenAI Main Prompt:
- **Current:** "You are a swap assistant."
- **Improved:**
  "You are a sophisticated DeFi agent.
   - If the user provides a condition ('if price > X'), set `condition` field in JSON.
   - If `condition` is present, do NOT generate a direct swap quote. Instead, generate a 'Conditional Order' object."

---

## 9. Fix Voice Input on Firefox/Safari
**Issue #219**

### 🔴 The Issue
`SpeechRecognition` API is vendor-prefixed (`webkitSpeechRecognition`) and missing in Firefox.

### ✅ Proposed Solution
1.  **Polyfill:** Use `speech-recognition-polyfill` or a library like `react-speech-recognition`.
2.  **Cloud Fallback:** If browser support is missing, record audio (MediaRecorder API is widely supported) and send to OpenAI Whisper API for transcription.
    ```typescript
    if (!('webkitSpeechRecognition' in window)) {
        // Fallback to Whisper API
    }
    ```

---

## 10. Fix Navbar Layout
**Issue #218**

### 🔴 The Issue
Navbar items overlap on tablet/mobile screens.

### ✅ Proposed Solution
1.  **Use Grid/Flex properly:**
    In `Navbar.tsx`, ensure the container has `flex-wrap: wrap` or switches to a hamburger menu on smaller screens.
    ```tsx
    <div className="hidden md:flex gap-4">...links...</div>
    <div className="md:hidden">...Hamburger...</div>
    ```
2.  **Z-Index:** Ensure the navbar has a high `z-index` so it doesn't get clipped by other content.
