'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import { ArrowLeft, Plus, Trash2, Activity } from 'lucide-react';
import Link from 'next/link';

// Define types
interface DcaPlan {
  id: number;
  fromAsset: string;
  toAsset: string;
  amount: number;
  frequencyDays: number;
  nextRun: string;
  settleAddress?: string;
  status: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export default function DcaPage() {
  const [initData, setInitData] = useState('');
  const [plans, setPlans] = useState<DcaPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // New Plan Form State
  const [newPlan, setNewPlan] = useState({
    fromAsset: 'USDT',
    toAsset: 'BTC',
    amount: 100,
    frequencyDays: 7,
    settleAddress: ''
  });
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp) {
        const data = (window as any).Telegram.WebApp.initData;
        if (data) {
            setInitData(data);
            fetchPlans(data);
        } else {
            setError('No Telegram Auth Data');
            setLoading(false);
        }
    } else {
        setError('Please open in Telegram');
        setLoading(false);
    }
  }, []);

  const fetchPlans = async (authData: string) => {
    try {
      const res = await axios.get(`${API_URL}/api/dca`, {
          headers: { Authorization: authData }
      });
      setPlans(res.data);
    } catch (err) {
      setError('Failed to fetch plans');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!initData) return;

    try {
      await axios.post(`${API_URL}/api/dca`, {
        ...newPlan,
        fromNetwork: 'ethereum', // Default for now
        toNetwork: 'bitcoin'     // Default for now
      }, {
          headers: { Authorization: initData }
      });
      setShowForm(false);
      fetchPlans(initData);
    } catch (err) {
      alert('Failed to create plan');
    }
  };

  if (error) {
    return (
      <div className="min-h-screen p-8 flex flex-col items-center justify-center text-center">
         <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
         <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-2xl mx-auto">
        <header className="flex items-center justify-between mb-8">
          <Link href="/" className="text-gray-600 hover:text-gray-900 flex items-center gap-2">
            <ArrowLeft className="w-5 h-5" /> Back
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Activity className="w-6 h-6 text-blue-600" />
            Smart DCA Manager
          </h1>
        </header>

        {/* Stats / Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-sm text-blue-800">
          <strong>Smart Feature Active:</strong> Plans automatically adjust based on 24h market volatility.<br/>
          📉 Price Drop {'>'} 5% = Buy 1.5x<br/>
          📈 Price Pump {'>'} 5% = Buy 0.5x
        </div>

        {/* Action Bar */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-semibold text-gray-700">Your Plans</h2>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <Plus className="w-4 h-4" /> New Plan
          </button>
        </div>

        {/* Create Form */}
        {showForm && (
            <form onSubmit={handleCreate} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-6">
                <h3 className="font-semibold mb-4">Create New DCA Plan</h3>
                <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                        <label className="block text-sm text-gray-600 mb-1">From Asset</label>
                        <select
                            className="w-full p-2 border rounded"
                            value={newPlan.fromAsset}
                            onChange={e => setNewPlan({...newPlan, fromAsset: e.target.value})}
                        >
                            <option value="USDT">USDT</option>
                            <option value="USDC">USDC</option>
                            <option value="ETH">ETH</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm text-gray-600 mb-1">To Asset</label>
                        <select
                            className="w-full p-2 border rounded"
                            value={newPlan.toAsset}
                            onChange={e => setNewPlan({...newPlan, toAsset: e.target.value})}
                        >
                            <option value="BTC">BTC</option>
                            <option value="ETH">ETH</option>
                            <option value="SOL">SOL</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm text-gray-600 mb-1">Amount</label>
                        <input
                            type="number"
                            className="w-full p-2 border rounded"
                            value={newPlan.amount}
                            onChange={e => setNewPlan({...newPlan, amount: Number(e.target.value)})}
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-gray-600 mb-1">Frequency (Days)</label>
                        <input
                            type="number"
                            className="w-full p-2 border rounded"
                            value={newPlan.frequencyDays}
                            onChange={e => setNewPlan({...newPlan, frequencyDays: Number(e.target.value)})}
                        />
                    </div>
                    <div className="col-span-2">
                         <label className="block text-sm text-gray-600 mb-1">Destination Address</label>
                         <input
                            type="text"
                            className="w-full p-2 border rounded"
                            placeholder="Enter wallet address"
                            value={newPlan.settleAddress}
                            onChange={e => setNewPlan({...newPlan, settleAddress: e.target.value})}
                            required
                        />
                    </div>
                </div>
                <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-gray-600">Cancel</button>
                    <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">Create Plan</button>
                </div>
            </form>
        )}

        {/* Plans List */}
        {loading ? (
            <div className="text-center py-8 text-gray-500">Loading plans...</div>
        ) : plans.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border border-gray-100">
                <p className="text-gray-500">No active DCA plans found.</p>
            </div>
        ) : (
            <div className="space-y-4">
                {plans.map(plan => (
                    <div key={plan.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <span className="font-bold text-gray-900">{plan.amount} {plan.fromAsset}</span>
                                <span className="text-gray-400">→</span>
                                <span className="font-bold text-gray-900">{plan.toAsset}</span>
                            </div>
                            <div className="text-sm text-gray-500">
                                Every {plan.frequencyDays} days • Next: {new Date(plan.nextRun).toLocaleDateString()}
                            </div>
                            <div className="text-xs text-gray-400 mt-1">
                                Dest: {plan.settleAddress?.substring(0,6)}...{plan.settleAddress?.substring(plan.settleAddress?.length - 4)}
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                                plan.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                            }`}>
                                {plan.status.toUpperCase()}
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        )}
      </div>
    </div>
  );
}
