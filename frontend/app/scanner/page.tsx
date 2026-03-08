'use client';

import { useState } from 'react';
import { SecurityScanner } from '@/utils/security-scanner';
import { mainnet, bsc, polygon, base } from 'viem/chains';
import { SecurityReport } from '@/types/security';
import { AlertTriangle, ShieldCheck, ShieldAlert, BadgeCheck, FileWarning, Search, Loader } from 'lucide-react';

const CHAINS = [
  { id: 'ethereum', name: 'Ethereum', chain: mainnet },
  { id: 'bsc', name: 'BNB Chain', chain: bsc },
  { id: 'polygon', name: 'Polygon', chain: polygon },
  { id: 'base', name: 'Base', chain: base },
];

export default function ScannerPage() {
  const [address, setAddress] = useState('');
  const [selectedChain, setSelectedChain] = useState(CHAINS[0].id);
  const [report, setReport] = useState<SecurityReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleScan = async () => {
    if (!address) {
      setError('Please enter a valid token address');
      return;
    }
    
    setLoading(true);
    setError('');
    setReport(null);

    try {
      const scanner = new SecurityScanner(selectedChain);
      const result = await scanner.scanToken(address);
      setReport(result);
    } catch (err: any) {
      console.error(err);
      setError('Failed to scan token. Please check address and network.');
    } finally {
      setLoading(false);
    }
  };

  const getRiskColor = (score: number) => {
    if (score < 20) return 'text-green-500';
    if (score < 50) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getRiskBg = (score: number) => {
    if (score < 20) return 'bg-green-500';
    if (score < 50) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white p-6 md:p-12">
      <div className="max-w-4xl mx-auto">
        <header className="mb-12 text-center">
          <h1 className="text-3xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-600 mb-4">
            Transaction Security Scanner
          </h1>
          <p className="text-gray-400 text-lg">
            Analyze tokens and smart contracts for potential risks before you transact.
          </p>
        </header>

        <div className="bg-[#111] p-6 rounded-2xl border border-gray-800 shadow-2xl mb-8">
          <div className="flex flex-col md:flex-row gap-4 mb-4">
            <div className="flex-1">
              <label className="block text-sm text-gray-400 mb-2">Token Contract Address</label>
              <div className="relative">
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="0x..."
                  className="w-full bg-[#0a0a0a] border border-gray-700 rounded-xl px-4 py-3 pl-10 focus:outline-none focus:border-blue-500 transition-colors"
                />
                <Search className="absolute left-3 top-3.5 w-5 h-5 text-gray-500" />
              </div>
            </div>
            
            <div className="w-full md:w-48">
              <label className="block text-sm text-gray-400 mb-2">Network</label>
              <select
                value={selectedChain}
                onChange={(e) => setSelectedChain(e.target.value)}
                className="w-full bg-[#0a0a0a] border border-gray-700 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 transition-colors appearance-none"
              >
                {CHAINS.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>
          
          <button
            onClick={handleScan}
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? <Loader className="animate-spin" /> : <ShieldCheck />}
            {loading ? 'Scanning...' : 'Scan Contract'}
          </button>
          
          {error && (
            <div className="mt-4 p-4 bg-red-900/20 border border-red-800 rounded-xl text-red-400 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              {error}
            </div>
          )}
        </div>

        {report && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {/* Risk Score Card */}
              <div className="bg-[#111] p-6 rounded-2xl border border-gray-800 shadow-xl text-center">
                <h3 className="text-gray-400 uppercase text-xs font-bold tracking-wider mb-2">Risk Score</h3>
                <div className={`text-5xl font-black mb-2 ${getRiskColor(report.overallRiskScore)}`}>
                  {report.overallRiskScore}/100
                </div>
                <div className="w-full bg-gray-800 h-2 rounded-full overflow-hidden">
                  <div 
                    className={`h-full ${getRiskBg(report.overallRiskScore)} transition-all duration-1000`} 
                    style={{ width: `${report.overallRiskScore}%` }}
                  />
                </div>
                <p className="mt-2 text-sm text-gray-400">
                  {report.overallRiskScore < 20 ? 'Low Risk' : report.overallRiskScore < 50 ? 'Medium Risk' : 'High Risk'}
                </p>
              </div>

               {/* Honeypot Analysis */}
               <div className="bg-[#111] p-6 rounded-2xl border border-gray-800 shadow-xl">
                 <h3 className="text-gray-400 uppercase text-xs font-bold tracking-wider mb-4">Contract Analysis</h3>
                 <div className="space-y-4">
                   <div className="flex justify-between items-center">
                     <span className="text-gray-300">Verified Source</span>
                     {report.contractVerified ? 
                       <span className="bg-green-900/30 text-green-400 px-2 py-1 rounded text-xs font-bold flex items-center gap-1"><BadgeCheck className="w-3 h-3"/> Yes</span> : 
                       <span className="bg-red-900/30 text-red-400 px-2 py-1 rounded text-xs font-bold flex items-center gap-1"><FileWarning className="w-3 h-3"/> No</span>
                     }
                   </div>
                   <div className="flex justify-between items-center">
                     <span className="text-gray-300">Buy/Sell Tax</span>
                     <span className="text-white font-mono">{report.buyTax}% / {report.sellTax}%</span>
                   </div>
                   <div className="flex justify-between items-center">
                     <span className="text-gray-300">Simulation</span>
                     <span className={report.simulationResult.canSell ? "text-green-400 font-bold" : "text-red-400 font-bold"}>
                       {report.simulationResult.canSell ? 'Sellable' : 'Potential Honeypot'}
                     </span>
                   </div>
                   <div className="flex justify-between items-center">
                     <span className="text-gray-300">Ownership</span>
                     <span className={report.ownershipRenounced ? "text-gray-400" : "text-yellow-400"}>
                        {report.ownershipRenounced ? 'Renounced' : 'Active Owner'}
                     </span>
                   </div>
                 </div>
               </div>

               {/* Holder Stats */}
               <div className="bg-[#111] p-6 rounded-2xl border border-gray-800 shadow-xl">
                 <h3 className="text-gray-400 uppercase text-xs font-bold tracking-wider mb-4">Holder Distribution</h3>
                 <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-300">Total Holders</span>
                      <span className="text-white font-mono">{report.holderAnalysis.totalHolders.toLocaleString()}</span>
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-gray-300">Top 10 Holders</span>
                        <span className={`font-bold ${report.holderAnalysis.topHoldersShare > 50 ? 'text-red-400' : 'text-green-400'}`}>
                          {report.holderAnalysis.topHoldersShare}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-800 h-1.5 rounded-full overflow-hidden">
                        <div 
                          className={`h-full ${report.holderAnalysis.topHoldersShare > 50 ? 'bg-red-500' : 'bg-green-500'}`} 
                          style={{ width: `${Math.min(report.holderAnalysis.topHoldersShare, 100)}%` }} 
                        />
                      </div>
                    </div>
                 </div>
               </div>
            </div>

            {report.details.length > 0 && (
              <div className="bg-red-900/10 border border-red-900/30 p-6 rounded-2xl">
                <h3 className="text-red-400 font-bold flex items-center gap-2 mb-4">
                  <ShieldAlert className="w-5 h-5" /> Risk Factors Detected
                </h3>
                <ul className="space-y-2">
                  {report.details.map((detail, idx) => (
                    <li key={idx} className="text-red-300 flex items-start gap-2">
                      <span className="mt-1.5 w-1.5 h-1.5 bg-red-500 rounded-full shrink-0" />
                      {detail}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            <div className="mt-8 text-center text-gray-500 text-sm">
              <p>Disclaimer: This automated scan simulates transactions and checks verifiable data. It does not guarantee safety. Do your own research.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
