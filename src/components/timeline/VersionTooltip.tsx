import React from 'react';
import { Clock, Hash, Database, Tag } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PointCloudVersion } from 'shared/types';

interface VersionTooltipProps {
  version: PointCloudVersion;
  annotationCount: number;
  position?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}

export const VersionTooltip: React.FC<VersionTooltipProps> = ({
  version,
  annotationCount,
  position = 'top',
  className,
}) => {
  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(2)}M`;
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  };

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  const arrowClasses = {
    top: 'top-full left-1/2 -translate-x-1/2 border-t-slate-800',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-b-slate-800',
    left: 'left-full top-1/2 -translate-y-1/2 border-l-slate-800',
    right: 'right-full top-1/2 -translate-y-1/2 border-r-slate-800',
  };

  return (
    <div
      className={cn(
        'absolute z-50 w-64 p-4 rounded-xl',
        'bg-gradient-to-br from-slate-800 to-slate-900',
        'border border-cyan-500/30 shadow-2xl',
        'text-slate-100 text-sm',
        'backdrop-blur-xl',
        positionClasses[position],
        className
      )}
    >
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-700/50">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
          <Hash className="w-4 h-4 text-white" />
        </div>
        <div>
          <div className="font-bold text-cyan-400">
            版本 v{version.versionNumber}
          </div>
          <div className="text-xs text-slate-400">{version.versionId.slice(0, 12)}...</div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2 text-slate-300">
          <Clock className="w-4 h-4 text-cyan-400" />
          <span className="text-slate-400">时间:</span>
          <span className="flex-1 text-right">{formatTime(version.timestamp)}</span>
        </div>

        <div className="flex items-center gap-2 text-slate-300">
          <Database className="w-4 h-4 text-emerald-400" />
          <span className="text-slate-400">点数:</span>
          <span className="flex-1 text-right font-mono text-emerald-400">
            {formatNumber(version.pointCount)}
          </span>
        </div>

        <div className="flex items-center gap-2 text-slate-300">
          <Tag className="w-4 h-4 text-amber-400" />
          <span className="text-slate-400">标注:</span>
          <span className="flex-1 text-right font-mono text-amber-400">
            {annotationCount} 个
          </span>
        </div>
      </div>

      {version.progress < 100 && (
        <div className="mt-3 pt-2 border-t border-slate-700/50">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-slate-400">重建进度</span>
            <span className="text-cyan-400">{version.progress.toFixed(1)}%</span>
          </div>
          <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-300"
              style={{ width: `${version.progress}%` }}
            />
          </div>
        </div>
      )}

      <div
        className={cn(
          'absolute border-4 border-transparent',
          arrowClasses[position]
        )}
      />
    </div>
  );
};

export default VersionTooltip;
