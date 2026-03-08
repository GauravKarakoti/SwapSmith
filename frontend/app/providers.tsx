'use client'

import { ThemeProvider } from '@/contexts/ThemeContext'
import { useEffect, useState } from 'react'
import { initializeRewards } from '@/lib/rewards-service'
import { useAuth } from '@/hooks/useAuth'
import GlobalPromoAdProvider from '@/components/GlobalPromoAdProvider'
import { usePageTracking } from '@/hooks/usePageTracking'
import dynamic from 'next/dynamic'
import { Toaster } from 'react-hot-toast'
import RewardToast from '@/components/RewardToast'

const Web3Provider = dynamic(
  () => import('./Web3Provider'),
  { 
    ssr: false,
    loading: () => <div className="min-h-screen bg-gray-900" />
  }
)


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
  const [shouldLoadWeb3, setShouldLoadWeb3] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setShouldLoadWeb3(true)
    }, 100)

    return () => clearTimeout(timer)
  }, [])

  return (
    <ThemeProvider>
      {shouldLoadWeb3 ? (
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
      ) : (
        <>
          <PageTrackingInitializer />
          <GlobalPromoAdProvider />
          {children}
        </>
      )}
    </ThemeProvider>
  )
}