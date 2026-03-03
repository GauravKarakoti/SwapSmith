import PortfolioRebalance from '@/components/PortfolioRebalance';

export const metadata = {
  title: 'Portfolio Rebalancing | SwapSmith',
  description: 'Automatically rebalance your crypto portfolio when allocations drift beyond your target threshold',
};

export default function PortfolioPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pt-20 pb-12">
      <div className="container mx-auto px-4">
        <PortfolioRebalance />
      </div>
    </div>
  );
}
