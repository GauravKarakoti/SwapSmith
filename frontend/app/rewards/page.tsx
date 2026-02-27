'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Trophy,
  Star,
  Award,
  TrendingUp,
  BookOpen,
  Lightbulb,
  Coins,
  Zap,
  Clock,
  CheckCircle,
  ArrowLeft,
  Crown,
  Medal,
  Gift,
  Wallet,
  ExternalLink,
  Loader2,
  AlertCircle
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useAccount } from 'wagmi'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { authenticatedFetch } from '@/lib/api-client'

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_REWARD_TOKEN_ADDRESS ?? ''

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface UserStats {
  totalPoints: number
  totalTokensClaimed: string
  totalTokensPending: string
  rank: number | null
  completedCourses: number
}

interface CourseProgress {
  id: string
  courseId: string
  courseTitle: string
  completedModules: string[]
  totalModules: number
  isCompleted: boolean
  completionDate: string | null
  lastAccessed: string
}

interface RewardActivity {
  id: string
  actionType: string
  pointsEarned: number
  tokensPending: string
  mintStatus: string
  createdAt: string
  actionMetadata: Record<string, unknown> | null
}

interface LeaderboardEntry {
  rank: number
  userId: string
  userName: string
  totalPoints: number
  totalTokensClaimed: string
  isCurrentUser?: boolean
}

export default function RewardsPage() {
  const router = useRouter()
  const { user, isLoading: authLoading } = useAuth()
  const { address: connectedWallet, isConnected } = useAccount()
  const [activeTab, setActiveTab] = useState<'overview' | 'courses' | 'leaderboard' | 'claim'>('overview')
  const [stats, setStats] = useState<UserStats | null>(null)
  const [courses, setCourses] = useState<CourseProgress[]>([])
  const [activities, setActivities] = useState<RewardActivity[]>([])
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [claiming, setClaiming] = useState(false)
  const [walletAddress, setWalletAddress] = useState('')
  const [claimTxHash, setClaimTxHash] = useState<string | null>(null)
  const [claimError, setClaimError] = useState<string | null>(null)

  // Auto-fill wallet from MetaMask when the user connects
  useEffect(() => {
    if (connectedWallet && !walletAddress) {
      setWalletAddress(connectedWallet)
    }
  }, [connectedWallet, walletAddress])

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login')
    } else if (user) {
      loadRewardsData()
    }
  }, [user, authLoading, router])

  const loadRewardsData = async () => {
    try {
      setLoading(true)
      const statsRes = await authenticatedFetch('/api/rewards/stats')
      if (statsRes.ok) setStats(await statsRes.json())

      const coursesRes = await authenticatedFetch('/api/rewards/courses')
      if (coursesRes.ok) setCourses(await coursesRes.json())

      const activitiesRes = await authenticatedFetch('/api/rewards/activities')
      if (activitiesRes.ok) setActivities(await activitiesRes.json())

      const leaderboardRes = await authenticatedFetch('/api/rewards/leaderboard')
      if (leaderboardRes.ok) setLeaderboard(await leaderboardRes.json())
    } catch (error) {
      console.error('Error loading rewards data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleClaimTokens = async () => {
    if (!stats || parseFloat(stats.totalTokensPending) === 0) return
    const trimmed = walletAddress.trim()
    if (!trimmed || !/^0x[0-9a-fA-F]{40}$/.test(trimmed)) {
      setClaimError('Please enter a valid Ethereum wallet address (0x…)')
      return
    }
    setClaiming(true)
    setClaimTxHash(null)
    setClaimError(null)
    try {
      const res = await authenticatedFetch('/api/rewards/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: trimmed }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setClaimTxHash(data.txHash)
        await loadRewardsData()
      } else {
        setClaimError(data.error || 'Failed to claim tokens. Please try again.')
      }
    } catch (error) {
      setClaimError('Network error. Please try again.')
    } finally {
      setClaiming(false)
    }
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-primary">
        <Navbar />
        <div className="pt-20 flex items-center justify-center h-[calc(100vh-80px)]">
          <Loader2 className="w-10 h-10 text-accent-primary animate-spin" />
        </div>
      </div>
    )
  }

  const getActionIcon = (type: string) => {
    switch (type) {
      case 'course_complete': return <BookOpen className="w-4 h-4" />
      case 'module_complete': return <CheckCircle className="w-4 h-4" />
      case 'daily_login': return <Clock className="w-4 h-4" />
      case 'swap_complete': return <Zap className="w-4 h-4" />
      case 'referral': return <Gift className="w-4 h-4" />
      default: return <Star className="w-4 h-4" />
    }
  }

  const getActionLabel = (type: string) => {
    return type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
  }

  return (
    <div className="min-h-screen bg-primary transition-colors duration-500">
      <Navbar />
      
      <main className="pt-32 pb-24 px-4 sm:px-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-12">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-muted hover:text-primary transition-colors mb-6 group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span className="text-sm font-bold uppercase tracking-widest">Back</span>
          </button>
          
          <div className="flex items-center gap-6 mb-2">
            <div className="p-4 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-[1.5rem] shadow-xl shadow-orange-500/20">
              <Trophy className="w-10 h-10 text-white" />
            </div>
            <div className="flex-1">
              <h1 className="text-4xl sm:text-5xl font-black text-primary tracking-tighter">Rewards <span className="gradient-text">Center</span></h1>
              <p className="text-secondary font-medium mt-1">Track your contribution and claim SMTH governance tokens.</p>
            </div>
          </div>
        </div>

        {/* Stats Cards - Redesigned as Hifi Modules */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 mb-12">
          {[
            { label: 'Total Points', val: stats?.totalPoints || 0, icon: Star, color: 'text-blue-400', bg: 'bg-blue-500/10' },
            { label: 'Tokens Pending', val: parseFloat(stats?.totalTokensPending || '0').toFixed(2), icon: Coins, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
            { label: 'Tokens Claimed', val: parseFloat(stats?.totalTokensClaimed || '0').toFixed(2), icon: Wallet, color: 'text-purple-400', bg: 'bg-purple-500/10' },
            { label: 'Global Rank', val: stats?.rank ? `#${stats.rank}` : '—', icon: Trophy, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
          ].map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="glow-card rounded-3xl p-6 border-primary"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className={`p-2 ${item.bg} rounded-xl`}>
                  <item.icon className={`w-5 h-5 ${item.color}`} />
                </div>
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted">{item.label}</h3>
              </div>
              <p className="text-3xl font-black text-primary tracking-tighter">{item.val}</p>
            </motion.div>
          ))}
        </div>

        {/* Tabs - Theme Integrated */}
        <div className="flex gap-2 mb-8 overflow-x-auto border-b border-primary no-scrollbar">
          {[
            { id: 'overview', label: 'Overview', icon: TrendingUp },
            { id: 'courses', label: 'Learning Progress', icon: BookOpen },
            { id: 'leaderboard', label: 'Leaderboard', icon: Crown },
            { id: 'claim', label: 'Claim Tokens', icon: Wallet },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex items-center gap-2 px-6 py-4 text-sm font-bold transition-all whitespace-nowrap relative ${
                activeTab === tab.id ? 'text-accent-primary' : 'text-muted hover:text-primary'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {activeTab === tab.id && (
                <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-1 bg-accent-primary rounded-t-full shadow-[0_-4px_12px_rgba(var(--accent),0.5)]" />
              )}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          {activeTab === 'overview' && (
            <motion.div key="overview" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-8">
              <div className="glow-card rounded-[2.5rem] border-primary p-8">
                <h2 className="text-2xl font-black text-primary mb-6 flex items-center gap-3 tracking-tighter">
                  <Award className="w-6 h-6 text-accent-primary" />
                  Recent Activity Stream
                </h2>
                <div className="space-y-4">
                  {activities.length === 0 ? (
                    <div className="text-center py-16 bg-secondary rounded-3xl border border-dashed border-primary">
                      <Clock className="w-12 h-12 text-muted mx-auto mb-4" />
                      <p className="text-secondary font-bold">No data found in your feed.</p>
                      <p className="text-xs text-muted mt-1 uppercase tracking-widest">Start swapping or learning to generate logs.</p>
                    </div>
                  ) : (
                    activities.slice(0, 8).map((activity) => (
                      <div key={activity.id} className="flex items-center justify-between p-5 bg-section rounded-2xl border border-primary hover:bg-section-hover transition-all group">
                        <div className="flex items-center gap-4">
                          <div className="p-3 bg-tertiary rounded-xl text-accent-primary group-hover:scale-110 transition-transform">
                            {getActionIcon(activity.actionType)}
                          </div>
                          <div>
                            <p className="text-primary font-bold text-sm tracking-tight">{getActionLabel(activity.actionType)}</p>
                            <p className="text-[10px] text-muted font-bold uppercase tracking-widest">
                              {new Date(activity.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-emerald-500 font-black tracking-tighter">+{activity.pointsEarned} PTS</p>
                          {parseFloat(activity.tokensPending) > 0 && (
                            <p className="text-[10px] text-amber-500 font-black uppercase">+{parseFloat(activity.tokensPending).toFixed(2)} SMTH</p>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="glow-card rounded-[2rem] border-primary p-8">
                  <h3 className="text-xl font-black text-primary mb-6 tracking-tighter">Contribution Tiers</h3>
                  <div className="space-y-5">
                    {[
                      { icon: BookOpen, label: 'Modular Education', points: '50-100' },
                      { icon: Star, label: 'Bug Bounty Reporting', points: '25-200' },
                      { icon: Lightbulb, label: 'Feature Proposals', points: '10-50' },
                      { icon: Zap, label: 'Exchange Volume', points: '5-20' },
                      { icon: Gift, label: 'Protocol Referral', points: '100' },
                    ].map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between group">
                        <div className="flex items-center gap-4">
                          <div className="w-8 h-8 rounded-lg bg-secondary border border-primary flex items-center justify-center">
                            <item.icon className="w-4 h-4 text-accent-primary" />
                          </div>
                          <span className="text-secondary font-bold text-sm tracking-tight">{item.label}</span>
                        </div>
                        <span className="text-emerald-500 font-black text-xs uppercase tracking-widest">{item.points} PTS</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-gradient-to-br from-blue-600/10 to-purple-600/10 border border-accent-primary/20 rounded-[2.5rem] p-8 flex flex-col items-center justify-center text-center relative overflow-hidden">
                   <div className="absolute top-0 right-0 p-8 opacity-5"><Trophy className="w-32 h-32" /></div>
                   <div className="w-20 h-20 rounded-3xl bg-accent-primary/10 flex items-center justify-center mb-6 border border-accent-primary/20">
                      <BookOpen className="w-10 h-10 text-accent-primary" />
                   </div>
                   <p className="text-5xl font-black text-primary tracking-tighter mb-2">{stats?.completedCourses || 0}</p>
                   <p className="text-xs font-black text-muted uppercase tracking-[0.3em]">Knowledge Certificates</p>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'courses' && (
            <motion.div key="courses" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="glow-card rounded-[2.5rem] border-primary p-8">
              <h2 className="text-2xl font-black text-primary mb-8 tracking-tighter">Your Certification Path</h2>
              <div className="grid gap-6">
                {courses.length === 0 ? (
                  <div className="text-center py-20 bg-secondary rounded-3xl border border-dashed border-primary">
                    <BookOpen className="w-16 h-16 text-muted mx-auto mb-6" />
                    <p className="text-primary font-bold text-lg mb-6">No active curriculum detected.</p>
                    <button onClick={() => router.push('/learn')} className="btn-primary px-8 py-3 rounded-2xl font-black uppercase tracking-widest text-sm">Browse Academy</button>
                  </div>
                ) : (
                  courses.map((course) => {
                    const progress = (course.completedModules.length / course.totalModules) * 100
                    return (
                      <div key={course.id} className="p-8 bg-section border border-primary rounded-[2rem] hover:bg-section-hover transition-all group">
                        <div className="flex items-start justify-between mb-8">
                          <div className="flex-1">
                            <h3 className="text-xl font-black text-primary tracking-tighter group-hover:text-accent-primary transition-colors">{course.courseTitle}</h3>
                            <p className="text-xs font-bold text-muted uppercase tracking-widest mt-1">
                              Status: {course.completedModules.length} / {course.totalModules} Units Synchronized
                            </p>
                          </div>
                          {course.isCompleted && (
                            <div className="badge px-4 py-1.5 rounded-full flex items-center gap-2">
                              <CheckCircle className="w-4 h-4" />
                              <span className="text-[10px] font-black uppercase tracking-widest">Certified</span>
                            </div>
                          )}
                        </div>
                        <div className="mb-6">
                          <div className="flex justify-between items-end mb-3 px-1">
                            <span className="text-[10px] font-black text-muted uppercase tracking-[0.2em]">Completion Progress</span>
                            <span className="text-lg font-black text-primary tracking-tighter">{Math.round(progress)}%</span>
                          </div>
                          <div className="h-4 bg-tertiary rounded-full border border-primary overflow-hidden p-1">
                            <motion.div initial={{ width: 0 }} animate={{ width: `${progress}%` }} className="h-full bg-accent-primary rounded-full shadow-[0_0_15px_rgba(var(--accent),0.4)]" />
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-[10px] font-bold text-muted uppercase tracking-[0.1em]">
                          <span>Epoch: {new Date(course.lastAccessed).toLocaleDateString()}</span>
                          {course.completionDate && <span>Archived: {new Date(course.completionDate).toLocaleDateString()}</span>}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'leaderboard' && (
            <motion.div key="leaderboard" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="glow-card rounded-[2.5rem] border-primary p-8">
              <h2 className="text-2xl font-black text-primary mb-8 tracking-tighter">Global Contributor Index</h2>
              <div className="space-y-3">
                {leaderboard.length === 0 ? (
                  <p className="text-muted text-center py-20 font-bold uppercase tracking-widest">Synchronizing rankings...</p>
                ) : (
                  leaderboard.map((entry) => (
                    <div key={entry.userId} className={`flex items-center justify-between p-6 rounded-3xl transition-all border ${
                        entry.isCurrentUser ? 'bg-accent-primary/10 border-accent-primary/30 ring-2 ring-accent-primary/10' : 'bg-section border-primary hover:bg-section-hover'
                    }`}>
                      <div className="flex items-center gap-6">
                        <div className={`flex items-center justify-center w-12 h-12 rounded-2xl font-black text-lg shadow-sm border ${
                          entry.rank === 1 ? 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30' :
                          entry.rank === 2 ? 'bg-zinc-400/20 text-zinc-400 border-zinc-400/30' :
                          entry.rank === 3 ? 'bg-orange-600/20 text-orange-500 border-orange-600/30' :
                          'bg-tertiary text-muted border-primary'
                        }`}>
                          {entry.rank <= 3 ? (entry.rank === 1 ? <Crown className="w-6 h-6" /> : <Medal className="w-6 h-6" />) : entry.rank}
                        </div>
                        <div>
                          <p className="text-primary font-black tracking-tighter text-lg flex items-center gap-2">
                            {entry.userName || `Validator_${entry.userId.slice(0,4)}`}
                            {entry.isCurrentUser && <span className="badge px-2 py-0.5 rounded text-[8px] uppercase">Node (You)</span>}
                          </p>
                          <p className="text-[10px] text-muted font-bold uppercase tracking-widest">
                            Verified Liquidity: {parseFloat(entry.totalTokensClaimed).toFixed(2)} SMTH
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-3xl font-black text-primary tracking-tighter leading-none">{entry.totalPoints}</p>
                        <p className="text-[10px] text-muted font-black uppercase tracking-widest mt-1">XP Power</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'claim' && (
            <motion.div key="claim" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="glow-card rounded-[2.5rem] border-primary p-8">
              <h2 className="text-2xl font-black text-primary mb-8 tracking-tighter text-center sm:text-left">Mint Governance Tokens</h2>

              {claimTxHash && (
                <div className="mb-8 p-6 bg-emerald-500/10 border border-emerald-500/30 rounded-3xl space-y-4 animate-in zoom-in duration-300">
                  <p className="text-emerald-500 font-black text-xl tracking-tighter flex items-center gap-3">
                    <CheckCircle className="w-6 h-6" /> Transaction Broadcast Complete
                  </p>
                  <a href={`https://sepolia.etherscan.io/tx/${claimTxHash}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-xs font-bold text-blue-500 hover:text-blue-400 underline uppercase tracking-widest break-all">
                    <ExternalLink className="w-4 h-4 shrink-0" /> Hash: {claimTxHash}
                  </a>
                  <div className="pt-4 border-t border-emerald-500/20 grid gap-2">
                    <p className="text-xs font-black text-emerald-600/80 uppercase tracking-widest">Network: Sepolia Mainnet Simulation</p>
                    <div className="flex items-center gap-2 bg-secondary/50 rounded-xl px-4 py-3 border border-primary">
                       <code className="text-primary text-[10px] break-all flex-1 font-mono uppercase tracking-widest">{CONTRACT_ADDRESS}</code>
                       <button onClick={() => navigator.clipboard.writeText(CONTRACT_ADDRESS)} className="text-[10px] font-black text-accent-primary hover:text-primary transition-colors">COPY ADDR</button>
                    </div>
                  </div>
                </div>
              )}

              {claimError && (
                <div className="mb-8 p-5 bg-red-500/10 border border-red-500/30 rounded-2xl">
                  <p className="text-red-500 font-black text-sm uppercase tracking-widest flex items-center gap-3">
                    <AlertCircle className="w-5 h-5" /> {claimError}
                  </p>
                </div>
              )}
              
              <div className="bg-gradient-to-br from-indigo-600/10 to-blue-600/10 border border-primary rounded-[3rem] p-10 mb-8 relative overflow-hidden group">
                <div className="absolute top-[-10%] right-[-5%] w-[30%] h-[50%] rounded-full bg-accent-primary blur-[80px] opacity-10 group-hover:opacity-20 transition-opacity" />
                <div className="text-center mb-10 relative z-10">
                  <div className="inline-flex items-center justify-center w-24 h-24 rounded-[2rem] bg-accent-primary/10 border border-accent-primary/20 mb-6 shadow-2xl">
                    <Coins className="w-12 h-12 text-accent-primary" />
                  </div>
                  <h3 className="text-6xl font-black text-primary tracking-tighter mb-2">
                    {parseFloat(stats?.totalTokensPending || '0').toFixed(2)}
                  </h3>
                  <p className="text-xs font-black text-muted uppercase tracking-[0.4em]">Available Liquid SMTH</p>
                </div>

                <div className="grid sm:grid-cols-2 gap-4 mb-10 relative z-10">
                   <div className="p-6 bg-secondary/50 border border-primary rounded-2xl text-center">
                      <span className="text-[10px] font-black text-muted uppercase tracking-widest block mb-1">Vault Pending</span>
                      <span className="text-2xl font-black text-primary tracking-tighter">{parseFloat(stats?.totalTokensPending || '0').toFixed(2)}</span>
                   </div>
                   <div className="p-6 bg-secondary/50 border border-primary rounded-2xl text-center">
                      <span className="text-[10px] font-black text-muted uppercase tracking-widest block mb-1">Settled Balance</span>
                      <span className="text-2xl font-black text-emerald-500 tracking-tighter">{parseFloat(stats?.totalTokensClaimed || '0').toFixed(2)}</span>
                   </div>
                </div>

                <div className="mb-8 relative z-10">
                  <div className="flex items-center justify-between mb-3 px-2">
                    <label className="text-[10px] font-black text-muted uppercase tracking-[0.2em] flex items-center gap-2">
                      <Wallet className="w-3 h-3 text-accent-primary" /> Target Settlement Address
                    </label>
                    {isConnected && connectedWallet && (
                      <button onClick={() => { setWalletAddress(connectedWallet); setClaimError(null) }} className="text-[10px] font-black text-accent-primary hover:text-primary transition-colors underline decoration-dotted underline-offset-4 uppercase tracking-widest">Sync Current Wallet</button>
                    )}
                  </div>
                  <input
                    type="text"
                    value={walletAddress}
                    onChange={e => { setWalletAddress(e.target.value); setClaimError(null) }}
                    placeholder="0X..."
                    className="w-full px-6 py-5 bg-tertiary border border-primary rounded-2xl text-primary placeholder-muted focus:ring-4 focus:ring-accent-primary/10 transition-all font-mono text-sm tracking-widest outline-none shadow-inner"
                  />
                  <p className="text-[9px] font-black text-muted uppercase tracking-widest mt-4 px-2 leading-relaxed">
                    Tokens are minted on the Sepolia test network. Ensure your provider is configured for Chain ID 11155111.
                  </p>
                </div>

                <button
                  onClick={handleClaimTokens}
                  disabled={claiming || parseFloat(stats?.totalTokensPending || '0') === 0}
                  className="btn-primary w-full py-5 rounded-2xl font-black uppercase tracking-[0.3em] text-sm shadow-2xl shadow-blue-500/20 active:scale-[0.98] transition-all disabled:grayscale disabled:opacity-40"
                >
                  {claiming ? (
                    <span className="flex items-center justify-center gap-3"><Loader2 className="w-5 h-5 animate-spin" /> Broadcast In Progress</span>
                  ) : (
                    <span className="flex items-center justify-center gap-3"><Zap className="w-5 h-5 fill-current" /> Execute Token Claim</span>
                  )}
                </button>
              </div>

              <div className="p-8 bg-section border border-primary rounded-[2rem]">
                <div className="flex gap-6 flex-col md:flex-row items-center md:items-start">
                  <div className="text-center md:text-left">
                    <h4 className="text-primary font-black tracking-tighter text-lg mb-3">Protocol Settlement Architecture</h4>
                    <ul className="grid sm:grid-cols-2 gap-x-12 gap-y-3 text-[10px] font-bold text-secondary uppercase tracking-widest">
                      <li>• Dynamic XP Conversion Engine</li>
                      <li>• Direct On-Chain Minting (Sepolia)</li>
                      <li>• Zero-Gas Claim Environment</li>
                      <li>• Deterministic Governance Distribution</li>
                      <li>• Real-Time Etherscan Indexing</li>
                      <li>• Automated Wallet Handshake</li>
                    </ul>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <Footer />
    </div>
  )
}