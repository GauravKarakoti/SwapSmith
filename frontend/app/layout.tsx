'use client'

import './globals.css'
import { Inter } from 'next/font/google'
import { Providers } from './providers'
import { Toaster } from 'react-hot-toast'
import RewardToast from '@/components/RewardToast'

const inter = Inter({ subsets: ['latin'] })

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="icon" href="/swapsmithicon.png" />
      </head>
      <body className={`${inter.className} bg-[#050505] text-white min-h-screen selection:bg-blue-500/30`}>
        {/* Animated Background Mesh */}
        <div className="fixed inset-0 z-[-1]">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-600/10 blur-[120px]" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-purple-600/10 blur-[120px]" />
        </div>
        <Providers>{children}</Providers>
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
      </body>
    </html>
  )
}