import React from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ButtonVariant = 'primary' | 'secondary' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

export interface GlowButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: React.ReactNode
  loading?: boolean
  fullWidth?: boolean
}

export function GlowButton({
  children,
  className,
  variant = 'primary',
  size = 'md',
  icon,
  loading = false,
  fullWidth = false,
  disabled,
  ...props
}: GlowButtonProps) {
  const baseClasses = 'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-300 relative overflow-hidden group'

  const variantClasses: Record<ButtonVariant, string> = {
    primary:
      'bg-tech-cyan/10 text-tech-cyan border border-tech-cyan/50 hover:bg-tech-cyan/20 hover:shadow-glow-cyan hover:border-tech-cyan/80',
    secondary:
      'bg-tech-purple/10 text-tech-purple border border-tech-purple/50 hover:bg-tech-purple/20 hover:shadow-glow-purple hover:border-tech-purple/80',
    danger:
      'bg-status-offline/10 text-status-offline border border-status-offline/50 hover:bg-status-offline/20 hover:shadow-glow-danger hover:border-status-offline/80',
  }

  const sizeClasses: Record<ButtonSize, string> = {
    sm: 'px-3 py-1.5 text-sm gap-1.5',
    md: 'px-4 py-2 text-sm gap-2',
    lg: 'px-6 py-3 text-base gap-2',
  }

  const disabledClasses = 'opacity-50 cursor-not-allowed hover:shadow-none'

  const widthClasses = fullWidth ? 'w-full' : ''

  const glowOverlayClasses: Record<ButtonVariant, string> = {
    primary: 'bg-tech-cyan/20',
    secondary: 'bg-tech-purple/20',
    danger: 'bg-status-offline/20',
  }

  return (
    <button
      className={cn(
        baseClasses,
        variantClasses[variant],
        sizeClasses[size],
        widthClasses,
        (disabled || loading) && disabledClasses,
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      <span
        className={cn(
          'absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300',
          glowOverlayClasses[variant]
        )}
      />
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        icon && <span className="flex-shrink-0">{icon}</span>
      )}
      {children && <span className="relative z-10">{children}</span>}
    </button>
  )
}
