'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import { motion } from 'framer-motion'
import styles from './not-found.module.css'
import { ArrowRight, Compass, Home, Orbit, TerminalSquare, TriangleAlert } from 'lucide-react'
import Navbar from '@/components/Navbar'

export default function NotFound() {
  useEffect(() => {
    document.body.dataset.pageType = 'not-found'
    return () => {
      delete document.body.dataset.pageType
    }
  }, [])

  return (
    <div className="relative min-h-screen overflow-hidden bg-white text-slate-900 dark:bg-[#050505] dark:text-white">
      <Navbar />

      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-[-12%] top-[8%] h-72 w-72 rounded-full bg-cyan-500/14 blur-3xl dark:bg-cyan-500/18" />
        <div className="absolute right-[-10%] top-[18%] h-80 w-80 rounded-full bg-blue-600/10 blur-3xl dark:bg-blue-500/18" />
        <div className="absolute bottom-[-8%] left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-fuchsia-500/10 blur-3xl dark:bg-fuchsia-500/15" />
        <div className={`${styles.grid} absolute inset-0 opacity-55 dark:opacity-35`} />
        <div className={`${styles.noise} absolute inset-0 opacity-30 dark:opacity-20`} />
      </div>

      <main className="relative isolate flex min-h-screen items-center justify-center px-4 pb-8 pt-24 sm:px-6 sm:pb-10 sm:pt-28 lg:px-8 lg:pt-32">
        <div className="flex w-full max-w-280 flex-col items-center gap-6 sm:gap-7">
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.7, ease: 'easeOut', delay: 0.08 }}
            className="relative flex w-full justify-center"
          >
            <div className="relative w-full max-w-170">
              <div className={`${styles.ringLarge} absolute left-1/2 top-1/2 h-120 w-120 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-400/15`} />
              <div className={`${styles.ringSmall} absolute left-1/2 top-1/2 h-90 w-90 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10`} />
              <div className={`${styles.signal} absolute left-1/2 top-1/2 h-84 w-84 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle_at_center,rgba(34,211,238,0.2),transparent_62%)] blur-2xl dark:bg-[radial-gradient(circle_at_center,rgba(34,211,238,0.24),transparent_62%)]`} />

              <div className={`${styles.panel} relative overflow-hidden rounded-[34px] border border-slate-200/80 bg-white/78 p-5 shadow-[0_30px_120px_rgba(15,23,42,0.14)] backdrop-blur-2xl dark:border-white/10 dark:bg-[#09111f]/70 sm:p-6`}>
                <div className={`${styles.beam} absolute inset-x-8 top-0 h-24`} />
                <div className="relative flex items-center justify-between">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 dark:text-zinc-500">Route Diagnostics</div>
                    <div className="mt-2 text-base font-black text-slate-900 dark:text-white sm:text-xl">Missing endpoint intercepted</div>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-500 dark:text-rose-300 sm:h-14 sm:w-14">
                    <TriangleAlert className="h-5 w-5" />
                  </div>
                </div>

                <div className="relative mt-6 grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-5">
                  <div className={`${styles.digitCard} rounded-[30px] border border-slate-200/70 bg-white/85 px-4 py-8 text-center dark:border-white/10 dark:bg-white/5 sm:px-5 sm:py-10`}>
                    <div className="text-6xl font-black tracking-[-0.08em] text-slate-950 dark:text-white sm:text-7xl md:text-8xl">4</div>
                  </div>

                  <div className="relative flex h-36 w-36 items-center justify-center sm:h-44 sm:w-44">
                    <div className={`${styles.core} absolute inset-0 rounded-full border border-cyan-400/30 bg-white/80 shadow-[0_20px_80px_rgba(14,165,233,0.2)] dark:bg-white/6`} />
                    <div className={`${styles.orbit} absolute inset-3 rounded-full border border-dashed border-cyan-400/25`} />
                    <div className={`${styles.orbitReverse} absolute inset-7 rounded-full border border-white/15 dark:border-white/10`} />
                    <div className={`${styles.scanline} absolute left-1/2 top-1/2 h-[82%] w-0.5 -translate-x-1/2 -translate-y-1/2 bg-linear-to-b from-transparent via-cyan-400 to-transparent`} />
                    <div className="relative text-center">
                      <div className="text-5xl font-black tracking-[-0.08em] text-slate-950 dark:text-white sm:text-6xl">0</div>
                      <div className="mt-1 text-[10px] font-black uppercase tracking-[0.28em] text-cyan-700 dark:text-cyan-300 sm:text-xs">Searching</div>
                    </div>
                  </div>

                  <div className={`${styles.digitCard} rounded-[30px] border border-slate-200/70 bg-white/85 px-4 py-8 text-center dark:border-white/10 dark:bg-white/5 sm:px-5 sm:py-10`}>
                    <div className="text-6xl font-black tracking-[-0.08em] text-slate-950 dark:text-white sm:text-7xl md:text-8xl">4</div>
                  </div>
                </div>

                <div className="relative mt-6 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[28px] border border-slate-200/70 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-white/4">
                    <div className="flex items-start gap-4">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-300">
                        <Orbit className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-xs font-black uppercase tracking-[0.24em] text-slate-400 dark:text-zinc-500">Status</div>
                        <div className="mt-2 text-base font-black text-slate-900 dark:text-white">No route matched your request</div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[28px] border border-slate-200/70 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-white/4">
                    <div className="flex items-start gap-4">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-300">
                        <TerminalSquare className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-xs font-black uppercase tracking-[0.24em] text-slate-400 dark:text-zinc-500">Hint</div>
                        <div className="mt-2 text-base font-black text-slate-900 dark:text-white">Use live prices, scanner, or docs to recover fast</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/"
              className="group inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-6 py-3.5 text-sm font-black text-white shadow-[0_18px_50px_rgba(15,23,42,0.22)] transition-all hover:-translate-y-0.5 hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-zinc-200"
            >
              <Home className="h-4 w-4" />
              Return Home
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>

            <Link
              href="/scanner"
              className="group inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200/80 bg-white/75 px-6 py-3.5 text-sm font-black text-slate-900 backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:border-cyan-400/50 hover:text-cyan-700 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:border-cyan-400/40 dark:hover:text-cyan-300"
            >
              <Compass className="h-4 w-4" />
              Open Scanner
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}