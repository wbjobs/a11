import React from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  RotateCcw,
  Camera,
  Gauge,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface TimelineControlsProps {
  isPlaying: boolean;
  onPlayPause: () => void;
  onPrevFrame: () => void;
  onNextFrame: () => void;
  onReset: () => void;
  onSnapshot: () => void;
  playbackSpeed: number;
  onSpeedChange: (speed: number) => void;
  canGoPrev: boolean;
  canGoNext: boolean;
  className?: string;
}

const speedOptions: number[] = [0.25, 0.5, 1, 1.5, 2, 4];

export const TimelineControls: React.FC<TimelineControlsProps> = ({
  isPlaying,
  onPlayPause,
  onPrevFrame,
  onNextFrame,
  onReset,
  onSnapshot,
  playbackSpeed,
  onSpeedChange,
  canGoPrev,
  canGoNext,
  className,
}) => {
  return (
    <div
      className={cn(
        'flex items-center gap-2 p-3',
        'bg-gradient-to-r from-slate-900/95 via-slate-800/95 to-slate-900/95',
        'backdrop-blur-xl border border-slate-700/50 rounded-xl',
        'shadow-lg shadow-cyan-500/5',
        className
      )}
    >
      <button
        onClick={onReset}
        className="p-2 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10 transition-all duration-200 group"
        title="回到最新版本"
      >
        <RotateCcw className="w-5 h-5 group-hover:rotate-[-360deg] transition-transform duration-500" />
      </button>

      <div className="h-6 w-px bg-slate-700/50 mx-1" />

      <button
        onClick={onPrevFrame}
        disabled={!canGoPrev}
        className={cn(
          'p-2 rounded-lg transition-all duration-200',
          canGoPrev
            ? 'text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10'
            : 'text-slate-600 cursor-not-allowed'
        )}
        title="上一帧"
      >
        <SkipBack className="w-5 h-5" />
      </button>

      <button
        onClick={onPlayPause}
        className={cn(
          'p-3 rounded-xl transition-all duration-300 transform hover:scale-105',
          isPlaying
            ? 'bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-500/30'
            : 'bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/30'
        )}
        title={isPlaying ? '暂停' : '播放'}
      >
        {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
      </button>

      <button
        onClick={onNextFrame}
        disabled={!canGoNext}
        className={cn(
          'p-2 rounded-lg transition-all duration-200',
          canGoNext
            ? 'text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10'
            : 'text-slate-600 cursor-not-allowed'
        )}
        title="下一帧"
      >
        <SkipForward className="w-5 h-5" />
      </button>

      <div className="h-6 w-px bg-slate-700/50 mx-1" />

      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/50 border border-slate-700/50">
        <Gauge className="w-4 h-4 text-cyan-400" />
        <select
          value={playbackSpeed}
          onChange={(e) => onSpeedChange(Number(e.target.value))}
          className="bg-transparent text-slate-300 text-sm font-medium outline-none cursor-pointer appearance-none pr-4"
          style={{ backgroundImage: 'none' }}
        >
          {speedOptions.map((speed) => (
            <option key={speed} value={speed} className="bg-slate-800">
              {speed}x
            </option>
          ))}
        </select>
      </div>

      <div className="flex-1" />

      <button
        onClick={onSnapshot}
        className={cn(
          'flex items-center gap-2 px-4 py-2 rounded-xl',
          'bg-gradient-to-r from-emerald-500/20 to-teal-500/20',
          'border border-emerald-500/30',
          'text-emerald-400 hover:text-emerald-300',
          'hover:from-emerald-500/30 hover:to-teal-500/30',
          'transition-all duration-200',
          'shadow-lg shadow-emerald-500/10'
        )}
        title="保存快照"
      >
        <Camera className="w-4 h-4" />
        <span className="text-sm font-medium">保存快照</span>
      </button>
    </div>
  );
};

export default TimelineControls;
