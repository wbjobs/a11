import { useState, useCallback } from 'react';
import {
  MousePointer2,
  ArrowUp,
  Circle,
  Type,
  Trash2,
  Palette,
} from 'lucide-react';
import type { SelectedTool } from '../../store/useAppStore';
import { useAppStore } from '../../store/useAppStore';
import type { UserRole } from 'shared/types';

interface AnnotationToolbarProps {
  selectedTool: SelectedTool;
  disabled?: boolean;
  role?: UserRole;
  selectedColor?: string;
  onColorChange?: (color: string) => void;
  selectedSize?: number;
  onSizeChange?: (size: number) => void;
  onDeleteSelected?: () => void;
  selectedAnnotationId?: string | null;
}

const PRESET_COLORS = [
  '#ff5500',
  '#ff0000',
  '#00ff00',
  '#0088ff',
  '#ffff00',
  '#ff00ff',
  '#00ffff',
  '#ffffff',
];

const TOOLS: { id: SelectedTool; icon: typeof MousePointer2; label: string }[] = [
  { id: 'select', icon: MousePointer2, label: '选择' },
  { id: 'annotate-arrow', icon: ArrowUp, label: '箭头' },
  { id: 'annotate-sphere', icon: Circle, label: '球体' },
  { id: 'annotate-text', icon: Type, label: '文字' },
];

export function AnnotationToolbar({
  selectedTool,
  disabled = false,
  role,
  selectedColor = '#ff5500',
  onColorChange,
  selectedSize = 0.5,
  onSizeChange,
  onDeleteSelected,
  selectedAnnotationId: propSelectedAnnotationId,
}: AnnotationToolbarProps) {
  const setSelectedTool = useAppStore((state) => state.setSelectedTool);
  const storeSelectedAnnotationId = useAppStore((state) => state.selectedAnnotationId);
  const currentUser = useAppStore((state) => state.currentUser);
  const [showColorPicker, setShowColorPicker] = useState(false);

  const selectedAnnotationId = propSelectedAnnotationId ?? storeSelectedAnnotationId;
  const isViewer = disabled || role === 'viewer' || currentUser?.role === 'viewer';

  const handleColorChange = onColorChange || (() => {});
  const handleSizeChange = onSizeChange || (() => {});

  const handleToolClick = useCallback((tool: SelectedTool) => {
    if (isViewer) return;
    setSelectedTool(tool);
  }, [isViewer, setSelectedTool]);

  const handleDeleteClick = useCallback(() => {
    if (isViewer || !selectedAnnotationId || !onDeleteSelected) return;
    onDeleteSelected();
  }, [isViewer, selectedAnnotationId, onDeleteSelected]);

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">
      <div className="bg-gray-900/95 backdrop-blur-sm rounded-xl shadow-2xl border border-gray-700 p-3 flex items-center gap-2">
        <div className="flex items-center gap-1 pr-3 border-r border-gray-700">
          {TOOLS.map((tool) => {
            const Icon = tool.icon;
            const isActive = selectedTool === tool.id;
            return (
              <button
                key={tool.id}
                onClick={() => handleToolClick(tool.id)}
                disabled={isViewer}
                title={tool.label}
                className={`
                  p-2 rounded-lg transition-all duration-200 flex items-center justify-center
                  ${isViewer ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-700 cursor-pointer'}
                  ${isActive ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'text-gray-300'}
                `}
              >
                <Icon size={20} />
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 px-3 border-r border-gray-700">
          <div className="relative">
            <button
              onClick={() => !isViewer && setShowColorPicker(!showColorPicker)}
              disabled={isViewer}
              title="选择颜色"
              className={`
                p-2 rounded-lg transition-all duration-200 flex items-center justify-center gap-2
                ${isViewer ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-700 cursor-pointer'}
                text-gray-300
              `}
            >
              <Palette size={20} />
              <div
                className="w-5 h-5 rounded-full border-2 border-gray-500"
                style={{ backgroundColor: selectedColor }}
              />
            </button>

            {showColorPicker && !isViewer && (
              <div className="absolute top-full left-0 mt-2 p-2 bg-gray-800 rounded-lg shadow-xl border border-gray-600 flex flex-wrap gap-1 w-36">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => {
                      handleColorChange(color);
                      setShowColorPicker(false);
                    }}
                    className={`
                      w-7 h-7 rounded-full border-2 transition-all duration-200 hover:scale-110
                      ${selectedColor === color ? 'border-white scale-110' : 'border-transparent'}
                    `}
                    style={{ backgroundColor: color }}
                  />
                ))}
                <div className="w-full mt-1 pt-1 border-t border-gray-600">
                  <input
                    type="color"
                    value={selectedColor}
                    onChange={(e) => handleColorChange(e.target.value)}
                    className="w-full h-8 cursor-pointer rounded bg-transparent border-0"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 text-gray-300">
            <span className="text-xs whitespace-nowrap">大小</span>
            <input
              type="range"
              min="0.1"
              max="2"
              step="0.1"
              value={selectedSize}
              onChange={(e) => onSizeChange(parseFloat(e.target.value))}
              disabled={isViewer}
              className="w-24 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <span className="text-xs w-8 text-center">{selectedSize.toFixed(1)}</span>
          </div>
        </div>

        <div className="pl-3">
          <button
            onClick={handleDeleteClick}
            disabled={isViewer || !selectedAnnotationId}
            title="删除选中"
            className={`
              p-2 rounded-lg transition-all duration-200 flex items-center justify-center
              ${isViewer || !selectedAnnotationId
                ? 'opacity-50 cursor-not-allowed'
                : 'hover:bg-red-600 cursor-pointer text-red-400 hover:text-white'
              }
            `}
          >
            <Trash2 size={20} />
          </button>
        </div>

        {isViewer && (
          <div className="pl-3 border-l border-gray-700">
            <span className="text-xs text-gray-400 whitespace-nowrap">
              仅查看模式
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
