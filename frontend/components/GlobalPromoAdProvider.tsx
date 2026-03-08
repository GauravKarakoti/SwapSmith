'use client'

/**
 * GlobalPromoAdProvider
 * ──────────────────────────────────────────────────────────────────
 * Mounted once in providers.tsx, runs on every page.
 * Shows the 'promo' variant (Connect Wallet / Learning Hub / Rewards)
 * on a 5-minute shared cooldown — skips /terminal (has its own ad).
 * Hidden for Premium and Pro plan users (ad-free benefit).
 */

import { usePathname } from 'next/navigation'
import FullPageAd from '@/components/FullPageAd'
import { useGlobalPromoAd } from '@/hooks/useAds'
import { usePlan } from '@/hooks/usePlan'

export default function GlobalPromoAdProvider() {
  const pathname = usePathname()
  const { showAd, dismiss } = useGlobalPromoAd(pathname ?? '')
  const { status: planStatus } = usePlan()

  // Ad-free for Premium and Pro subscribers
  const isAdFree = planStatus?.plan === 'premium' || planStatus?.plan === 'pro'

  if (!showAd || isAdFree) return null

  return (
    <FullPageAd
      variant="promo"
      duration={14000}
      onDismiss={dismiss}
    />
  )
}
