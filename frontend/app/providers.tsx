'use client'

import { ThemeProvider } from '@/contexts/ThemeContext'
import { useEffect } from 'react'
import { initializeRewards } from '@/lib/rewards-service'
import { useAuth } from '@/hooks/useAuth'
import GlobalPromoAdProvider from '@/components/GlobalPromoAdProvider'
import { usePageTracking } from '@/hooks/usePageTracking'
import Web3Provider from './Web3Provider'
import { Toaster } from 'react-hot-toast'
import RewardToast from '@/components/RewardToast'


/**
 * Component to track page visits on every route change
 */
function PageTrackingInitializer() {
  usePageTracking()
  return null
}

/**
 * Component to track daily login rewards
 */
function RewardsInitializer() {
  const { user } = useAuth()

  useEffect(() => {
    if (user) {
      initializeRewards()
    }
  }, [user])

  return null
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <Web3Provider>
        <PageTrackingInitializer />
        <RewardsInitializer />
        <GlobalPromoAdProvider />
        {children}
        <RewardToast />
        <Toaster
          position="top-center"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#18181b',
              color: '#fff',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '12px',
              padding: '16px',
            },
            success: {
              iconTheme: {
                primary: '#10b981',
                secondary: '#18181b',
              },
            },
            error: {
              iconTheme: {
                primary: '#ef4444',
                secondary: '#18181b',
              },
            },
          }}
        />
      </Web3Provider>

    </ThemeProvider>
  )
}