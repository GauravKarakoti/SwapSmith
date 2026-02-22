'use client'

/**
 * GlobalPromoAdProvider
 * ──────────────────────────────────────────────────────────────────
 * Mounted once in providers.tsx, runs on every page.
 * Shows the 'promo' variant (Connect Wallet / Learning Hub / Rewards)
 * on a 5-minute shared cooldown — skips /terminal (has its own ad).
 */

import { usePathname } from 'next/navigation'
import FullPageAd from '@/components/FullPageAd'
import { useGlobalPromoAd } from '@/hooks/useAds'

export default function GlobalPromoAdProvider() {
  const pathname = usePathname()
  const { showAd, dismiss } = useGlobalPromoAd(pathname ?? '')

  if (!showAd) return null

  return (
    <FullPageAd
      variant="promo"
      duration={14000}
      onDismiss={dismiss}
    />
  )
}
