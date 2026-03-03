'use client'

import { Shield, Lock, Eye, CheckCircle, AlertTriangle, AlertCircle, TrendingUp, BarChart3, Award } from 'lucide-react'
import { useAgentReputation } from '@/hooks/useAgentReputation';

interface TrustIndicatorsProps {
  confidence?: number;
}

export default function TrustIndicators({ confidence }: TrustIndicatorsProps) {
  const { reputation, isLoading } = useAgentReputation();
  
  // Normalize confidence to 0-100 scale if it's 0-1
  const normalizedConfidence = confidence !== undefined
    ? (confidence <= 1 ? confidence * 100 : confidence)
    : undefined;

  const getConfidenceLevel = (score: number) => {
    if (score >= 80) return 'High';
    if (score >= 50) return 'Medium';
    return 'Low';
  };
  
  const getReputationBadge = (successRate: number, totalSwaps: number) => {
     if (successRate >= 98 && totalSwaps > 100) return { label: 'Elite', color: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20' };
     if (successRate >= 95 && totalSwaps > 50) return { label: 'Veteran', color: 'text-purple-400 bg-purple-400/10 border-purple-400/20' };
     if (successRate >= 90 && totalSwaps > 10) return { label: 'Reliable', color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' };
     return { label: 'New', color: 'text-blue-400 bg-blue-400/10 border-blue-400/20' };
  };

  const badge = reputation ? getReputationBadge(reputation.successRate, reputation.totalSwaps) : null;


  const getConfidenceStyles = (score: number) => {
    if (score >= 80) return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    if (score >= 50) return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
    return 'bg-red-500/10 text-red-400 border-red-500/20';
  };

  const getSuccessRateColor = (rate: number) => {
    if (rate >= 90) return 'text-emerald-400';
    if (rate >= 70) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getConfidenceIcon = (score: number) => {
    if (score >= 80) return <CheckCircle className="w-3 h-3" />;
    if (score >= 50) return <AlertTriangle className="w-3 h-3" />;
    return <AlertCircle className="w-3 h-3" />;
  };

  return (
    <div className="flex items-center gap-4">
       {/* Badge Display */}
       {reputation && (
         <div 
           className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full border ${badge?.color} transition-all duration-300`}
           title={`Success Rate: ${reputation.successRate}% across ${reputation.totalSwaps} swaps`}
         >
           <Award className="w-3.5 h-3.5" />
           <span className="text-xs font-bold uppercase tracking-wider">{badge?.label} Agent</span>
         </div>
       )}

       {/* Confidence Meter (Existing) */}
       {normalizedConfidence !== undefined && (
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border ${getConfidenceStyles(normalizedConfidence)} bg-opacity-10 backdrop-blur-sm`}>
            {getConfidenceIcon(normalizedConfidence)}
            <span className="text-xs font-bold uppercase tracking-wider">
              {Math.round(normalizedConfidence)}% Conf.
            </span>
          </div>
       )}
    </div>
  );
}

// Helper functions moved outside or kept inside if simple
const getConfidenceStyles = (score: number) => {
    if (score >= 80) return 'bg-emerald-500 text-emerald-400 border-emerald-500/20';
    if (score >= 50) return 'bg-yellow-500 text-yellow-400 border-yellow-500/20';
    return 'bg-red-500 text-red-400 border-red-500/20';
};


const getConfidenceIcon = (score: number) => {
    if (score >= 80) return <CheckCircle className="w-3.5 h-3.5" />;
    if (score >= 50) return <AlertTriangle className="w-3.5 h-3.5" />;
    return <AlertCircle className="w-3.5 h-3.5" />;
};
