'use client'

import React, { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { toast } from 'react-hot-toast'

interface CopyButtonProps {
  text: string
  label?: string
  className?: string
  size?: 'sm' | 'md' | 'lg'
  variant?: 'default' | 'ghost' | 'outline'
  showToast?: boolean
  toastMessage?: string
  showText?: boolean
  children?: React.ReactNode
}

const CopyButton: React.FC<CopyButtonProps> = ({
  text,
  label,
  className = '',
  size = 'md',
  variant = 'default',
  showToast = true,
  toastMessage,
  showText = false,
  children
}) => {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)

      if (showToast) {
        toast.success(
          toastMessage || `${label || 'Text'} copied to clipboard!`,
          {
            duration: 2000,
            position: 'bottom-center'
          }
        )
      }

      setTimeout(() => setCopied(false), 2000)

    } catch (err) {
      console.error('Failed to copy text:', err)

      try {
        const textArea = document.createElement('textarea')
        textArea.value = text
        document.body.appendChild(textArea)
        textArea.select()
        document.execCommand('copy')
        document.body.removeChild(textArea)

        setCopied(true)

        if (showToast) {
          toast.success(
            toastMessage || `${label || 'Text'} copied!`,
            { duration: 2000 }
          )
        }

        setTimeout(() => setCopied(false), 2000)

      } catch (fallbackErr) {
        console.error('Fallback copy failed:', fallbackErr)

        if (showToast) {
          toast.error('Failed to copy to clipboard')
        }
      }
    }
  }

  const sizeClasses = {
    sm: 'p-1 w-6 h-6',
    md: 'p-1.5 w-8 h-8',
    lg: 'p-2 w-10 h-10'
  }

  const iconSizeClasses = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5'
  }

  const variantClasses = {
    default:
      'bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300',

    ghost:
      'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400',

    outline:
      'border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300'
  }

  const baseClasses =
    'inline-flex items-center justify-center rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1'

  return (
    <button
      onClick={handleCopy}
      className={`${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
      title={copied ? 'Copied!' : `Copy ${label || 'text'}`}
      type="button"
    >
      {children || (
        <>
          {copied ? (
            <Check className={`${iconSizeClasses[size]} text-green-500`} />
          ) : (
            <Copy className={iconSizeClasses[size]} />
          )}

          {showText && (
            <span className="ml-1 text-xs font-medium">
              {copied ? 'Copied!' : 'Copy'}
            </span>
          )}
        </>
      )}
    </button>
  )
}

export default CopyButton

/* ------------------------------------------------ */
/* Inline Copy Button */
/* ------------------------------------------------ */

export function InlineCopyButton({
  text,
  className = '',
  showToast = true,
  toastMessage
}: {
  text: string
  className?: string
  showToast?: boolean
  toastMessage?: string
}) {

  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)

      setCopied(true)

      if (showToast) {
        toast.success(toastMessage || 'Copied!', {
          duration: 1500,
          position: 'bottom-center'
        })
      }

      setTimeout(() => setCopied(false), 1500)

    } catch (err) {
      console.error('Failed to copy text:', err)

      if (showToast) {
        toast.error('Failed to copy')
      }
    }
  }

  return (
    <button
      onClick={handleCopy}
      className={`inline-flex items-center justify-center ml-1 p-0.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${className}`}
      title={copied ? 'Copied!' : 'Copy'}
      type="button"
    >
      {copied ? (
        <Check className="w-3 h-3 text-green-500" />
      ) : (
        <Copy className="w-3 h-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" />
      )}
    </button>
  )
}

/* ------------------------------------------------ */
/* Copyable Text Component */
/* ------------------------------------------------ */

export const CopyableText: React.FC<{
  text: string
  label?: string
  truncate?: boolean
  maxLength?: number
}> = ({
  text,
  label,
  truncate = true,
  maxLength = 20
}) => {

  const displayText =
    truncate && text.length > maxLength
      ? `${text.slice(0, maxLength)}...${text.slice(-6)}`
      : text

  return (
    <div className="flex items-center gap-2 p-2 rounded-lg bg-[var(--panel-soft)]/30 border border-[var(--border)]">
      <code className="text-sm text-[var(--text)] font-mono flex-1">
        {displayText}
      </code>

      <CopyButton
        text={text}
        label={label}
        size="sm"
      />
    </div>
  )
}