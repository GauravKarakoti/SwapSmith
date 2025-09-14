'use client'

// 1. Import the new WagmiProvider component and the createConfig function
import { WagmiProvider, createConfig, http } from 'wagmi'
// 2. Import chains from the new 'wagmi/chains' path
import { mainnet } from 'wagmi/chains'
// 3. Import connectors for wallet connections (e.g., MetaMask)
import { injected } from 'wagmi/connectors'
import './globals.css'
import { Inter } from 'next/font/google'
import { Providers } from './providers'

// 4. configureChains is removed. Configure everything inside createConfig.
const config = createConfig({
  // An array of chains you want to support
  chains: [mainnet],
  // An array of connectors for connecting wallets
  connectors: [
    injected(), // This handles browser wallets and the auto-connect logic
  ],
  // The new transport system. `http()` is the replacement for `publicProvider()`.
  transports: {
    [mainnet.id]: http(),
  },
  // ssr is needed for server-side rendering frameworks like Next.js
  ssr: true, 
})

const inter = Inter({ subsets: ['latin'] })

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>
          <WagmiProvider config={config}>
            {children}
          </WagmiProvider>
        </Providers>
      </body>
    </html>
  )
}