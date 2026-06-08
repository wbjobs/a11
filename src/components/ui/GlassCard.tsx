import React from 'react'
import { cn } from '@/lib/utils'

export interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
  rounded?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | 'full'
  shadow?: 'none' | 'sm' | 'md' | 'lg' | 'glow'
  borderGlow?: boolean
  borderColor?: 'cyan' | 'purple' | 'none'
  glow?: 'cyan' | 'purple'
}

export function GlassCard({
  children,
  className,
  rounded = 'lg',
  shadow = 'md',
  borderGlow = true,
  borderColor = 'cyan',
  glow,
  ...props
}: GlassCardProps) {
  const actualBorderColor = glow || borderColor
  const roundedClasses: Record<string, string> = {
    none: 'rounded-none',
    sm: 'rounded-sm',
    md: 'rounded-md',
    lg: 'rounded-lg',
    xl: 'rounded-xl',
    '2xl': 'rounded-2xl',
    '3xl': 'rounded-3xl',
    full: 'rounded-full',
  }

  const shadowClasses: Record<string, string> = {
    none: '',
    sm: 'shadow-sm',
    md: 'shadow-md',
    lg: 'shadow-lg',
    glow: borderColor === 'purple' ? 'shadow-glow-purple' : 'shadow-glow-cyan',
  }

  const borderClasses = borderGlow
    ? borderColor === 'purple'
      ? 'border border-tech-purple/30'
      : 'border border-tech-cyan/30'
    : 'border border-white/10'

  return (
    <div
      className={cn(
        'bg-space-900/60 backdrop-blur-xl',
        roundedClasses[rounded],
        shadowClasses[shadow],
        borderClasses,
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}
