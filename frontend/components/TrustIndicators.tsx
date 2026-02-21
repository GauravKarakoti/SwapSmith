'use client'

import { Shield, Lock, Eye, CheckCircle, AlertTriangle, AlertCircle } from 'lucide-react'

interface TrustIndicatorsProps {
  confidence?: number;
}

export default function TrustIndicators({ confidence }: TrustIndicatorsProps) {
  // Normalize confidence to 0-100 scale if it's 0-1
  const normalizedConfidence = confidence !== undefined
    ? (confidence <= 1 ? confidence * 100 : confidence)
    : undefined;

  const getConfidenceLevel = (score: number) => {
    if (score >= 80) return 'High';
    if (score >= 50) return 'Medium';
    return 'Low';
  };

  const getConfidenceStyles = (score: number) => {
    if (score >= 80) return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    if (score >= 50) return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
    return 'bg-red-500/10 text-red-400 border-red-500/20';
  };

  const getConfidenceIcon = (score: number) => {
    if (score >= 80) return <CheckCircle className="w-3 h-3" />;
    if (score >= 50) return <AlertTriangle className="w-3 h-3" />;
    return <AlertCircle className="w-3 h-3" />;
  };

  return (
    <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5 backdrop-blur-sm transition-all duration-300">
      {/* Header with Status/Confidence */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-blue-500/10 rounded-lg">
            <Shield className="w-5 h-5 text-blue-400" />
          </div>
          <h3 className="text-sm font-bold text-white tracking-tight">
            {normalizedConfidence !== undefined ? 'Analysis Confidence' : 'Secure Trading'}
          </h3>
        </div>

        {normalizedConfidence !== undefined ? (
           <div
             className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border ${getConfidenceStyles(normalizedConfidence)}`}
             title={`Confidence Score: ${normalizedConfidence.toFixed(1)}%`}
           >
             {getConfidenceIcon(normalizedConfidence)}
             <span className="text-[10px] font-bold uppercase tracking-widest">
               {getConfidenceLevel(normalizedConfidence)}
             </span>
           </div>
        ) : (
          <span className="text-[10px] font-black uppercase tracking-widest bg-blue-500/20 text-blue-400 px-2.5 py-1 rounded-md border border-blue-500/30">
            Beta
          </span>
        )}
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
