'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider, createConfig, http } from 'wagmi'
import { mainnet, polygon, arbitrum, avalanche, optimism, bsc, base } from 'wagmi/chains'
import { injected } from 'wagmi/connectors'

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
  base
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
  },
  ssr: true,
})

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  )
}