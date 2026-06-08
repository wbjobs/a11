import React from 'react';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

type GradientVariant = 'cyan' | 'emerald' | 'amber' | 'purple' | 'rose' | 'blue';

interface StatsCardProps {
  icon: LucideIcon;
  value: string | number;
  label: string;
  gradient?: GradientVariant;
  subtitle?: string;
  progress?: number;
  className?: string;
}

const gradientClasses: Record<GradientVariant, { bg: string; text: string; glow: string; border: string }> = {
  cyan: {
    bg: 'from-cyan-500/20 to-blue-500/20',
    text: 'text-cyan-400',
    glow: 'shadow-cyan-500/20',
    border: 'border-cyan-500/30',
  },
  emerald: {
    bg: 'from-emerald-500/20 to-teal-500/20',
    text: 'text-emerald-400',
    glow: 'shadow-emerald-500/20',
    border: 'border-emerald-500/30',
  },
  amber: {
    bg: 'from-amber-500/20 to-orange-500/20',
    text: 'text-amber-400',
    glow: 'shadow-amber-500/20',
    border: 'border-amber-500/30',
  },
  purple: {
    bg: 'from-purple-500/20 to-violet-500/20',
    text: 'text-purple-400',
    glow: 'shadow-purple-500/20',
    border: 'border-purple-500/30',
  },
  rose: {
    bg: 'from-rose-500/20 to-pink-500/20',
    text: 'text-rose-400',
    glow: 'shadow-rose-500/20',
    border: 'border-rose-500/30',
  },
  blue: {
    bg: 'from-blue-500/20 to-indigo-500/20',
    text: 'text-blue-400',
    glow: 'shadow-blue-500/20',
    border: 'border-blue-500/30',
  },
};

const progressGradientClasses: Record<GradientVariant, string> = {
  cyan: 'from-cyan-500 to-blue-500',
  emerald: 'from-emerald-500 to-teal-500',
  amber: 'from-amber-500 to-orange-500',
  purple: 'from-purple-500 to-violet-500',
  rose: 'from-rose-500 to-pink-500',
  blue: 'from-blue-500 to-indigo-500',
};

export const StatsCard: React.FC<StatsCardProps> = ({
  icon: Icon,
  value,
  label,
  gradient = 'cyan',
  subtitle,
  progress,
  className,
}) => {
  const classes = gradientClasses[gradient];
  const progressGradient = progressGradientClasses[gradient];

  return (
    <div
      className={cn(
        'relative p-4 rounded-xl overflow-hidden',
        'bg-gradient-to-br',
        classes.bg,
        'backdrop-blur-xl',
        'border',
        classes.border,
        'shadow-lg',
        classes.glow,
        'transition-all duration-300 hover:scale-[1.02]',
        className
      )}
    >
      <div
        className={cn(
          'absolute -top-10 -right-10 w-32 h-32 rounded-full opacity-20 blur-2xl',
          classes.text.replace('text-', 'bg-')
        )}
      />

      <div className="relative z-10">
        <div className="flex items-start justify-between mb-3">
          <div
            className={cn(
              'w-10 h-10 rounded-lg flex items-center justify-center',
              'bg-gradient-to-br',
              classes.bg.replace('/20', '/40'),
              classes.border,
              'border',
              'shadow-inner'
            )}
          >
            <Icon className={cn('w-5 h-5', classes.text)} />
          </div>

          {subtitle && (
            <span className="text-xs text-slate-400">{subtitle}</span>
          )}
        </div>

        <div className="space-y-1">
          <div className={cn('text-2xl font-bold font-mono', classes.text)}>
            {value}
          </div>
          <div className="text-sm text-slate-400">{label}</div>
        </div>

        {progress !== undefined && (
          <div className="mt-3">
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-slate-400">进度</span>
              <span className={classes.text}>{progress.toFixed(1)}%</span>
            </div>
            <div className="h-1.5 bg-slate-700/50 rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full bg-gradient-to-r transition-all duration-500',
                  progressGradient
                )}
                style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StatsCard;
