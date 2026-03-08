'use client';

import Navbar from '@/components/Navbar';
import StrategyMarketplace from '@/components/StrategyMarketplace';

export default function StrategiesPage() {
  return (
    <div className="min-h-screen bg-[rgb(var(--bg-primary))]">
      <Navbar />
      
      <main className="pt-24 pb-12 px-6">
        <div className="max-w-6xl mx-auto">
          <StrategyMarketplace />
        </div>
      </main>
    </div>
  );
}
