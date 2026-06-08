import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PointCloudVersion } from 'shared/types';
import { VersionTooltip } from './VersionTooltip';
import { TimelineControls } from './TimelineControls';

interface PointCloudTimelineProps {
  versions: PointCloudVersion[];
  currentVersionId: string | null;
  onVersionSelect: (versionId: string) => void;
  onSnapshot?: () => void;
  getAnnotationCount?: (versionId: string) => number;
  annotations?: any[];
  className?: string;
}

export const PointCloudTimeline: React.FC<PointCloudTimelineProps> = ({
  versions,
  currentVersionId,
  onVersionSelect,
  onSnapshot,
  getAnnotationCount,
  annotations = [],
  className,
}) => {
  const defaultGetAnnotationCount = (versionId: string) => {
    return annotations.filter((a: any) => a.pointCloudVersionId === versionId).length;
  };
  const getAnnotationCountFn = getAnnotationCount || defaultGetAnnotationCount;
  const [zoom, setZoom] = useState<number>(1);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [hoveredVersion, setHoveredVersion] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const timelineRef = useRef<HTMLDivElement>(null);
  const playIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const sortedVersions = [...versions].sort((a, b) => a.versionNumber - b.versionNumber);
  const currentIndex = sortedVersions.findIndex((v) => v.versionId === currentVersionId);
  const [playbackIndex, setPlaybackIndex] = useState<number>(currentIndex);

  const minSpacing = 60;
  const baseSpacing = minSpacing * zoom;
  const timelineWidth = Math.max(sortedVersions.length * baseSpacing, 800);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const delta = e.deltaY > 0 ? 0.8 : 1.25;
    setZoom((prev) => Math.min(Math.max(prev * delta, 0.5), 4));
  }, []);

  const handleZoomIn = () => setZoom((prev) => Math.min(prev * 1.5, 4));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev / 1.5, 0.5));
  const handleZoomReset = () => setZoom(1);

  const handlePlayPause = () => {
    setIsPlaying((prev) => !prev);
  };

  const handlePrevFrame = () => {
    if (currentIndex > 0) {
      onVersionSelect(sortedVersions[currentIndex - 1].versionId);
    }
  };

  const handleNextFrame = () => {
    if (currentIndex < sortedVersions.length - 1) {
      onVersionSelect(sortedVersions[currentIndex + 1].versionId);
    }
  };

  const handleReset = () => {
    if (sortedVersions.length > 0) {
      onVersionSelect(sortedVersions[sortedVersions.length - 1].versionId);
    }
  };

  const handleVersionClick = (version: PointCloudVersion) => {
    if (!isDragging) {
      onVersionSelect(version.versionId);
    }
  };

  const handleMouseDown = () => {
    setIsDragging(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (e.buttons === 1) {
      setIsDragging(true);
    }
  };

  const handleMouseUp = () => {
    setTimeout(() => setIsDragging(false), 100);
  };

  useEffect(() => {
    if (isPlaying && sortedVersions.length > 1) {
      const interval = 1000 / playbackSpeed;
      playIntervalRef.current = setInterval(() => {
        setPlaybackIndex((prev) => {
          const nextIndex = prev >= sortedVersions.length - 1 ? 0 : prev + 1;
          onVersionSelect(sortedVersions[nextIndex].versionId);
          return nextIndex;
        });
      }, interval);
    }

    return () => {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
      }
    };
  }, [isPlaying, playbackSpeed, sortedVersions, onVersionSelect]);

  useEffect(() => {
    setPlaybackIndex(currentIndex);
  }, [currentIndex]);

  useEffect(() => {
    if (!isPlaying && playIntervalRef.current) {
      clearInterval(playIntervalRef.current);
    }
  }, [isPlaying]);

  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getVersionPosition = (index: number): number => {
    return index * baseSpacing + baseSpacing / 2;
  };

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <TimelineControls
        isPlaying={isPlaying}
        onPlayPause={handlePlayPause}
        onPrevFrame={handlePrevFrame}
        onNextFrame={handleNextFrame}
        onReset={handleReset}
        onSnapshot={onSnapshot}
        playbackSpeed={playbackSpeed}
        onSpeedChange={setPlaybackSpeed}
        canGoPrev={currentIndex > 0}
        canGoNext={currentIndex < sortedVersions.length - 1}
      />

      <div
        ref={timelineRef}
        className={cn(
          'relative rounded-xl overflow-hidden',
          'bg-gradient-to-b from-slate-900/95 to-slate-800/95',
          'backdrop-blur-xl border border-slate-700/50',
          'shadow-lg shadow-cyan-500/5'
        )}
      >
        <div className="flex items-center justify-between px-4 py-2 border-b border-slate-700/30">
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-400">
              共 {sortedVersions.length} 个版本
            </span>
            {currentIndex >= 0 && (
              <span className="text-sm text-cyan-400">
                当前: v{sortedVersions[currentIndex]?.versionNumber}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={handleZoomOut}
              className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10 transition-all"
              title="缩小"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-xs text-slate-500 w-12 text-center">
              {(zoom * 100).toFixed(0)}%
            </span>
            <button
              onClick={handleZoomIn}
              className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10 transition-all"
              title="放大"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={handleZoomReset}
              className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10 transition-all ml-1"
              title="重置缩放"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div
          className="relative overflow-x-auto overflow-y-hidden"
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{ scrollbarWidth: 'thin' }}
        >
          <div
            className="relative h-32 px-8"
            style={{ width: `${timelineWidth}px` }}
          >
            <div className="absolute top-16 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />
            <div className="absolute top-16 left-0 right-0 h-0.5 bg-slate-700" />

            {sortedVersions.map((version, index) => {
              const isCurrent = version.versionId === currentVersionId;
              const isHovered = hoveredVersion === version.versionId;
              const position = getVersionPosition(index);
              const annotationCount = getAnnotationCount(version.versionId);

              return (
                <div
                  key={version.versionId}
                  className="absolute top-0 flex flex-col items-center cursor-pointer group"
                  style={{
                    left: `${position}px`,
                    transform: 'translateX(-50%)',
                  }}
                  onClick={() => handleVersionClick(version)}
                  onMouseEnter={() => setHoveredVersion(version.versionId)}
                  onMouseLeave={() => setHoveredVersion(null)}
                >
                  <div
                    className={cn(
                      'absolute top-8 w-24 text-center text-xs transition-all duration-200',
                      isCurrent ? 'text-cyan-400 font-bold' : 'text-slate-500'
                    )}
                  >
                    v{version.versionNumber}
                  </div>

                  <div
                    className={cn(
                      'relative mt-12 w-4 h-4 rounded-full transition-all duration-300',
                      'border-2 cursor-pointer',
                      isCurrent
                        ? 'bg-gradient-to-br from-cyan-400 to-blue-500 border-cyan-300 scale-125 shadow-lg shadow-cyan-500/50'
                        : 'bg-slate-700 border-slate-600 hover:bg-slate-600 hover:border-cyan-500/50 hover:scale-110',
                      isPlaying && isCurrent && 'animate-pulse'
                    )}
                  >
                    {isCurrent && (
                      <div className="absolute inset-0 rounded-full bg-cyan-400 animate-ping opacity-30" />
                    )}

                    {annotationCount > 0 && (
                      <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-amber-500 text-white text-[8px] flex items-center justify-center font-bold">
                        {annotationCount > 9 ? '9+' : annotationCount}
                      </div>
                    )}
                  </div>

                  <div
                    className={cn(
                      'absolute bottom-6 w-24 text-center text-xs transition-all duration-200',
                      isCurrent ? 'text-slate-300' : 'text-slate-500'
                    )}
                  >
                    {formatTime(version.timestamp)}
                  </div>

                  {isHovered && (
                    <VersionTooltip
                      version={version}
                      annotationCount={annotationCount}
                      position="top"
                    />
                  )}
                </div>
              );
            })}

            {sortedVersions.length > 1 && (
              <svg
                className="absolute top-12 left-0 right-0 h-8 pointer-events-none"
                style={{ width: '100%' }}
              >
                {sortedVersions.slice(0, -1).map((version, index) => {
                  const nextVersion = sortedVersions[index + 1];
                  const x1 = getVersionPosition(index);
                  const x2 = getVersionPosition(index + 1);
                  const progressDiff = nextVersion.pointCount - version.pointCount;
                  const opacity = Math.min(Math.max(progressDiff / 50000, 0.2), 1);

                  return (
                    <line
                      key={`${version.versionId}-${nextVersion.versionId}`}
                      x1={x1}
                      y1="16"
                      x2={x2}
                      y2="16"
                      stroke="url(#lineGradient)"
                      strokeWidth="2"
                      opacity={0.3 + opacity * 0.4}
                    />
                  );
                })}

                <defs>
                  <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#0ea5e9" />
                    <stop offset="100%" stopColor="#06b6d4" />
                  </linearGradient>
                </defs>
              </svg>
            )}

            {currentIndex >= 0 && (
              <div
                className="absolute top-4 w-0.5 h-24 pointer-events-none transition-all duration-300"
                style={{
                  left: `${getVersionPosition(currentIndex)}px`,
                  transform: 'translateX(-50%)',
                  background: 'linear-gradient(to bottom, #22d3ee, transparent)',
                }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PointCloudTimeline;
