import { Settings, RotateCcw, Maximize2, Grid3X3, Eye, EyeOff } from 'lucide-react';
import type { ColorMode } from '@/store/useAppStore';

interface PointCloudControlsProps {
  pointSize: number;
  onPointSizeChange: (size: number) => void;
  colorMode: ColorMode;
  onColorModeChange: (mode: ColorMode) => void;
  showAxes: boolean;
  onShowAxesChange: (show: boolean) => void;
  showGrid: boolean;
  onShowGridChange: (show: boolean) => void;
  autoRotate: boolean;
  onAutoRotateChange: (auto: boolean) => void;
  onResetView: () => void;
}

const colorModeOptions: { value: ColorMode; label: string }[] = [
  { value: 'original', label: '原色' },
  { value: 'height', label: '高度着色' },
  { value: 'curvature', label: '曲率着色' }
];

export function PointCloudControls({
  pointSize,
  onPointSizeChange,
  colorMode,
  onColorModeChange,
  showAxes,
  onShowAxesChange,
  showGrid,
  onShowGridChange,
  autoRotate,
  onAutoRotateChange,
  onResetView
}: PointCloudControlsProps) {
  return (
    <div className="absolute top-4 right-4 w-72 bg-slate-900/90 backdrop-blur-sm rounded-xl p-5 space-y-5 border border-slate-700/50 shadow-2xl">
      <div className="flex items-center gap-2 text-white font-semibold">
        <Settings size={18} className="text-blue-400" />
        <span>点云控制</span>
      </div>

      <div className="space-y-2">
        <label className="text-sm text-slate-300 flex justify-between">
          <span>点大小</span>
          <span className="text-blue-400 font-mono">{pointSize.toFixed(3)}</span>
        </label>
        <input
          type="range"
          min="0.01"
          max="0.2"
          step="0.005"
          value={pointSize}
          onChange={(e) => onPointSizeChange(parseFloat(e.target.value))}
          className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm text-slate-300">着色模式</label>
        <div className="grid grid-cols-3 gap-1">
          {colorModeOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => onColorModeChange(option.value)}
              className={`px-2 py-1.5 text-xs rounded-md transition-all ${
                colorMode === option.value
                  ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-300'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm text-slate-300">显示选项</label>
        <div className="space-y-2">
          <button
            onClick={() => onShowAxesChange(!showAxes)}
            className="w-full flex items-center justify-between px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <span className="flex items-center gap-2 text-sm text-slate-300">
              <Maximize2 size={14} className="text-slate-500" />
              坐标轴
            </span>
            {showAxes ? (
              <Eye size={14} className="text-green-400" />
            ) : (
              <EyeOff size={14} className="text-slate-600" />
            )}
          </button>

          <button
            onClick={() => onShowGridChange(!showGrid)}
            className="w-full flex items-center justify-between px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <span className="flex items-center gap-2 text-sm text-slate-300">
              <Grid3X3 size={14} className="text-slate-500" />
              网格
            </span>
            {showGrid ? (
              <Eye size={14} className="text-green-400" />
            ) : (
              <EyeOff size={14} className="text-slate-600" />
            )}
          </button>

          <button
            onClick={() => onAutoRotateChange(!autoRotate)}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${
              autoRotate ? 'bg-blue-600/30 border border-blue-500/50' : 'bg-slate-800 hover:bg-slate-700'
            }`}
          >
            <span className="flex items-center gap-2 text-sm text-slate-300">
              <RotateCcw size={14} className={autoRotate ? 'text-blue-400 animate-spin' : 'text-slate-500'} />
              自动旋转
            </span>
            <div className={`w-8 h-4 rounded-full relative transition-colors ${
              autoRotate ? 'bg-blue-500' : 'bg-slate-600'
            }`}>
              <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${
                autoRotate ? 'translate-x-4' : 'translate-x-0.5'
              }`} />
            </div>
          </button>
        </div>
      </div>

      <button
        onClick={onResetView}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition-colors text-sm font-medium"
      >
        <RotateCcw size={14} />
        重置视角
      </button>
    </div>
  );
}
