/**
 * SwapSmith Ad Preview Script
 * ─────────────────────────────────────────────────────────────────
 * Paste this entire script into the browser DevTools console while
 * on any SwapSmith page (localhost:3000) to immediately force one
 * of the ads to appear — bypasses all cooldown timers.
 *
 * Usage:
 *   1. Open http://localhost:3000 in Chrome/Firefox
 *   2. Open DevTools → Console (F12)
 *   3. Paste the entire contents of this file and press Enter
 *   4. Call one of: showPlansAd() | showFeaturesAd() | showPromoAd()
 *
 * Example:
 *   showPlansAd()     → forces the pricing plans modal
 *   showFeaturesAd()  → forces the site features modal
 *   showPromoAd()     → forces the "Connect Wallet / Learn / Rewards" modal
 */

;(function () {
  'use strict'

  /* ── 1. Clear all ad cooldown keys so Next.js hooks fire instantly ── */
  const AD_KEYS = [
    'swapsmith_ad_terminal',
    'swapsmith_ad_prices',
    'swapsmith_ad_learn',
    'swapsmith_ad_global',
    'swapsmith_ad_promo_global',
    'swapsmith_just_logged_in',
  ]
  AD_KEYS.forEach((k) => localStorage.removeItem(k))
  console.info('[SwapSmith Ads] ✅ All cooldown keys cleared.')

  /* ── 2. Set just-logged-in flag so terminal hook fires instantly ──── */
  function triggerTerminalAd() {
    localStorage.setItem('swapsmith_just_logged_in', String(Date.now()))
    console.info('[SwapSmith Ads] ℹ️ just_logged_in flag set — navigate to /terminal to see the plans ad.')
  }

  /* ── 3. Inject a raw DOM preview directly (no Next.js required) ───── */
  function injectPreview(variant) {
    // Remove any existing preview
    const old = document.getElementById('__swapsmith_ad_preview__')
    if (old) old.remove()

    const VARIANTS = {
      plans: {
        eyebrow: 'Simple Pricing',
        title: 'Unlock <span style="color:#2563eb">SwapSmith\'s</span> full potential',
        subtitle: 'AI routing · Telegram swaps · yield scouting — pick your plan.',
        cards: [
          { icon: '⚡', iconBg: '#dcfce7', name: 'Free', sub: 'Perfect for crypto explorers', price: '$0', period: 'forever', features: ['Unlimited swaps', 'Real-time prices', '50+ chains', 'AI chat terminal'], cta: 'Get Started', popular: false },
          { icon: '📈', iconBg: '#fef3c7', name: 'Pro', sub: 'For serious DeFi traders', price: '$12', period: '/month', features: ['Everything in Free', 'Swap history export', 'Priority execution', 'Telegram bot access'], cta: 'Get Started', popular: true },
          { icon: '✨', iconBg: '#ede9fe', name: 'Premium', sub: 'For power users & whales', price: '$29', period: '/month', features: ['Everything in Pro', 'AI swap routing', 'Live yield alerts', 'Early access features'], cta: 'Get Started', popular: false },
        ],
      },
      features: {
        eyebrow: 'Explore SwapSmith',
        title: 'Powerful tools, <span style="color:#2563eb">built for DeFi</span>',
        subtitle: 'Trade smarter with SwapSmith\'s suite of decentralised finance tools.',
        cards: [
          { icon: '🤖', iconBg: '#cffafe', name: 'Telegram Bot', sub: 'Swap without leaving Telegram', price: 'Free', period: 'to use', features: ['Live swap quotes', 'Cross-chain support', 'Portfolio tracking', 'One-click execution'], cta: 'Open Bot', popular: true },
          { icon: '⭐', iconBg: '#fef9c3', name: 'Yield Scout', sub: 'Scout the highest DeFi yields', price: '50+', period: 'protocols', features: ['Real-time APY scan', 'Multi-chain support', 'Auto yield alerts', 'Risk-ranked results'], cta: 'Scout Now', popular: false },
          { icon: '🔗', iconBg: '#fce7f3', name: 'Payment Links', sub: 'Request any crypto in seconds', price: 'Any', period: 'token or chain', features: ['Shareable link', 'No wallet needed', 'Any token/chain', 'Instant settlement'], cta: 'Create Link', popular: false },
        ],
      },
      promo: {
        eyebrow: 'Discover SwapSmith',
        title: 'More ways to <span style="color:#2563eb">earn & learn</span>',
        subtitle: 'Connect your wallet, level up your DeFi knowledge, and earn rewards every day.',
        cards: [
          { icon: '👛', iconBg: '#dbeafe', name: 'Connect Wallet', sub: 'Connect your wallet in seconds', price: '8+', period: 'wallets supported', features: ['MetaMask & injected', 'WalletConnect v2', 'Hardware wallets', 'One-click connect'], cta: 'Connect Now', popular: false },
          { icon: '📚', iconBg: '#dcfce7', name: 'Learning Hub', sub: 'Master DeFi with SwapSmith Learn', price: 'Free', period: 'forever', features: ['Beginner DeFi guides', 'Swap strategy playbooks', 'Yield farming basics', 'Live quizzes & badges'], cta: 'Start Learning', popular: true },
          { icon: '🎁', iconBg: '#fce7f3', name: 'Rewards', sub: 'Earn SwapSmith tokens daily', price: 'Daily', period: 'token drops', features: ['Login streak rewards', 'Swap-to-earn bonuses', 'Referral payouts', 'Airdrop eligibility'], cta: 'Claim Rewards', popular: false },
        ],
      },
    }

    const data = VARIANTS[variant] || VARIANTS.plans

    const cardHTML = data.cards.map((c) => `
      <div style="
        position:relative; display:flex; flex-direction:column;
        border-radius:16px; padding:20px;
        border: ${c.popular ? '2px solid #111' : '1px solid #e5e7eb'};
        box-shadow: ${c.popular ? '0 12px 40px rgba(0,0,0,0.15)' : 'none'};
        transform: ${c.popular ? 'translateY(-8px) scale(1.02)' : 'none'};
        background:#fff; flex:1;
      ">
        ${c.popular ? `<div style="
          position:absolute; top:-14px; left:50%; transform:translateX(-50%);
          background:#f59e0b; color:#fff; font-size:11px; font-weight:900;
          padding:4px 14px; border-radius:99px; white-space:nowrap; letter-spacing:0.05em;
        ">Popular!</div>` : ''}
        <div style="
          width:44px; height:44px; border-radius:50%; border:2px solid #e5e7eb;
          background:${c.iconBg}; display:flex; align-items:center; justify-content:center;
          font-size:20px; margin-bottom:12px;
        ">${c.icon}</div>
        <div style="font-size:15px; font-weight:900; color:#111; margin-bottom:2px;">${c.name}</div>
        <div style="font-size:11px; color:#6b7280; margin-bottom:10px; line-height:1.3;">${c.sub}</div>
        <div style="margin-bottom:14px;">
          <span style="font-size:28px; font-weight:900; color:#111;">${c.price}</span>
          <span style="font-size:13px; color:#9ca3af; margin-left:3px;">${c.period}</span>
        </div>
        <ul style="list-style:none; padding:0; margin:0 0 16px; display:flex; flex-direction:column; gap:8px; flex:1;">
          ${c.features.map((f) => `
            <li style="display:flex; align-items:center; gap:8px; font-size:12px; color:#374151;">
              <div style="width:16px;height:16px;border-radius:50%;background:#dcfce7;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              ${f}
            </li>
          `).join('')}
        </ul>
        <div style="
          display:block; text-align:center; padding:11px;
          border-radius:12px; font-size:13px; font-weight:700;
          cursor:pointer;
          ${c.popular
            ? 'background:#f59e0b; color:#fff;'
            : 'background:#f8fafc; color:#374151; border:1px solid #e2e8f0;'
          }
        ">${c.cta}</div>
      </div>
    `).join('')

    const overlay = document.createElement('div')
    overlay.id = '__swapsmith_ad_preview__'
    overlay.style.cssText = `
      position:fixed; inset:0; z-index:99999;
      display:flex; align-items:center; justify-content:center; padding:16px;
      background:rgba(15,23,42,0.82);
      backdrop-filter:blur(10px); -webkit-backdrop-filter:blur(10px);
    `

    overlay.innerHTML = `
      <div style="
        position:relative; width:100%; max-width:768px;
        background:#fff; border-radius:20px;
        box-shadow:0 25px 80px rgba(0,0,0,0.35); overflow:hidden;
      ">
        <!-- Dismiss -->
        <button id="__ss_ad_dismiss__" style="
          position:absolute; top:14px; right:14px; z-index:10;
          display:flex; align-items:center; gap:6px;
          padding:6px 12px; border-radius:99px;
          font-size:12px; font-weight:600; color:#6b7280;
          background:#f9fafb; border:1px solid #e5e7eb; cursor:pointer;
        ">✕ Close</button>

        <!-- Ad label -->
        <div style="position:absolute;top:16px;left:16px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.15em;color:#d1d5db;">Sponsored</div>

        <!-- Stars -->
        <span style="position:absolute;top:42px;left:42px;font-size:22px;pointer-events:none;user-select:none;">⭐</span>
        <span style="position:absolute;top:36px;right:80px;font-size:18px;pointer-events:none;user-select:none;">✨</span>

        <div style="padding:40px 32px 32px;">
          <!-- Header -->
          <div style="text-align:center; margin-bottom:28px;">
            <p style="font-size:13px; font-weight:700; color:#2563eb; margin:0 0 6px; letter-spacing:0.03em;">${data.eyebrow}</p>
            <h2 style="font-size:26px; font-weight:900; color:#111; margin:0 0 6px; letter-spacing:-0.03em; line-height:1.2;">${data.title}</h2>
            <p style="font-size:13px; color:#6b7280; margin:0;">${data.subtitle}</p>
          </div>

          <!-- Cards -->
          <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:16px; align-items:start;">
            ${cardHTML}
          </div>
        </div>

        <!-- Progress bar -->
        <div style="height:4px; background:#f3f4f6; overflow:hidden;">
          <div id="__ss_ad_progress__" style="height:100%; background:#3b82f6; width:100%; transition:none;"></div>
        </div>
      </div>
    `

    document.body.appendChild(overlay)

    // Wire dismiss
    document.getElementById('__ss_ad_dismiss__').onclick = () => overlay.remove()
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove() })

    // Animate progress bar over 14s
    const bar = document.getElementById('__ss_ad_progress__')
    const start = Date.now()
    const DURATION = 14000
    requestAnimationFrame(function tick() {
      const pct = Math.max(0, 100 - ((Date.now() - start) / DURATION) * 100)
      bar.style.width = pct + '%'
      if (pct <= 0) { overlay.remove(); return }
      requestAnimationFrame(tick)
    })

    console.info(`[SwapSmith Ads] 🟢 Showing "${variant}" ad preview. Auto-dismisses in 14s.`)
    return overlay
  }

  /* ── 4. Expose helper functions on window ──────────────────────── */
  window.showPlansAd         = () => injectPreview('plans')
  window.showFeaturesAd      = () => injectPreview('features')
  window.showPromoAd         = () => injectPreview('promo')
  window.triggerTerminalAd   = triggerTerminalAd

  console.info('[SwapSmith Ads] ✅ Preview helpers loaded!')
  console.info('  showPlansAd()    → pricing plans modal')
  console.info('  showFeaturesAd() → site features modal')
  console.info('  showPromoAd()    → wallet / learn / rewards modal')
  console.info('')
  console.info('Auto-showing promo ad in 1s...')
  setTimeout(() => injectPreview('promo'), 1000)
})()
