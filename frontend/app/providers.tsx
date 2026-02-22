'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider, createConfig, http } from 'wagmi'
import { mainnet, polygon, arbitrum, avalanche, optimism, bsc, base, sepolia } from 'wagmi/chains'
import { injected } from 'wagmi/connectors'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { useEffect } from 'react'
import { initializeRewards } from '@/lib/rewards-service'
import { useAuth } from '@/hooks/useAuth'
import GlobalPromoAdProvider from '@/components/GlobalPromoAdProvider'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3,
      retryDelay: 1000,
    },
  },
})

const supportedChains = [
  mainnet, 
  polygon, 
  arbitrum, 
  avalanche, 
  optimism, 
  bsc, 
  base,
  sepolia,
] as const;

const config = createConfig({
  chains: supportedChains,
  connectors: [
    injected(),
  ],
  transports: {
    [mainnet.id]: http(),
    [polygon.id]: http(),
    [arbitrum.id]: http(),
    [avalanche.id]: http(),
    [optimism.id]: http(),
    [bsc.id]: http(),
    [base.id]: http(),
    [sepolia.id]: http(),
  },
  ssr: true,
})

/**
 * Component to track daily login rewards
 */
function RewardsInitializer() {
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      // Initialize daily login tracking when user is authenticated
      initializeRewards();
    }
  }, [user]);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          <RewardsInitializer />
          <GlobalPromoAdProvider />
          {children}
        </QueryClientProvider>
      </WagmiProvider>
    </ThemeProvider>
  )
}