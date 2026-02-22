'use client'

import { useState, useEffect } from 'react'
import { pickAd, markAdShown } from '@/components/AdsContainer'

/* ------------------------------------------------------------------ */
/* Post-login flag (localStorage + 30s TTL)                              */
/* ------------------------------------------------------------------ */

export const JUST_LOGGED_IN_KEY = 'swapsmith_just_logged_in'
const LOGIN_TTL_MS = 30_000

export function setJustLoggedIn() {
  try { localStorage.setItem(JUST_LOGGED_IN_KEY, String(Date.now())) } catch { /* noop */ }
}

function consumeJustLoggedIn(): boolean {
  try {
    const raw = localStorage.getItem(JUST_LOGGED_IN_KEY)
    if (!raw) return false
    const ts = Number(raw)
    localStorage.removeItem(JUST_LOGGED_IN_KEY)
    return Date.now() - ts < LOGIN_TTL_MS
  } catch { return false }
}

/* ------------------------------------------------------------------ */
/* Per-page storage keys & cooldowns                                     */
/* ------------------------------------------------------------------ */

const PAGE_KEYS = {
  terminal: 'swapsmith_ad_terminal',
  prices:   'swapsmith_ad_prices',
  learn:    'swapsmith_ad_learn',
  global:   'swapsmith_ad_global',
} as const

const PAGE_COOLDOWNS = {
  terminal:  5 * 60 * 1000,   //  5 min — shown on almost every visit
  prices:    8 * 60 * 1000,   //  8 min — shown often
  learn:    60 * 60 * 1000,   // 60 min — shown rarely
  global:   15 * 60 * 1000,   // 15 min
}

const PAGE_PROBS = {
  terminal: 0.92,   // ~92% chance per visit after cooldown
  prices:   0.85,
  learn:    0.80,
  global:   0.70,
}

/* ------------------------------------------------------------------ */
/* Return type                                                           */
/* ------------------------------------------------------------------ */

interface UseAdsReturn {
  showAd: boolean
  currentAd: ReturnType<typeof pickAd>
  dismiss: () => void
}

/* ------------------------------------------------------------------ */
/* Terminal page ads                                                     */
/* — Always shows after login (guaranteed). Very frequent otherwise.    */
/* ------------------------------------------------------------------ */

export function useTerminalAds(): UseAdsReturn {
  const [showAd, setShowAd] = useState(false)
  const [currentAd, setCurrentAd] = useState<ReturnType<typeof pickAd>>(null)

  useEffect(() => {
    const justLoggedIn = consumeJustLoggedIn()
    const key = PAGE_KEYS.terminal

    const run = () => {
      let ad: ReturnType<typeof pickAd>

      if (justLoggedIn) {
        // Post-login: guarantee an ad, bypass this page's cooldown once
        const saved = localStorage.getItem(key)
        localStorage.removeItem(key)
        ad = pickAd(true, 1, key, 0)
        if (saved) localStorage.setItem(key, saved)
        if (ad) markAdShown(ad.id, key)
      } else {
        ad = pickAd(false, PAGE_PROBS.terminal, key, PAGE_COOLDOWNS.terminal)
        if (ad) markAdShown(ad.id, key)
      }

      if (ad) { setCurrentAd(ad); setShowAd(true) }
    }

    const timer = setTimeout(run, justLoggedIn ? 500 : 1200)
    return () => clearTimeout(timer)
  }, [])

  return { showAd, currentAd, dismiss: () => setShowAd(false) }
}

/* ------------------------------------------------------------------ */
/* Prices page ads                                                       */
/* ------------------------------------------------------------------ */

export function usePricesAds(): UseAdsReturn {
  const [showAd, setShowAd] = useState(false)
  const [currentAd, setCurrentAd] = useState<ReturnType<typeof pickAd>>(null)

  useEffect(() => {
    const key = PAGE_KEYS.prices
    const timer = setTimeout(() => {
      const ad = pickAd(false, PAGE_PROBS.prices, key, PAGE_COOLDOWNS.prices)
      if (ad) { markAdShown(ad.id, key); setCurrentAd(ad); setShowAd(true) }
    }, 3000) // show after 3s so prices load first
    return () => clearTimeout(timer)
  }, [])

  return { showAd, currentAd, dismiss: () => setShowAd(false) }
}

/* ------------------------------------------------------------------ */
/* Learn page ads                                                        */
/* ------------------------------------------------------------------ */

export function useLearnAds(): UseAdsReturn {
  const [showAd, setShowAd] = useState(false)
  const [currentAd, setCurrentAd] = useState<ReturnType<typeof pickAd>>(null)

  useEffect(() => {
    const key = PAGE_KEYS.learn
    const timer = setTimeout(() => {
      const ad = pickAd(false, PAGE_PROBS.learn, key, PAGE_COOLDOWNS.learn)
      if (ad) { markAdShown(ad.id, key); setCurrentAd(ad); setShowAd(true) }
    }, 5000) // show after 5s to let content load
    return () => clearTimeout(timer)
  }, [])

  return { showAd, currentAd, dismiss: () => setShowAd(false) }
}

/* ------------------------------------------------------------------ */
/* Legacy exports kept for any existing usages                          */
/* ------------------------------------------------------------------ */
export function useLoginAds(): UseAdsReturn {
  return { showAd: false, currentAd: null, dismiss: () => {} }
}

/* ------------------------------------------------------------------ */
/* Full-page ad hooks (for FullPageAd component)                        */
/* — These only care about show/dismiss, no currentAd needed.           */
/* ------------------------------------------------------------------ */

/** Terminal page — 10-minute cooldown (more frequent, but not every time) */
export function useTerminalFullPageAd() {
  const [showAd, setShowAd] = useState(false)

  useEffect(() => {
    const justLoggedIn = consumeJustLoggedIn()
    const key = PAGE_KEYS.terminal
    const timer = setTimeout(() => {
      const now = Date.now()
      const lastShown = Number(localStorage.getItem(key) ?? 0)
      if (!justLoggedIn && now - lastShown < 10 * 60 * 1000) return
      localStorage.setItem(key, String(now))
      setShowAd(true)
    }, justLoggedIn ? 600 : 1200)
    return () => clearTimeout(timer)
  }, [])

  return { showAd, dismiss: () => setShowAd(false) }
}

/** Prices page — 85% probability, 8-min cooldown, shows after 3s */
export function usePricesFullPageAd() {
  const [showAd, setShowAd] = useState(false)

  useEffect(() => {
    const key = PAGE_KEYS.prices
    const timer = setTimeout(() => {
      const now = Date.now()
      const lastShown = Number(localStorage.getItem(key) ?? 0)
      if (now - lastShown < PAGE_COOLDOWNS.prices) return
      if (Math.random() > PAGE_PROBS.prices) return
      localStorage.setItem(key, String(now))
      setShowAd(true)
    }, 3000)
    return () => clearTimeout(timer)
  }, [])

  return { showAd, dismiss: () => setShowAd(false) }
}

/** Learn page — 80% probability, 60-min cooldown, shows after 6s */
export function useLearnFullPageAd() {
  const [showAd, setShowAd] = useState(false)

  useEffect(() => {
    const key = PAGE_KEYS.learn
    const timer = setTimeout(() => {
      const now = Date.now()
      const lastShown = Number(localStorage.getItem(key) ?? 0)
      if (now - lastShown < PAGE_COOLDOWNS.learn) return
      if (Math.random() > PAGE_PROBS.learn) return
      localStorage.setItem(key, String(now))
      setShowAd(true)
    }, 6000)
    return () => clearTimeout(timer)
  }, [])

  return { showAd, dismiss: () => setShowAd(false) }
}

/**
 * Global promo ad — Connect Wallet / Learning Hub / Rewards
 * Shows on ALL pages except /terminal (which has its own plans ad).
 * Shared 5-minute cooldown across all pages via a single localStorage key.
 * Pass the current pathname so it can skip the terminal route.
 */
export function useGlobalPromoAd(pathname: string | null) {
  const [showAd, setShowAd] = useState(false)
  const PROMO_KEY = 'swapsmith_ad_promo_global'
  const PROMO_COOLDOWN = 5 * 60 * 1000 // 5 minutes

  useEffect(() => {
    // Never show on terminal/login/register pages
    if (!pathname) return
    if (pathname.startsWith('/terminal') || pathname.startsWith('/login') || pathname.startsWith('/register')) return

    const timer = setTimeout(() => {
      try {
        const now = Date.now()
        const lastShown = Number(localStorage.getItem(PROMO_KEY) ?? 0)
        if (now - lastShown < PROMO_COOLDOWN) return
        localStorage.setItem(PROMO_KEY, String(now))
        setShowAd(true)
      } catch { /* noop */ }
    }, 4000) // 4s delay so page content loads first

    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  return { showAd, dismiss: () => setShowAd(false) }
}

