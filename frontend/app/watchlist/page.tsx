import Watchlist from '@/components/Watchlist';

export const metadata = {
  title: 'Watchlist | SwapSmith',
  description: 'Track your favorite tokens and monitor prices in real-time',
};

export default function WatchlistPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pt-20 pb-12">
      <div className="container mx-auto px-4">
        <Watchlist />
      </div>
    </div>
  );
}
