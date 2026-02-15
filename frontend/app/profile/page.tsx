'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAccount, useDisconnect } from 'wagmi'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  LogOut,
  Wallet,
  Shield,
  Bell,
  Globe,
  Zap,
  Copy,
  Check,
  ExternalLink,
  Info,
  User,
  Palette,
  Volume2,
  VolumeX,
  Lock,
  Cpu,
  GitBranch,
  Heart,
  Mail,
  Eye,
  EyeOff,
  History,
  ArrowUpRight,
  Clock,
  Calendar,
  TrendingUp,
  Download,
} from 'lucide-react'
import Image  from 'next/image'
import { useAuth } from '@/hooks/useAuth'
import Navbar from '@/components/Navbar'
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth'
import { auth } from '@/lib/firebase'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface SwapHistoryItem {
  id: string;
  userId: string;
  walletAddress?: string;
  depositCoin?: string;
  settleCoin?: string;
  depositAmount?: string;
  settleAmount?: string;
  status?: string;
  createdAt: string;
  fromAsset: string;
  toAsset: string;
  fromAmount: string;
  fromNetwork?: string;
  toNetwork?: string;
  sideshiftOrderId?: string;
}

interface Preferences {
  soundEnabled: boolean
  autoConfirmSwaps: boolean
  currency: string
}

interface EmailNotificationPrefs {
  enabled: boolean
  walletReminders: boolean
  priceAlerts: boolean
  generalUpdates: boolean
  frequency: 'daily' | 'weekly'
}

interface EmailNotificationPrefs {
  enabled: boolean
  walletReminders: boolean
  priceAlerts: boolean
  generalUpdates: boolean
  frequency: 'daily' | 'weekly'
}

// ---------------------------------------------------------------------------
// Animated toggle switch
// ---------------------------------------------------------------------------
function ToggleSwitch({
  enabled,
  onToggle,
  activeColor = 'bg-blue-600',
}: {
  enabled: boolean
  onToggle: () => void
  activeColor?: string
}) {
  return (
    <button
      onClick={onToggle}
      className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-300 focus:outline-none ${
        enabled ? activeColor : 'bg-zinc-700'
      }`}
    >
      <motion.span
        layout
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        className="inline-block h-5 w-5 rounded-full bg-white shadow-lg"
        style={{ marginLeft: enabled ? '1.25rem' : '0.25rem' }}
      />
    </button>
  )
}

// ---------------------------------------------------------------------------
// Glow card wrapper
// ---------------------------------------------------------------------------
function GlowCard({
  children,
  className = '',
  delay = 0,
}: {
  children: React.ReactNode
  className?: string
  delay?: number
}) {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [hovered, setHovered] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      className={`relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/60 backdrop-blur-xl ${className}`}
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect()
        setMousePos({ x: e.clientX - r.left, y: e.clientY - r.top })
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {hovered && (
        <motion.div
          className="pointer-events-none absolute w-[340px] h-[340px] rounded-full blur-[100px]"
          style={{
            background: 'rgba(59,130,246,0.08)',
            left: mousePos.x - 170,
            top: mousePos.y - 170,
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        />
      )}
      <div className="relative z-10">{children}</div>
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// Section header
// ---------------------------------------------------------------------------
function SectionHeader({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-4 px-1">
      <Icon className="w-4 h-4 text-blue-400" />
      <span className="text-xs font-bold uppercase tracking-widest text-zinc-400">{label}</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Row component
// ---------------------------------------------------------------------------
function SettingRow({
  icon: Icon,
  label,
  description,
  action,
  danger = false,
}: {
  icon: React.ElementType
  label: string
  description?: string
  action: React.ReactNode
  danger?: boolean
}) {
  return (
    <div className="group flex items-center justify-between px-5 py-4 hover:bg-white/2 transition-colors">
      <div className="flex items-center gap-4 min-w-0">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
            danger
              ? 'bg-red-500/10 text-red-400'
              : 'bg-zinc-800 text-zinc-300 group-hover:bg-blue-500/10 group-hover:text-blue-400'
          } transition-colors`}
        >
          <Icon className="w-[18px] h-[18px]" />
        </div>
        <div className="min-w-0">
          <p className={`text-sm font-semibold ${danger ? 'text-red-400' : 'text-zinc-100'}`}>
            {label}
          </p>
          {description && <p className="text-xs text-zinc-500 mt-0.5 truncate">{description}</p>}
        </div>
      </div>
      <div className="shrink-0 ml-4">{action}</div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Profile Page
// ---------------------------------------------------------------------------
export default function ProfilePage() {
  const router = useRouter()
  const { logout, user, isAuthenticated, isLoading: authLoading } = useAuth()
  const { address, isConnected, chain } = useAccount()
  const { disconnect } = useDisconnect()

  // Preferences (persisted to localStorage)
  const [preferences, setPreferences] = useState<Preferences>(() => {
    try {
      const saved = localStorage.getItem('swapsmith_preferences')
      if (saved) {
        return { ...{
          soundEnabled: true,
          autoConfirmSwaps: false,
          currency: 'USD'
        }, ...JSON.parse(saved) }
      }
    } catch {}
    return {
      soundEnabled: true,
      autoConfirmSwaps: false,
      currency: 'USD'
    }
  })

  const [copiedEmail, setCopiedEmail] = useState(false)
  const [copiedAddress, setCopiedAddress] = useState(false)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [showPasswordChange, setShowPasswordChange] = useState(false)
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState(false)
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  })
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Email notification preferences
  const [emailNotificationPrefs, setEmailNotificationPrefs] = useState<EmailNotificationPrefs>(() => {
    try {
      const saved = localStorage.getItem('swapsmith_email_notifications')
      if (saved) {
        return JSON.parse(saved)
      }
    } catch {}
    return {
      enabled: false,
      walletReminders: true,
      priceAlerts: true,
      generalUpdates: true,
      frequency: 'daily'
    }
  })

  // Real wallet history from database
  const [walletHistory, setWalletHistory] = useState<SwapHistoryItem[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [portfolioStats, setPortfolioStats] = useState({
    totalSwaps: 0,
    totalVolume: 0,
    successRate: 100,
    favoriteAsset: 'N/A'
  })

  // Protect route
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login')
    }
  }, [authLoading, isAuthenticated, router])

  // Load profile image from localStorage
  useEffect(() => {
    if (user?.uid) {
      const savedImage = localStorage.getItem(`profile-image-${user.uid}`);
      setProfileImageUrl(savedImage);
    }
  }, [user])

  // Save preferences on change
  useEffect(() => {
    localStorage.setItem('swapsmith_preferences', JSON.stringify(preferences))
  }, [preferences])

  const calculatePortfolioStats = (history: SwapHistoryItem[]) => {
    if (!history || history.length === 0) {
      return { totalSwaps: 0, totalVolume: 0, successRate: 100, favoriteAsset: 'N/A' }
    }

    const totalSwaps = history.length
    const completedSwaps = history.filter(h => h.status === 'settled' || h.status === 'completed').length
    const successRate = totalSwaps > 0 ? Math.round((completedSwaps / totalSwaps) * 100) : 100

    // Calculate total volume in USD (simplified)
    const totalVolume = history.reduce((sum, h) => sum + (parseFloat(h.fromAmount) || 0), 0)

    // Find most used asset
    const assetCount: Record<string, number> = {}
    history.forEach(h => {
      assetCount[h.fromAsset] = (assetCount[h.fromAsset] || 0) + 1
      assetCount[h.toAsset] = (assetCount[h.toAsset] || 0) + 1
    })
    const favoriteAsset = Object.keys(assetCount).length > 0
      ? Object.entries(assetCount).sort((a, b) => b[1] - a[1])[0][0]
      : 'N/A'

    return { totalSwaps, totalVolume, successRate, favoriteAsset }
  }

  const formatDate = (dateString: string | Date) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 60) return `${diffMins} min${diffMins !== 1 ? 's' : ''} ago`
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays} days ago`
    return date.toLocaleDateString()
  }

  const exportTransactionHistory = () => {
    if (walletHistory.length === 0) {
      alert('No transaction history to export')
      return
    }

    const csvContent = [
      ['Date', 'From Asset', 'From Network', 'From Amount', 'To Asset', 'To Network', 'Settle Amount', 'Status', 'Order ID'].join(','),
      ...walletHistory.map(h => [
        new Date(h.createdAt).toISOString(),
        h.fromAsset,
        h.fromNetwork,
        h.fromAmount,
        h.toAsset,
        h.toNetwork,
        h.settleAmount,
        h.status,
        h.sideshiftOrderId
      ].join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `swapsmith-history-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  // Load swap history from database
  useEffect(() => {
    if (user?.uid) {
      setLoadingHistory(true)
      fetch(`/api/swap-history?userId=${user.uid}`)
        .then(res => res.json())
        .then(data => {
          if (data.history) {
            setWalletHistory(data.history)
            // Calculate portfolio stats
            const stats = calculatePortfolioStats(data.history)
            setPortfolioStats(stats)
          }
        })
        .catch(err => console.error('Failed to load swap history:', err))
        .finally(() => setLoadingHistory(false))
    }
  }, [user])

  // Save preferences and email notifications to database
  useEffect(() => {
    if (user?.uid) {
      localStorage.setItem('swapsmith_preferences', JSON.stringify(preferences))
      localStorage.setItem('swapsmith_email_notifications', JSON.stringify(emailNotificationPrefs))
      
      // Sync to database
      fetch('/api/user/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          walletAddress: address,
          preferences: JSON.stringify(preferences),
          emailNotifications: JSON.stringify(emailNotificationPrefs)
        })
      }).catch(err => console.error('Failed to sync settings:', err))
      
      // Schedule/unschedule notifications based on preferences
      if (emailNotificationPrefs.enabled && user?.email) {
        if (emailNotificationPrefs.walletReminders) {
          fetch('/api/schedule-notification', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'schedule',
              userId: user.uid,
              userEmail: user.email,
              userName: user.email.split('@')[0],
              type: 'wallet',
              frequency: emailNotificationPrefs.frequency
            })
          }).catch(err => console.error('Failed to schedule wallet reminder:', err))
        }
        
        if (emailNotificationPrefs.priceAlerts) {
          fetch('/api/schedule-notification', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'schedule',
              userId: user.uid,
              userEmail: user.email,
              userName: user.email.split('@')[0],
              type: 'price',
              frequency: emailNotificationPrefs.frequency
            })
          }).catch(err => console.error('Failed to schedule price alert:', err))
        }
      }
    }
  }, [preferences, emailNotificationPrefs, user, address])

  // Send welcome email when wallet is connected
  useEffect(() => {
    const hasSeenWalletWelcome = localStorage.getItem('swapsmith_wallet_welcome_sent')
    if (isConnected && address && user?.email && emailNotificationPrefs.enabled && !hasSeenWalletWelcome) {
      // Send welcome email for wallet connection
      fetch('/api/send-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'general',
          userEmail: user.email,
          userName: user.email.split('@')[0],
          title: 'Wallet Connected Successfully! 🎉',
          message: `Congratulations! Your wallet ${address.slice(0, 6)}...${address.slice(-4)} has been successfully connected to SwapSmith. You can now execute AI-powered swaps, track your portfolio, and access all premium features.`,
          ctaText: 'Start Trading',
          ctaUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/terminal`
        })
      }).then(() => {
        localStorage.setItem('swapsmith_wallet_welcome_sent', 'true')
      }).catch(err => console.error('Failed to send wallet welcome email:', err))
    }
  }, [isConnected, address, user?.email, emailNotificationPrefs.enabled])

  // Show loading state
  if (authLoading) {
    return (
      <div className="flex h-screen bg-[#050505] items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-zinc-400">Loading...</p>
        </div>
      </div>
    )
  }

  // Don't render if not authenticated
  if (!isAuthenticated) {
    return null
  }

  const copyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address)
      setCopiedAddress(true)
      setTimeout(() => setCopiedAddress(false), 2000)
    }
  }

  const copyEmail = () => {
    if (user?.email) {
      navigator.clipboard.writeText(user.email)
      setCopiedEmail(true)
      setTimeout(() => setCopiedEmail(false), 2000)
    }
  }

  const truncateAddress = (addr: string) =>
    `${addr.slice(0, 6)}...${addr.slice(-4)}`

  const handleLogout = () => {
    disconnect()
    logout()
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user?.uid) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file')
      return
    }

    // Validate file size (max 2MB for localStorage)
    if (file.size > 2 * 1024 * 1024) {
      alert('Image size should be less than 2MB')
      return
    }

    try {
      setUploadingImage(true)
      
      // Convert image to base64 and store in localStorage
      const reader = new FileReader()
      reader.onloadend = () => {
        const base64String = reader.result as string
        localStorage.setItem(`profile-image-${user.uid}`, base64String)
        setProfileImageUrl(base64String)
        // Notify other components (like Navbar) that the profile image changed
        window.dispatchEvent(new Event('profileImageChanged'))
        setUploadingImage(false)
      }
      reader.onerror = () => {
        alert('Failed to upload image. Please try again.')
        setUploadingImage(false)
      }
      reader.readAsDataURL(file)
    } catch (error) {
      console.error('Error uploading image:', error)
      alert('Failed to upload image. Please try again.')
      setUploadingImage(false)
    }
  }

  const handleRemoveImage = async () => {
    if (!user?.uid || !profileImageUrl) return

    try {
      setUploadingImage(true)
      localStorage.removeItem(`profile-image-${user.uid}`)
      setProfileImageUrl(null)
      // Notify other components that the profile image was removed
      window.dispatchEvent(new Event('profileImageChanged'))
    } catch (error) {
      console.error('Error removing image:', error)
      alert('Failed to remove image. Please try again.')
    } finally {
      setUploadingImage(false)
    }
  }

  const handlePasswordChange = async () => {
    setPasswordError('')
    setPasswordSuccess(false)

    // Validation
    if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
      setPasswordError('All fields are required')
      return
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError('New passwords do not match')
      return
    }

    if (passwordData.newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters')
      return
    }

    try {
      if (!auth) {
        setPasswordError('Firebase authentication is not configured')
        return
      }
      
      const currentUser = auth.currentUser
      if (!currentUser || !currentUser.email) {
        setPasswordError('User not found')
        return
      }

      // Re-authenticate user before changing password
      const credential = EmailAuthProvider.credential(
        currentUser.email,
        passwordData.currentPassword
      )
      await reauthenticateWithCredential(currentUser, credential)

      // Update password
      await updatePassword(currentUser, passwordData.newPassword)
      
      setPasswordSuccess(true)
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' })
      setTimeout(() => {
        setShowPasswordChange(false)
        setPasswordSuccess(false)
      }, 2000)
    } catch (error) {
      console.error('Password change error:', error)
      const err = error as { code?: string }
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setPasswordError('Current password is incorrect')
      } else if (err.code === 'auth/weak-password') {
        setPasswordError('New password is too weak')
      } else {
        setPasswordError('Failed to change password. Please try again.')
      }
    }
  }

  // -----------------------------------------------------------------------
  return (
    <>
      <Navbar />

      {/* Ambient backgrounds */}
      <div className="fixed inset-0 z-[-1] overflow-hidden pointer-events-none">
        <div className="absolute top-[-15%] left-[-10%] w-[45%] h-[45%] rounded-full bg-blue-600/6 blur-[140px]" />
        <div className="absolute bottom-[-15%] right-[-10%] w-[45%] h-[45%] rounded-full bg-purple-600/6 blur-[140px]" />
        <div className="absolute top-[50%] left-[50%] -translate-x-1/2 -translate-y-1/2 w-[30%] h-[30%] rounded-full bg-cyan-500/3 blur-[120px]" />
      </div>

      <div className="min-h-screen bg-[#050505] text-white pt-20 sm:pt-24 pb-20">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
          {/* ───────── Page Header ───────── */}
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="mb-10"
          >
            <button
              onClick={() => router.back()}
              className="group flex items-center gap-2 text-sm text-zinc-500 hover:text-white mb-6 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              Back
            </button>

            <div className="flex items-center gap-4">
              <div className="relative group">
                <div className="relative h-20 w-20 rounded-2xl overflow-hidden shadow-lg shadow-blue-500/20 border-2 border-zinc-800 group-hover:border-blue-500 transition-colors">
                  {profileImageUrl ? (
                    <Image
                      src={profileImageUrl}
                      alt="Profile"
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                      <User className="w-10 h-10 text-white" />
                    </div>
                  )}
                </div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingImage}
                  className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-blue-600 hover:bg-blue-500 border-2 border-[#050505] flex items-center justify-center transition-colors disabled:opacity-50"
                  title="Change profile picture"
                >
                  {uploadingImage ? (
                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <User className="w-4 h-4 text-white" />
                  )}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageUpload}
                />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Profile</h1>
                <p className="text-sm text-zinc-500 mt-0.5">Manage your account & preferences</p>
                {profileImageUrl && (
                  <button
                    onClick={handleRemoveImage}
                    disabled={uploadingImage}
                    className="text-xs text-red-400 hover:text-red-300 mt-1 disabled:opacity-50"
                  >
                    Remove photo
                  </button>
                )}
              </div>
            </div>
          </motion.div>

          {/* ───────── Two Column Layout for larger screens ───────── */}
          <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-6">
            {/* Left Column */}
            <div className="space-y-6">
          {/* ───────── Account Section ───────── */}
          <SectionHeader icon={User} label="Account" />
          <GlowCard className="divide-y divide-zinc-800/60" delay={0.05}>
            <SettingRow
              icon={Mail}
              label={user?.email || 'No email'}
              description="Your account email address"
              action={
                <button
                  onClick={copyEmail}
                  className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-blue-400 transition-colors"
                >
                  {copiedEmail ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      Copy
                    </>
                  )}
                </button>
              }
            />
            
            <div className="p-5">
              <AnimatePresence mode="wait">
                {!showPasswordChange ? (
                  <motion.button
                    key="change-password-btn"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setShowPasswordChange(true)}
                    className="w-full py-2.5 rounded-xl border border-zinc-700 text-zinc-300 text-xs font-bold uppercase tracking-widest hover:bg-zinc-800 transition-colors active:scale-[0.98] flex items-center justify-center gap-2"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    Change Password
                  </motion.button>
                ) : (
                  <motion.div
                    key="change-password-form"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="space-y-3"
                  >
                    {passwordError && (
                      <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs">
                        {passwordError}
                      </div>
                    )}
                    {passwordSuccess && (
                      <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-xs flex items-center gap-2">
                        <Check className="w-4 h-4" />
                        Password changed successfully!
                      </div>
                    )}
                    
                    <div className="relative">
                      <input
                        type={showPasswords.current ? 'text' : 'password'}
                        placeholder="Current Password"
                        value={passwordData.currentPassword}
                        onChange={(e) => setPasswordData({...passwordData, currentPassword: e.target.value})}
                        className="w-full bg-zinc-800/50 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPasswords({...showPasswords, current: !showPasswords.current})}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                      >
                        {showPasswords.current ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>

                    <div className="relative">
                      <input
                        type={showPasswords.new ? 'text' : 'password'}
                        placeholder="New Password (min 6 characters)"
                        value={passwordData.newPassword}
                        onChange={(e) => setPasswordData({...passwordData, newPassword: e.target.value})}
                        className="w-full bg-zinc-800/50 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPasswords({...showPasswords, new: !showPasswords.new})}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                      >
                        {showPasswords.new ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>

                    <div className="relative">
                      <input
                        type={showPasswords.confirm ? 'text' : 'password'}
                        placeholder="Confirm New Password"
                        value={passwordData.confirmPassword}
                        onChange={(e) => setPasswordData({...passwordData, confirmPassword: e.target.value})}
                        className="w-full bg-zinc-800/50 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPasswords({...showPasswords, confirm: !showPasswords.confirm})}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                      >
                        {showPasswords.confirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={() => {
                          setShowPasswordChange(false)
                          setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' })
                          setPasswordError('')
                        }}
                        className="flex-1 py-2.5 rounded-xl border border-zinc-700 text-zinc-300 text-xs font-bold uppercase tracking-widest hover:bg-zinc-800 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handlePasswordChange}
                        className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold uppercase tracking-widest transition-colors shadow-lg shadow-blue-600/20"
                      >
                        Update
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </GlowCard>

          {/* ───────── Wallet Section ───────── */}
          <SectionHeader icon={Wallet} label="Wallet" />
          <GlowCard className="" delay={0.1}>
            {isConnected && address ? (
              <>
                <div className="p-5 pb-0">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-[11px] font-bold uppercase tracking-widest">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Connected
                    </span>
                    {chain && (
                      <span className="text-[11px] text-zinc-500 font-medium">
                        {chain.name}
                      </span>
                    )}
                  </div>
                </div>

                <SettingRow
                  icon={Wallet}
                  label={truncateAddress(address)}
                  description="Your connected wallet address"
                  action={
                    <button
                      onClick={copyAddress}
                      className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-blue-400 transition-colors"
                    >
                      {copiedAddress ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          Copy
                        </>
                      )}
                    </button>
                  }
                />

                <div className="px-5 pb-4 pt-1">
                  <button
                    onClick={() => disconnect()}
                    className="w-full py-2.5 rounded-xl border border-red-500/20 text-red-400 text-xs font-bold uppercase tracking-widest hover:bg-red-500/10 transition-colors active:scale-[0.98]"
                  >
                    Disconnect Wallet
                  </button>
                </div>
              </>
            ) : (
              <div className="p-5 text-center">
                <div className="h-12 w-12 mx-auto rounded-2xl bg-zinc-800 flex items-center justify-center mb-3">
                  <Wallet className="w-6 h-6 text-zinc-500" />
                </div>
                <p className="text-sm text-zinc-400 mb-1 font-medium">No wallet connected</p>
                <p className="text-xs text-zinc-600 mb-4">
                  Connect a wallet from the terminal to enable on-chain features.
                </p>
                <button
                  onClick={() => router.push('/terminal')}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl text-xs font-bold uppercase tracking-widest transition-colors active:scale-[0.98]"
                >
                  <Zap className="w-3.5 h-3.5" />
                  Go to Terminal
                </button>
              </div>
            )}
          </GlowCard>

          {/* ───────── Wallet History ───────── */}
          <SectionHeader icon={History} label="Recent Activity" />
          <GlowCard className="" delay={0.15}>
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-white">Transaction History</h3>
                {walletHistory.length > 0 && (
                  <button
                    onClick={exportTransactionHistory}
                    className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                  >
                    <Download className="w-3 h-3" />
                    Export CSV
                  </button>
                )}
              </div>
              
              {loadingHistory ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-3"></div>
                  <p className="text-sm text-zinc-500">Loading history...</p>
                </div>
              ) : walletHistory.length > 0 ? (
                <div className="space-y-3">
                  {walletHistory.slice(0, 5).map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-zinc-800/30 hover:bg-zinc-800/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-blue-500/10">
                          <ArrowUpRight className="w-4 h-4 text-blue-400" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-white">
                            {item.fromAsset} → {item.toAsset}
                          </p>
                          <p className="text-xs text-zinc-500 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDate(item.createdAt)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-mono text-zinc-300">{parseFloat(item.fromAmount).toFixed(4)}</p>
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase ${
                          item.status === 'settled' || item.status === 'completed' 
                            ? 'text-emerald-400' 
                            : item.status === 'pending' 
                            ? 'text-amber-400' 
                            : 'text-red-400'
                        }`}>
                          <Check className="w-3 h-3" />
                          {item.status}
                        </span>
                      </div>
                    </div>
                  ))}
                  {walletHistory.length > 5 && (
                    <button
                      onClick={() => router.push('/terminal')}
                      className="w-full py-2 text-xs text-zinc-400 hover:text-blue-400 transition-colors"
                    >
                      View all {walletHistory.length} transactions →
                    </button>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <History className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
                  <p className="text-sm text-zinc-500">No recent activity</p>
                  <p className="text-xs text-zinc-600 mt-1">Your swap history will appear here</p>
                </div>
              )}
            </div>
          </GlowCard>
            </div>

            {/* Right Column */}
            <div className="space-y-6">
          {/* ───────── Portfolio Stats ───────── */}
          <SectionHeader icon={TrendingUp} label="Portfolio Stats" />
          <GlowCard className="p-5" delay={0.18}>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-xl bg-zinc-800/30">
                <p className="text-xs text-zinc-500 mb-1">Total Swaps</p>
                <p className="text-2xl font-bold text-white">{portfolioStats.totalSwaps}</p>
              </div>
              <div className="p-3 rounded-xl bg-zinc-800/30">
                <p className="text-xs text-zinc-500 mb-1">Success Rate</p>
                <p className="text-2xl font-bold text-emerald-400">{portfolioStats.successRate}%</p>
              </div>
              <div className="p-3 rounded-xl bg-zinc-800/30">
                <p className="text-xs text-zinc-500 mb-1">Total Volume</p>
                <p className="text-lg font-bold text-white">${portfolioStats.totalVolume.toFixed(2)}</p>
              </div>
              <div className="p-3 rounded-xl bg-zinc-800/30">
                <p className="text-xs text-zinc-500 mb-1">Top Asset</p>
                <p className="text-lg font-bold text-blue-400">{portfolioStats.favoriteAsset}</p>
              </div>
            </div>
          </GlowCard>

          {/* ───────── Preferences Section ───────── */}
          <SectionHeader icon={Palette} label="Preferences" />
          <GlowCard className="divide-y divide-zinc-800/60" delay={0.2}>
            <SettingRow
              icon={preferences.soundEnabled ? Volume2 : VolumeX}
              label="Sound Effects"
              description="Play sounds for confirmations"
              action={
                <ToggleSwitch
                  enabled={preferences.soundEnabled}
                  onToggle={() => setPreferences((p: Preferences) => ({ ...p, soundEnabled: !p.soundEnabled }))}
                />
              }
            />
            <SettingRow
              icon={Shield}
              label="Auto-Confirm Swaps"
              description="Skip confirmation for high-confidence swaps"
              action={
                <ToggleSwitch
                  enabled={preferences.autoConfirmSwaps}
                  onToggle={() => setPreferences((p: Preferences) => ({ ...p, autoConfirmSwaps: !p.autoConfirmSwaps }))}
                  activeColor="bg-amber-500"
                />
              }
            />
            <SettingRow
              icon={Globe}
              label="Display Currency"
              description="Prices shown in this currency"
              action={
                <select
                  value={preferences.currency}
                  onChange={(e) => setPreferences((p: Preferences) => ({ ...p, currency: e.target.value }))}
                  className="bg-zinc-800 border border-zinc-700 text-sm text-zinc-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/40 cursor-pointer"
                >
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                  <option value="JPY">JPY</option>
                  <option value="INR">INR</option>
                  <option value="BTC">BTC</option>
                  <option value="ETH">ETH</option>
                </select>
              }
            />
          </GlowCard>

          {/* ───────── Email Notifications ───────── */}
          <SectionHeader icon={Mail} label="Email Notifications" />
          <GlowCard className="divide-y divide-zinc-800/60" delay={0.25}>
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
                <div>
                  <h3 className="text-sm font-semibold text-white mb-1">Enable Email Notifications</h3>
                  <p className="text-xs text-zinc-500">Receive updates and alerts via email</p>
                </div>
                <ToggleSwitch
                  enabled={emailNotificationPrefs.enabled}
                  onToggle={() => setEmailNotificationPrefs(p => ({ ...p, enabled: !p.enabled }))}
                />
              </div>

              {emailNotificationPrefs.enabled && (
                <AnimatePresence>
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-3"
                  >
                    <div className="flex items-center justify-between py-2">
                      <div className="flex items-center gap-3">
                        <Wallet className="w-4 h-4 text-blue-400" />
                        <div>
                          <p className="text-sm font-medium text-white">Wallet Reminders</p>
                          <p className="text-xs text-zinc-500">Connect wallet notifications</p>
                        </div>
                      </div>
                      <ToggleSwitch
                        enabled={emailNotificationPrefs.walletReminders}
                        onToggle={() => setEmailNotificationPrefs(p => ({ ...p, walletReminders: !p.walletReminders }))}
                      />
                    </div>

                    <div className="flex items-center justify-between py-2">
                      <div className="flex items-center gap-3">
                        <TrendingUp className="w-4 h-4 text-emerald-400" />
                        <div>
                          <p className="text-sm font-medium text-white">Price Alerts</p>
                          <p className="text-xs text-zinc-500">Daily crypto price updates</p>
                        </div>
                      </div>
                      <ToggleSwitch
                        enabled={emailNotificationPrefs.priceAlerts}
                        onToggle={() => setEmailNotificationPrefs(p => ({ ...p, priceAlerts: !p.priceAlerts }))}
                      />
                    </div>

                    <div className="flex items-center justify-between py-2">
                      <div className="flex items-center gap-3">
                        <Bell className="w-4 h-4 text-purple-400" />
                        <div>
                          <p className="text-sm font-medium text-white">General Updates</p>
                          <p className="text-xs text-zinc-500">Platform news & features</p>
                        </div>
                      </div>
                      <ToggleSwitch
                        enabled={emailNotificationPrefs.generalUpdates}
                        onToggle={() => setEmailNotificationPrefs(p => ({ ...p, generalUpdates: !p.generalUpdates }))}
                      />
                    </div>

                    <div className="flex items-center justify-between py-2 border-t border-zinc-800 pt-4">
                      <div className="flex items-center gap-3">
                        <Calendar className="w-4 h-4 text-amber-400" />
                        <div>
                          <p className="text-sm font-medium text-white">Frequency</p>
                          <p className="text-xs text-zinc-500">How often to send emails</p>
                        </div>
                      </div>
                      <select
                        value={emailNotificationPrefs.frequency}
                        onChange={(e) => setEmailNotificationPrefs(p => ({ ...p, frequency: e.target.value as 'daily' | 'weekly' }))}
                        className="bg-zinc-800 border border-zinc-700 text-sm text-zinc-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/40 cursor-pointer"
                      >
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                      </select>
                    </div>
                  </motion.div>
                </AnimatePresence>
              )}
            </div>
          </GlowCard>
            </div>
          </div>

          {/* ───────── Full Width Sections ───────── */}
          <div className="space-y-6 mt-6">
          {/* ───────── About Section ───────── */}
          <SectionHeader icon={Info} label="About" />
          <GlowCard className="divide-y divide-zinc-800/60" delay={0.25}>
            <SettingRow
              icon={Zap}
              label="SwapSmith"
              description="AI-powered crypto swap terminal"
              action={
                <span className="text-xs text-zinc-500 font-mono">v0.1.0-alpha</span>
              }
            />
            <SettingRow
              icon={Cpu}
              label="Engine"
              description="Groq LLM + SideShift.ai"
              action={
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] text-emerald-500 font-bold uppercase tracking-widest">
                    Online
                  </span>
                </span>
              }
            />
            <SettingRow
              icon={GitBranch}
              label="Build"
              description="Next.js 16 · React 19 · Wagmi 2"
              action={
                <a
                  href="https://github.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-zinc-500 hover:text-blue-400 transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              }
            />
            <SettingRow
              icon={Heart}
              label="Made with love"
              description="Open-source & community driven"
              action={
                <span className="text-xs text-zinc-500">
                  MIT License
                </span>
              }
            />
          </GlowCard>

          {/* ───────── Danger Zone ───────── */}
          <SectionHeader icon={LogOut} label="Sign Out" />
          <GlowCard className="" delay={0.3}>
            <AnimatePresence mode="wait">
              {!showLogoutConfirm ? (
                <motion.div
                  key="logout-btn"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <SettingRow
                    icon={LogOut}
                    label="Log Out"
                    description="End your current session"
                    danger
                    action={
                      <button
                        onClick={() => setShowLogoutConfirm(true)}
                        className="px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold uppercase tracking-widest hover:bg-red-500/20 transition-colors active:scale-[0.97]"
                      >
                        Log Out
                      </button>
                    }
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="logout-confirm"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="p-5"
                >
                  <div className="text-center">
                    <div className="h-14 w-14 mx-auto rounded-2xl bg-red-500/10 flex items-center justify-center mb-4">
                      <LogOut className="w-7 h-7 text-red-400" />
                    </div>
                    <h3 className="text-lg font-bold text-white mb-1">Confirm Logout</h3>
                    <p className="text-sm text-zinc-500 mb-6">
                      You will be signed out and redirected to the login page.
                    </p>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setShowLogoutConfirm(false)}
                        className="flex-1 py-2.5 rounded-xl border border-zinc-700 text-zinc-300 text-xs font-bold uppercase tracking-widest hover:bg-zinc-800 transition-colors active:scale-[0.97]"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleLogout}
                        className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold uppercase tracking-widest transition-colors active:scale-[0.97] shadow-lg shadow-red-600/20"
                      >
                        Confirm Logout
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </GlowCard>
          </div>
          </div>        </div>
      </div>
    </>
  )
}
