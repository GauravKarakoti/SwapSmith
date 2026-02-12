'use client'
import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { Zap, Mail, Lock, ArrowRight, AlertCircle, Loader2 } from 'lucide-react'
import Link from 'next/link'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const { login, isLoading } = useAuth() // isLoading comes from the Firebase useAuth hook

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    
    try {
      // login is now an async function returning a promise from Firebase
      await login(email, password)
    } catch (err) {
      // Map Firebase error codes to user-friendly messages
      const errorMessage = String(err)
      if (errorMessage.includes('user-not-found') || errorMessage.includes('wrong-password') || errorMessage.includes('invalid-credential')) {
        setError('Invalid email or password. Please try again.')
      } else if (errorMessage.includes('too-many-requests')) {
        setError('Too many failed attempts. Please try again later.')
      } else {
        setError('Authentication failed. Please verify your connection.')
      }
    }
  }

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6">
      <div className="w-full max-w-md relative">
        {/* Deep background glow */}
        <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-purple-600 rounded-[2.5rem] blur opacity-20 pointer-events-none" />
        
        <div className="relative bg-zinc-900/50 border border-white/10 backdrop-blur-xl p-8 rounded-[2.5rem] shadow-2xl">
          <div className="text-center space-y-2 mb-10">
            <div className="inline-flex p-3 bg-blue-600/10 rounded-2xl border border-blue-500/20 mb-4">
              <Zap className="w-6 h-6 text-blue-500" fill="currentColor" />
            </div>
            <h1 className="text-3xl font-black tracking-tighter uppercase italic text-white">Access Terminal</h1>
            <p className="text-zinc-500 text-sm">Secure authorization required.</p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-500 text-xs font-bold uppercase tracking-tight animate-in fade-in slide-in-from-top-1">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative group">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-blue-400 transition-colors" />
              <input 
                type="email" 
                required
                disabled={isLoading}
                placeholder="Email Address"
                className="w-full bg-white/[0.03] border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-sm text-white outline-none focus:border-blue-500/50 transition-all disabled:opacity-50"
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="relative group">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-blue-400 transition-colors" />
              <input 
                type="password" 
                required
                disabled={isLoading}
                placeholder="Security Password"
                className="w-full bg-white/[0.03] border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-sm text-white outline-none focus:border-blue-500/50 transition-all disabled:opacity-50"
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <button 
              type="submit" 
              disabled={isLoading}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-bold py-4 rounded-2xl transition-all flex items-center justify-center gap-2 group shadow-lg shadow-blue-600/20 active:scale-[0.98]"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  Sign In <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-zinc-500 text-xs uppercase tracking-widest font-bold">
              No account? <Link href="/register" className="text-blue-400 hover:underline ml-1">Register Terminal</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}