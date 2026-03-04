'use client'

import { motion } from 'framer-motion'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import PortfolioRebalance from '@/components/PortfolioRebalance'
import { PieChart, ShieldCheck, Zap } from 'lucide-react'

export default function PortfolioPageClient() {
  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-[#050505] text-slate-900 dark:text-white relative overflow-hidden">
      {/* Background Gradients */}
      <div className="absolute inset-0 z-0 pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-500/5 dark:bg-blue-600/10 blur-[120px]" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-purple-500/5 dark:bg-purple-600/10 blur-[120px]" />
      </div>

      <Navbar />
      
      <main className="flex-grow container mx-auto px-4 py-8 pt-24 max-w-7xl relative z-10">
        
        {/* Header Section */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-10"
        >
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-2 text-sm font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-widest">
                 <Zap className="w-4 h-4" />
                 Automated Wealth Management
              </div>
              <h1 className="text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 via-slate-700 to-slate-900 dark:from-white dark:via-slate-200 dark:to-slate-400 mb-4 tracking-tight">
                Smart Portfolio
              </h1>
              <p className="text-slate-600 dark:text-slate-400 text-lg max-w-2xl leading-relaxed">
                Monitor your assets, analyze performance, and automate rebalancing to maintain your target allocations with zero drift.
              </p>
            </div>
            
            <div className="flex gap-3">
               <motion.div 
                 whileHover={{ scale: 1.05 }}
                 className="px-4 py-2 rounded-full bg-blue-50/50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-500/30 text-blue-700 dark:text-blue-300 text-sm font-medium flex items-center gap-2 backdrop-blur-sm shadow-sm"
               >
                 <ShieldCheck className="w-4 h-4" />
                 Secure Execution
               </motion.div>
            </div>
          </div>
          
          <div className="h-px w-full bg-gradient-to-r from-transparent via-slate-200 dark:via-slate-800 to-transparent opacity-50" />
        </motion.div>

        {/* Main Content Card */}
        <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="bg-white/80 dark:bg-[#0a0a0a]/80 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-3xl p-6 md:p-8 shadow-2xl shadow-blue-900/5 ring-1 ring-slate-900/5"
        >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 pb-6 border-b border-slate-100 dark:border-white/5">
                <div className="flex items-center gap-4">
                    <div className="p-3.5 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg shadow-blue-500/20 text-white">
                        <PieChart className="w-6 h-6" />
                    </div>
                    <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Active Strategies</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Manage your portfolio targets and automated rules</p>
                    </div>
                </div>
            </div>
            
            <div className="mt-6">
                <PortfolioRebalance />
            </div>
        </motion.div>

      </main>
      
      <Footer />
    </div>
  )
}
