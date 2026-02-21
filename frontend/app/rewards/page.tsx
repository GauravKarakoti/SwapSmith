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
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useAccount } from 'wagmi'
import Navbar from '@/components/Navbar'
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
      
      // Fetch user stats
      const statsRes = await authenticatedFetch('/api/rewards/stats')
      if (statsRes.ok) {
        const data = await statsRes.json()
        setStats(data)
      }

      // Fetch course progress
      const coursesRes = await authenticatedFetch('/api/rewards/courses')
      if (coursesRes.ok) {
        const data = await coursesRes.json()
        setCourses(data)
      }

      // Fetch recent activities
      const activitiesRes = await authenticatedFetch('/api/rewards/activities')
      if (activitiesRes.ok) {
        const data = await activitiesRes.json()
        setActivities(data)
      }

      // Fetch leaderboard
      const leaderboardRes = await authenticatedFetch('/api/rewards/leaderboard')
      if (leaderboardRes.ok) {
        const data = await leaderboardRes.json()
        setLeaderboard(data)
      }
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
      console.error('Error claiming tokens:', error)
      setClaimError('Network error. Please try again.')
    } finally {
      setClaiming(false)
    }
  }



  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-[#050505]">
        <Navbar />
        <div className="pt-20 flex items-center justify-center h-screen">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
        </div>
      </div>
    )
  }

  const getActionIcon = (type: string) => {
    switch (type) {
      case 'course_complete':
        return <BookOpen className="w-4 h-4" />
      case 'module_complete':
        return <CheckCircle className="w-4 h-4" />
      case 'daily_login':
        return <Clock className="w-4 h-4" />
      case 'swap_complete':
        return <Zap className="w-4 h-4" />
      case 'referral':
        return <Gift className="w-4 h-4" />
      default:
        return <Star className="w-4 h-4" />
    }
  }

  const getActionLabel = (type: string) => {
    return type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
  }

  return (
    <div className="min-h-screen bg-[#050505]">
      <Navbar />
      
      <main className="pt-24 pb-16 px-4 sm:px-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Back</span>
          </button>
          
          <div className="flex items-center gap-4 mb-2">
            <div className="p-3 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-2xl">
              <Trophy className="w-8 h-8 text-white" />
            </div>
            <div className="flex-1">
              <h1 className="text-3xl sm:text-4xl font-bold text-white">Rewards Center</h1>
              <p className="text-zinc-400 mt-1">Track your progress and earn rewards</p>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-zinc-900 border border-zinc-800 rounded-xl p-6"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Star className="w-5 h-5 text-blue-400" />
              </div>
              <h3 className="text-sm text-zinc-400">Total Points</h3>
            </div>
            <p className="text-3xl font-bold text-white">{stats?.totalPoints || 0}</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-zinc-900 border border-zinc-800 rounded-xl p-6"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <Coins className="w-5 h-5 text-green-400" />
              </div>
              <h3 className="text-sm text-zinc-400">Tokens Pending</h3>
            </div>
            <p className="text-3xl font-bold text-white">{parseFloat(stats?.totalTokensPending || '0').toFixed(2)}</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-zinc-900 border border-zinc-800 rounded-xl p-6"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-purple-500/10 rounded-lg">
                <Wallet className="w-5 h-5 text-purple-400" />
              </div>
              <h3 className="text-sm text-zinc-400">Tokens Claimed</h3>
            </div>
            <p className="text-3xl font-bold text-white">{parseFloat(stats?.totalTokensClaimed || '0').toFixed(2)}</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-zinc-900 border border-zinc-800 rounded-xl p-6"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-yellow-500/10 rounded-lg">
                <Trophy className="w-5 h-5 text-yellow-400" />
              </div>
              <h3 className="text-sm text-zinc-400">Rank</h3>
            </div>
            <p className="text-3xl font-bold text-white">
              {stats?.rank ? `#${stats.rank}` : '—'}
            </p>
          </motion.div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto border-b border-zinc-800">
          {[
            { id: 'overview', label: 'Overview', icon: TrendingUp },
            { id: 'courses', label: 'Learning Progress', icon: BookOpen },
            { id: 'leaderboard', label: 'Leaderboard', icon: Crown },
            { id: 'claim', label: 'Claim Tokens', icon: Wallet },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'text-white border-b-2 border-blue-500'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          {activeTab === 'overview' && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <Award className="w-5 h-5 text-blue-400" />
                  Recent Activities
                </h2>
                <div className="space-y-3">
                  {activities.length === 0 ? (
                    <p className="text-zinc-500 text-center py-8">No activities yet. Start learning to earn rewards!</p>
                  ) : (
                    activities.slice(0, 10).map((activity) => (
                      <div
                        key={activity.id}
                        className="flex items-center justify-between p-4 bg-zinc-800/50 rounded-lg border border-zinc-800 hover:border-zinc-700 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400">
                            {getActionIcon(activity.actionType)}
                          </div>
                          <div>
                            <p className="text-white font-medium">{getActionLabel(activity.actionType)}</p>
                            <p className="text-xs text-zinc-500">
                              {new Date(activity.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-green-400 font-bold">+{activity.pointsEarned} pts</p>
                          {parseFloat(activity.tokensPending) > 0 && (
                            <p className="text-xs text-yellow-400">+{parseFloat(activity.tokensPending).toFixed(2)} tokens</p>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                  <h3 className="text-lg font-bold text-white mb-4">How to Earn Rewards</h3>
                  <div className="space-y-3">
                    {[
                      { icon: BookOpen, label: 'Complete Learning Modules', points: '50-100 pts' },
                      { icon: Star, label: 'Report Bugs', points: '25-200 pts' },
                      { icon: Lightbulb, label: 'Feature Suggestions', points: '10-50 pts' },
                      { icon: Zap, label: 'Complete Swaps', points: '5-20 pts' },
                      { icon: Gift, label: 'Refer Friends', points: '100 pts' },
                    ].map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <item.icon className="w-4 h-4 text-blue-400" />
                          <span className="text-zinc-300">{item.label}</span>
                        </div>
                        <span className="text-green-400 font-medium">{item.points}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-gradient-to-br from-blue-900/20 to-purple-900/20 border border-blue-800/30 rounded-xl p-6">
                  <h3 className="text-lg font-bold text-white mb-4">Completed Courses</h3>
                  <div className="text-center py-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-500/10 mb-4">
                      <BookOpen className="w-8 h-8 text-blue-400" />
                    </div>
                    <p className="text-4xl font-bold text-white mb-2">{stats?.completedCourses || 0}</p>
                    <p className="text-zinc-400">Courses Completed</p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'courses' && (
            <motion.div
              key="courses"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-zinc-900 border border-zinc-800 rounded-xl p-6"
            >
              <h2 className="text-xl font-bold text-white mb-6">Your Learning Journey</h2>
              <div className="space-y-4">
                {courses.length === 0 ? (
                  <div className="text-center py-12">
                    <BookOpen className="w-16 h-16 text-zinc-600 mx-auto mb-4" />
                    <p className="text-zinc-500 mb-4">No courses started yet</p>
                    <button
                      onClick={() => router.push('/learn')}
                      className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                    >
                      Start Learning
                    </button>
                  </div>
                ) : (
                  courses.map((course) => {
                    const progress = (course.completedModules.length / course.totalModules) * 100
                    return (
                      <div
                        key={course.id}
                        className="p-6 bg-zinc-800/50 border border-zinc-800 rounded-lg hover:border-zinc-700 transition-colors"
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1">
                            <h3 className="text-lg font-semibold text-white mb-1">{course.courseTitle}</h3>
                            <p className="text-sm text-zinc-400">
                              {course.completedModules.length} of {course.totalModules} modules completed
                            </p>
                          </div>
                          {course.isCompleted && (
                            <div className="flex items-center gap-2 px-3 py-1 bg-green-500/10 border border-green-500/20 rounded-full">
                              <CheckCircle className="w-4 h-4 text-green-400" />
                              <span className="text-sm text-green-400 font-medium">Completed</span>
                            </div>
                          )}
                        </div>
                        <div className="mb-3">
                          <div className="flex justify-between text-xs text-zinc-400 mb-1">
                            <span>Progress</span>
                            <span>{Math.round(progress)}%</span>
                          </div>
                          <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-blue-500 to-purple-600 transition-all duration-300"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-xs text-zinc-500">
                          <span>Last accessed: {new Date(course.lastAccessed).toLocaleDateString()}</span>
                          {course.completionDate && (
                            <span>Completed: {new Date(course.completionDate).toLocaleDateString()}</span>
                          )}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'leaderboard' && (
            <motion.div
              key="leaderboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-zinc-900 border border-zinc-800 rounded-xl p-6"
            >
              <h2 className="text-xl font-bold text-white mb-6">Top Contributors</h2>
              <div className="space-y-2">
                {leaderboard.length === 0 ? (
                  <p className="text-zinc-500 text-center py-8">No leaderboard data yet</p>
                ) : (
                  leaderboard.map((entry) => (
                    <div
                      key={entry.userId}
                      className={`flex items-center justify-between p-4 rounded-lg transition-colors ${
                        entry.isCurrentUser
                          ? 'bg-blue-500/10 border border-blue-500/20'
                          : 'bg-zinc-800/50 hover:bg-zinc-800'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`flex items-center justify-center w-10 h-10 rounded-full ${
                          entry.rank === 1 ? 'bg-yellow-500/20 text-yellow-400' :
                          entry.rank === 2 ? 'bg-gray-400/20 text-gray-400' :
                          entry.rank === 3 ? 'bg-orange-600/20 text-orange-400' :
                          'bg-zinc-700 text-zinc-400'
                        }`}>
                          {entry.rank <= 3 ? (
                            entry.rank === 1 ? <Crown className="w-5 h-5" /> :
                            <Medal className="w-5 h-5" />
                          ) : (
                            <span className="font-bold">{entry.rank}</span>
                          )}
                        </div>
                        <div>
                          <p className="text-white font-medium">
                            {entry.userName || `User ${entry.userId}`}
                            {entry.isCurrentUser && <span className="text-blue-400 ml-2">(You)</span>}
                          </p>
                          <p className="text-xs text-zinc-500">
                            {parseFloat(entry.totalTokensClaimed).toFixed(2)} tokens claimed
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold text-white">{entry.totalPoints}</p>
                        <p className="text-xs text-zinc-500">points</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'claim' && (
            <motion.div
              key="claim"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-zinc-900 border border-zinc-800 rounded-xl p-6"
            >
              <h2 className="text-xl font-bold text-white mb-6">Claim Your Tokens</h2>

              {/* Success banner */}
              {claimTxHash && (
                <div className="mb-6 p-5 bg-green-500/10 border border-green-500/30 rounded-xl space-y-3">
                  <p className="text-green-400 font-semibold text-lg">✅ Tokens sent to your wallet!</p>

                  <a
                    href={`https://sepolia.etherscan.io/tx/${claimTxHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 underline break-all"
                  >
                    <ExternalLink className="w-4 h-4 flex-shrink-0" />
                    View transaction on Sepolia Etherscan →
                  </a>

                  <div className="pt-2 border-t border-green-500/20">
                    <p className="text-sm text-zinc-300 font-medium mb-2">How to see SMTH in MetaMask:</p>
                    <ol className="text-sm text-zinc-400 space-y-1 list-decimal list-inside">
                      <li>Open MetaMask → switch to <span className="text-white">Sepolia Testnet</span></li>
                      <li>Click <span className="text-white">Import tokens</span> at the bottom of the Assets tab</li>
                      <li>Paste this contract address:</li>
                    </ol>
                    {CONTRACT_ADDRESS ? (
                      <div className="mt-2 flex items-center gap-2 bg-zinc-800 rounded-lg px-3 py-2">
                        <code className="text-purple-400 text-xs break-all flex-1">{CONTRACT_ADDRESS}</code>
                        <button
                          onClick={() => navigator.clipboard.writeText(CONTRACT_ADDRESS)}
                          className="text-xs text-zinc-400 hover:text-white whitespace-nowrap"
                        >
                          Copy
                        </button>
                      </div>
                    ) : (
                      <code className="text-purple-400 text-xs">Set NEXT_PUBLIC_REWARD_TOKEN_ADDRESS in .env.local</code>
                    )}
                    <ol className="text-sm text-zinc-400 space-y-1 list-decimal list-inside mt-2" start={4}>
                      <li>Symbol <span className="text-white">SMTH</span> and decimals <span className="text-white">18</span> will auto-fill</li>
                      <li>Click <span className="text-white">Next → Import</span> — your SMTH balance appears</li>
                    </ol>
                  </div>
                </div>
              )}

              {/* Error banner */}
              {claimError && (
                <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                  <p className="text-red-400 font-semibold">❌ {claimError}</p>
                </div>
              )}
              
              <div className="bg-gradient-to-br from-purple-900/20 to-blue-900/20 border border-purple-800/30 rounded-xl p-8 mb-6">
                <div className="text-center mb-6">
                  <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-purple-500/10 mb-4">
                    <Coins className="w-10 h-10 text-purple-400" />
                  </div>
                  <h3 className="text-3xl font-bold text-white mb-2">
                    {parseFloat(stats?.totalTokensPending || '0').toFixed(2)}
                  </h3>
                  <p className="text-zinc-400">SwapSmith Tokens Available to Claim</p>
                </div>

                <div className="space-y-4 mb-6">
                  <div className="flex items-center justify-between p-4 bg-zinc-800/50 rounded-lg">
                    <span className="text-zinc-300">Pending Tokens</span>
                    <span className="text-white font-bold">{parseFloat(stats?.totalTokensPending || '0').toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-zinc-800/50 rounded-lg">
                    <span className="text-zinc-300">Total Claimed</span>
                    <span className="text-green-400 font-bold">{parseFloat(stats?.totalTokensClaimed || '0').toFixed(2)}</span>
                  </div>
                </div>

                {/* Wallet address input */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm text-zinc-400">
                      <Wallet className="inline w-4 h-4 mr-1 mb-0.5" />
                      Your Sepolia wallet address
                    </label>
                    {isConnected && connectedWallet && (
                      <button
                        onClick={() => { setWalletAddress(connectedWallet); setClaimError(null) }}
                        className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
                      >
                        ✓ Use connected wallet
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    value={walletAddress}
                    onChange={e => { setWalletAddress(e.target.value); setClaimError(null) }}
                    placeholder="0x…"
                    className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500 font-mono text-sm"
                  />
                  {isConnected && connectedWallet?.toLowerCase() === walletAddress.toLowerCase() ? (
                    <p className="text-xs text-green-400 mt-1">✓ Connected wallet auto-filled — tokens will go here on Sepolia</p>
                  ) : (
                    <p className="text-xs text-zinc-500 mt-1">
                      {isConnected
                        ? 'Click "Use connected wallet" above or paste any Sepolia address'
                        : 'Paste your MetaMask wallet address (Sepolia network)'}
                    </p>
                  )}
                </div>

                <button
                  onClick={handleClaimTokens}
                  disabled={claiming || parseFloat(stats?.totalTokensPending || '0') === 0}
                  className="w-full py-4 px-6 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:from-zinc-700 disabled:to-zinc-700 text-white font-bold rounded-lg transition-all flex items-center justify-center gap-2 disabled:cursor-not-allowed"
                >
                  {claiming ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Wallet className="w-5 h-5" />
                      Claim Tokens
                    </>
                  )}
                </button>
              </div>

              <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-4">
                <div className="flex gap-3">
                  <ExternalLink className="w-5 h-5 text-blue-400 flex-shrink-0" />
                  <div className="w-full">
                    <h4 className="text-white font-medium mb-1">How Token Claims Work</h4>
                    <ul className="text-sm text-zinc-400 space-y-1">
                      <li>• Earn points by completing courses, daily logins, and swaps</li>
                      <li>• Connect your MetaMask wallet on Sepolia, or paste your address</li>
                      <li>• Click <span className="text-white">Claim Tokens</span> — SMTH is sent on-chain in seconds</li>
                      <li>• View your transaction on Sepolia Etherscan</li>
                      <li>• Gas fees are covered by SwapSmith</li>
                    </ul>
                    {CONTRACT_ADDRESS && (
                      <div className="mt-3 pt-3 border-t border-blue-500/20">
                        <p className="text-xs text-zinc-400 mb-1">Add SMTH token to MetaMask — contract address:</p>
                        <div className="flex items-center gap-2 bg-zinc-800/80 rounded-lg px-3 py-2">
                          <code className="text-purple-400 text-xs break-all flex-1">{CONTRACT_ADDRESS}</code>
                          <button
                            onClick={() => navigator.clipboard.writeText(CONTRACT_ADDRESS)}
                            className="text-xs text-zinc-400 hover:text-white whitespace-nowrap"
                          >
                            Copy
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  )
}
