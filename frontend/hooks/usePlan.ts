'use client'

import { useState, useEffect, useCallback } from 'react'
import { authenticatedFetch } from '@/lib/api-client'
import type { Plan } from '../../shared/config/plans'
import { PLAN_CONFIGS } from '../../shared/config/plans'

export interface PlanStatus {
  plan: Plan
  planExpiresAt: string | null
  dailyChatCount: number
  dailyTerminalCount: number
  dailyChatLimit: number
  dailyTerminalLimit: number
  chatLimitExceeded: boolean
  terminalLimitExceeded: boolean
  totalPoints: number
}

export function usePlan() {
  const [status, setStatus] = useState<PlanStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [purchasing, setPurchasing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchStatus = useCallback(async () => {
    try {
      const res = await authenticatedFetch('/api/plan/status')
      if (res.ok) {
        const data = await res.json()
        setStatus(data)
      }
    } catch (err) {
      console.error('Error fetching plan status:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  const purchasePlan = useCallback(async (plan: 'premium' | 'pro'): Promise<{ success: boolean; message: string }> => {
    setPurchasing(true)
    setError(null)
    try {
      const res = await authenticatedFetch('/api/plan/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        await fetchStatus() // Refresh plan status
        return { success: true, message: data.message }
      }
      const msg = data.error || 'Purchase failed'
      setError(msg)
      return { success: false, message: msg }
    } catch {
      const msg = 'Failed to purchase plan. Please try again.'
      setError(msg)
      return { success: false, message: msg }
    } finally {
      setPurchasing(false)
    }
  }, [fetchStatus])

  /**
   * Increment chat usage — returns false if limit exceeded
   */
  const checkChatUsage = useCallback(async (): Promise<{ allowed: boolean; currentPlan?: Plan }> => {
    try {
      const res = await authenticatedFetch('/api/plan/usage/chat', { method: 'POST' })
      if (res.status === 429) {
        const data = await res.json()
        return { allowed: false, currentPlan: data.currentPlan }
      }
      if (res.ok) {
        // Update local count
        setStatus(prev => prev ? { ...prev, dailyChatCount: prev.dailyChatCount + 1 } : prev)
        return { allowed: true }
      }
      return { allowed: true } // Fail open
    } catch {
      return { allowed: true } // Fail open
    }
  }, [])

  /**
   * Increment terminal usage — returns false if limit exceeded
   */
  const checkTerminalUsage = useCallback(async (): Promise<{ allowed: boolean; currentPlan?: Plan }> => {
    try {
      const res = await authenticatedFetch('/api/plan/usage/terminal', { method: 'POST' })
      if (res.status === 429) {
        const data = await res.json()
        return { allowed: false, currentPlan: data.currentPlan }
      }
      if (res.ok) {
        setStatus(prev => prev ? { ...prev, dailyTerminalCount: prev.dailyTerminalCount + 1 } : prev)
        return { allowed: true }
      }
      return { allowed: true }
    } catch {
      return { allowed: true }
    }
  }, [])

  const config = status ? PLAN_CONFIGS[status.plan] : PLAN_CONFIGS.free

  return {
    status,
    config,
    loading,
    purchasing,
    error,
    purchasePlan,
    checkChatUsage,
    checkTerminalUsage,
    refetch: fetchStatus,
  }
}
