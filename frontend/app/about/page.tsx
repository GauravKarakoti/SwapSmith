// 'use client';

// import Navbar from '@/components/Navbar';
// import Footer from '@/components/Footer';

// export default function AboutPage() {
//   return (
//     <>
//       <Navbar />
//       <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 pt-16 sm:pt-20">
//         <div className="container mx-auto px-4 py-8 max-w-2xl">
//           <h1 className="text-3xl font-bold mb-4 text-blue-600">About SwapSmith</h1>
//           <p className="text-lg text-gray-700 dark:text-gray-300 mb-6">
//             SwapSmith is a real-time cryptocurrency price tracker, providing up-to-date prices for hundreds of coins. Powered by the CoinGecko API, SwapSmith features live price updates, search and sorting, and highlights top-performing assets.
//           </p>
//           <p className="mb-4 text-gray-600 dark:text-gray-400">
//             Designed for crypto enthusiasts and traders, SwapSmith makes monitoring the market easy and accessible. Prices auto-refresh every 5 minutes, and you can instantly update prices with the refresh button.
//           </p>
//           <p className="mb-4 text-gray-600 dark:text-gray-400">
//             <strong>Data Source:</strong> CoinGecko API
//           </p>
//           <p className="mb-4 text-gray-600 dark:text-gray-400">
//             <strong>Feedback:</strong> For feedback or support, please contact us.
//           </p>
//         </div>
//       </div>
//       <Footer />
//     </>
//   );
// }


'use client';

import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export default function AboutPage() {
  return (
    <>
      <Navbar />

      {/* Page Wrapper */}
      <div className="min-h-screen pt-16 sm:pt-20 bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-900 dark:via-slate-950 dark:to-slate-900">

        {/* Hero Section */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.15),_transparent_60%)] dark:bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.08),_transparent_60%)]" />

          <div className="relative container mx-auto px-6 py-20 text-center max-w-4xl">
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">
              About SwapSmith
            </h1>
            <p className="mt-6 text-lg sm:text-xl text-slate-600 dark:text-slate-400">
              A real-time cryptocurrency price tracker built for clarity, speed, and smart decisions.
            </p>
          </div>
        </section>

        {/* Content Section */}
        <section className="container mx-auto px-6 pb-20">
          <div className="max-w-5xl mx-auto">

            {/* Glass Card */}
            <div className="backdrop-blur-xl bg-white/80 dark:bg-slate-900/70 border border-slate-200/60 dark:border-slate-800 rounded-3xl shadow-xl p-8 sm:p-12">

              <p className="text-lg leading-relaxed text-slate-700 dark:text-slate-300">
                <span className="font-semibold text-slate-900 dark:text-white">
                  SwapSmith
                </span>{' '}
                is a modern cryptocurrency price tracking platform that delivers
                real-time market data for hundreds of digital assets. Powered by the
                <span className="font-medium text-blue-600 dark:text-blue-400">
                  {' '}CoinGecko API
                </span>, it ensures fast, accurate, and reliable pricing at all times.
              </p>

              <p className="mt-6 text-slate-600 dark:text-slate-400">
                Designed for traders, investors, and crypto enthusiasts, SwapSmith
                makes it effortless to explore market trends, monitor top-performing
                assets, and stay informed without clutter or distractions.
              </p>

              {/* Feature Grid */}
              <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-6">
                {[
                  {
                    title: 'Live Market Prices',
                    desc: 'Real-time price updates for hundreds of cryptocurrencies.',
                  },
                  {
                    title: 'Smart Search & Sorting',
                    desc: 'Quickly find coins and rank them by price, volume, or performance.',
                  },
                  {
                    title: 'Auto Refresh',
                    desc: 'Prices refresh automatically every 5 minutes.',
                  },
                  {
                    title: 'Manual Refresh',
                    desc: 'Instantly fetch the latest prices with a single click.',
                  },
                ].map((item, idx) => (
                  <div
                    key={idx}
                    className="rounded-2xl border border-slate-200 dark:border-slate-800 p-6 hover:shadow-lg transition-all bg-white dark:bg-slate-950"
                  >
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                      {item.title}
                    </h3>
                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                      {item.desc}
                    </p>
                  </div>
                ))}
              </div>

              {/* Info Footer */}
              <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
                <div className="rounded-xl bg-slate-100 dark:bg-slate-800/60 p-5">
                  <p className="font-semibold text-slate-900 dark:text-white">
                    Data Source
                  </p>
                  <p className="mt-1 text-slate-600 dark:text-slate-400">
                    CoinGecko API
                  </p>
                </div>

                <div className="rounded-xl bg-slate-100 dark:bg-slate-800/60 p-5">
                  <p className="font-semibold text-slate-900 dark:text-white">
                    Feedback & Support
                  </p>
                  <p className="mt-1 text-slate-600 dark:text-slate-400">
                    We’d love to hear your feedback and suggestions.
                  </p>
                </div>
              </div>

            </div>
          </div>
        </section>
      </div>

      <Footer />
    </>
  );
}
