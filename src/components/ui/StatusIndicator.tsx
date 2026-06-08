import React from 'react'
import { cn } from '@/lib/utils'

export type StatusType = 'online' | 'connecting' | 'offline'

export interface StatusIndicatorProps {
  status: StatusType
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
  className?: string
}

const statusConfig: Record<StatusType, { color: string; glow: string; label: string }> = {
  online: {
    color: 'bg-status-online',
    glow: 'shadow-[0_0_8px_rgba(16,185,129,0.8)]',
    label: '在线',
  },
  connecting: {
    color: 'bg-status-connecting',
    glow: 'shadow-[0_0_8px_rgba(245,158,11,0.8)]',
    label: '连接中',
  },
  offline: {
    color: 'bg-status-offline',
    glow: 'shadow-[0_0_8px_rgba(239,68,68,0.8)]',
    label: '离线',
  },
}

const sizeClasses: Record<string, string> = {
  sm: 'w-2 h-2',
  md: 'w-3 h-3',
  lg: 'w-4 h-4',
}

const labelSizeClasses: Record<string, string> = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base',
}

export function StatusIndicator({
  status,
  size = 'md',
  showLabel = false,
  className,
}: StatusIndicatorProps) {
  const config = statusConfig[status]
  const isAnimated = status === 'online' || status === 'connecting'

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="relative">
        <div
          className={cn(
            'rounded-full',
            config.color,
            sizeClasses[size]
          )}
        />
        {isAnimated && (
          <div
            className={cn(
              'absolute inset-0 rounded-full animate-ping opacity-75',
              config.color
            )}
          />
        )}
        <div
          className={cn(
            'absolute inset-0 rounded-full',
            config.glow
          )}
        />
      </div>
      {showLabel && (
        <span
          className={cn(
            'font-medium',
            labelSizeClasses[size],
            status === 'online' && 'text-status-online',
            status === 'connecting' && 'text-status-connecting',
            status === 'offline' && 'text-status-offline'
          )}
        >
          {config.label}
        </span>
      )}
    </div>
  )
}
