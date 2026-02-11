'use client'

import { Shield, Lock, Eye, CheckCircle } from 'lucide-react'

export default function TrustIndicators() {
  return (
    <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5 backdrop-blur-sm">
      {/* Header with Beta Tag */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-blue-500/10 rounded-lg">
            <Shield className="w-5 h-5 text-blue-400" />
          </div>
          <h3 className="text-sm font-bold text-white tracking-tight">
            Secure Trading
          </h3>
        </div>
        <span className="text-[10px] font-black uppercase tracking-widest bg-blue-500/20 text-blue-400 px-2.5 py-1 rounded-md border border-blue-500/30">
          Beta
        </span>
      </div>
      
      {/* Features Grid */}
      <div className="grid grid-cols-2 gap-y-4 gap-x-6">
        <div className="flex items-center gap-3 group">
          <Lock className="w-4 h-4 text-emerald-500/80 group-hover:text-emerald-400 transition-colors" />
          <span className="text-xs font-medium text-gray-400 group-hover:text-gray-200 transition-colors">
            Non-custodial
          </span>
        </div>
        
        <div className="flex items-center gap-3 group">
          <Eye className="w-4 h-4 text-emerald-500/80 group-hover:text-emerald-400 transition-colors" />
          <span className="text-xs font-medium text-gray-400 group-hover:text-gray-200 transition-colors">
            Transparent fees
          </span>
        </div>

        <div className="flex items-center gap-3 group">
          <CheckCircle className="w-4 h-4 text-emerald-500/80 group-hover:text-emerald-400 transition-colors" />
          <span className="text-xs font-medium text-gray-400 group-hover:text-gray-200 transition-colors">
            Rate guaranteed
          </span>
        </div>

        <div className="flex items-center gap-3 group">
          <Shield className="w-4 h-4 text-emerald-500/80 group-hover:text-emerald-400 transition-colors" />
          <span className="text-xs font-medium text-gray-400 group-hover:text-gray-200 transition-colors">
            Audited
          </span>
        </div>
      </div>
    </div>
  )
}