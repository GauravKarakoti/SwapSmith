import PortfolioPageClient from '@/components/PortfolioPageClient'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Portfolio Rebalancing | SwapSmith',
  description: 'Automatically rebalance your crypto portfolio when allocations drift beyond your target threshold',
}

export default function PortfolioPage() {
  return <PortfolioPageClient />
}

