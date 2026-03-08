import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface CopyButtonProps {
  text: string;
  label?: string;
  className?: string;
  showText?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const CopyButton: React.FC<CopyButtonProps> = ({
  text,
  label,
  className = '',
  showText = false,
  size = 'md'
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      
      // Show success toast (you can integrate with your existing toast system)
      if (window.dispatchEvent) {
        window.dispatchEvent(new CustomEvent('show-toast', {
          detail: { message: `${label || 'Text'} copied to clipboard!`, type: 'success' }
        }));
      }
      
      // Reset after 2 seconds
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  };

  const buttonSizeClasses = {
    sm: 'p-1',
    md: 'p-2',
    lg: 'p-3'
  };

  return (
    <button
      onClick={handleCopy}
      className={`
        inline-flex items-center gap-2 
        ${buttonSizeClasses[size]}
        rounded-lg
        bg-[var(--panel-soft)]/50 
        hover:bg-[var(--panel-soft)] 
        border border-[var(--border)]
        text-[var(--muted)] 
        hover:text-[var(--text)]
        transition-all duration-200
        ${className}
      `}
      title={`Copy ${label || 'text'}`}
    >
      {copied ? (
        <Check className={`${sizeClasses[size]} text-green-500`} />
      ) : (
        <Copy className={sizeClasses[size]} />
      )}
      {showText && (
        <span className="text-sm font-medium">
          {copied ? 'Copied!' : 'Copy'}
        </span>
      )}
    </button>
  );
};

// Utility component for displaying copyable text
export const CopyableText: React.FC<{
  text: string;
  label?: string;
  truncate?: boolean;
  maxLength?: number;
}> = ({ text, label, truncate = true, maxLength = 20 }) => {
  const displayText = truncate && text.length > maxLength 
    ? `${text.slice(0, maxLength)}...${text.slice(-6)}`
    : text;

  return (
    <div className="flex items-center gap-2 p-2 rounded-lg bg-[var(--panel-soft)]/30 border border-[var(--border)]">
      <code className="text-sm text-[var(--text)] font-mono flex-1">
        {displayText}
      </code>
      <CopyButton text={text} label={label} size="sm" />
    </div>
  );
};

export default CopyButton;