'use client';

import Navbar from '@/components/Navbar';
import WatchlistContainer from '@/components/watchlist/WatchlistContainer';

export default function WatchlistPage() {
  return (
    <div className="min-h-screen bg-[rgb(var(--bg-primary))]">
      <Navbar />
      
      <main className="pt-24 pb-12 px-6">
        <div className="max-w-6xl mx-auto">
          <WatchlistContainer />
        </div>
      </main>
    </div>
  );
}
