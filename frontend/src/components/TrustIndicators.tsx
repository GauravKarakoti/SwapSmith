'use client'

import { Shield, Lock, Eye, CheckCircle } from 'lucide-react'

export default function TrustIndicators() {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-blue-800 flex items-center gap-2">
          <Shield className="w-5 h-5" />
          Secure Trading
        </h3>
        <span className="text-sm bg-blue-100 text-blue-700 px-2 py-1 rounded">Beta</span>
      </div>
      
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div className="flex items-center gap-2">
          <Lock className="w-4 h-4 text-green-600" />
          <span className="text-gray-900">Non-custodial</span>
        </div>
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-green-600" />
          <span className="text-gray-900">Transparent fees</span>
        </div>
        <div className="flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-green-600" />
          <span className="text-gray-900">Rate guaranteed</span>
        </div>
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-green-600" />
          <span className="text-gray-900">Audited</span>
        </div>
      </div>
    </div>
  )
}