import React, { useState, useRef, useEffect, useCallback } from 'react'
import { ChevronDown, ChevronUp, Users, Video, VideoOff } from 'lucide-react'
import { GlassCard } from '@/components/ui/GlassCard'
import { GlowButton } from '@/components/ui/GlowButton'
import LocalVideo from '@/components/video/LocalVideo'
import RemoteVideo from '@/components/video/RemoteVideo'
import { StatusType } from '@/components/ui/StatusIndicator'
import { cn } from '@/lib/utils'
import type { User } from 'shared/types'

export interface RemoteUserWithStream extends User {
  stream: MediaStream | null
  status: StatusType
  isAudioEnabled: boolean
}

export interface VideoStreamPanelProps {
  localStream: MediaStream | null
  localUserName?: string
  isLocalVideoEnabled?: boolean
  remoteUsers: RemoteUserWithStream[]
  onToggleLocalVideo?: () => void
  onToggleRemoteAudio?: (userId: string) => void
  onToggleRemoteVideo?: (userId: string) => void
  initialPosition?: { x: number; y: number }
  draggable?: boolean
  className?: string
}

export function VideoStreamPanel({
  localStream,
  localUserName = '我',
  isLocalVideoEnabled = true,
  remoteUsers = [],
  onToggleLocalVideo,
  onToggleRemoteAudio,
  onToggleRemoteVideo,
  initialPosition = { x: 16, y: 16 },
  draggable = true,
  className,
}: VideoStreamPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [position, setPosition] = useState(initialPosition)
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const panelRef = useRef<HTMLDivElement>(null)
  const dragStartPos = useRef({ x: 0, y: 0 })

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!draggable || isCollapsed) return
      e.preventDefault()
      setIsDragging(true)
      dragStartPos.current = { x: e.clientX, y: e.clientY }
      setDragOffset({
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      })
    },
    [draggable, isCollapsed, position]
  )

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !panelRef.current) return

      const newX = Math.max(0, Math.min(window.innerWidth - panelRef.current.offsetWidth, e.clientX - dragOffset.x))
      const newY = Math.max(0, Math.min(window.innerHeight - panelRef.current.offsetHeight, e.clientY - dragOffset.y))

      setPosition({ x: newX, y: newY })
    },
    [isDragging, dragOffset]
  )

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, handleMouseMove, handleMouseUp])

  const toggleCollapse = () => {
    setIsCollapsed((prev) => !prev)
  }

  const totalUsers = 1 + remoteUsers.length

  return (
    <div
      ref={panelRef}
      className={cn(
        'fixed z-40 transition-all duration-300',
        isDragging && 'cursor-grabbing',
        className
      )}
      style={{
        left: position.x,
        top: position.y,
        maxWidth: '320px',
      }}
    >
      <GlassCard
        rounded="lg"
        shadow="glow"
        borderGlow={true}
        borderColor="cyan"
        className={cn('overflow-hidden', isDragging && 'shadow-glow-cyan')}
      >
        <div
          className={cn(
            'flex items-center justify-between px-4 py-3 border-b border-tech-cyan/20 bg-space-900/80',
            draggable && !isCollapsed && 'cursor-grab active:cursor-grabbing'
          )}
          onMouseDown={handleMouseDown}
        >
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-tech-cyan" />
            <span className="text-sm font-medium text-white">
              视频流
              <span className="text-tech-cyan ml-1">({totalUsers})</span>
            </span>
          </div>
          <div className="flex items-center gap-1">
            <GlowButton
              variant="primary"
              size="sm"
              icon={isLocalVideoEnabled ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
              onClick={onToggleLocalVideo}
            />
            <GlowButton
              variant="secondary"
              size="sm"
              icon={isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
              onClick={toggleCollapse}
            />
          </div>
        </div>

        {!isCollapsed && (
          <div className="p-3 space-y-3 max-h-[70vh] overflow-y-auto">
            <LocalVideo
              stream={localStream}
              userName={localUserName}
              isVideoEnabled={isLocalVideoEnabled}
              onToggleVideo={onToggleLocalVideo}
            />

            {remoteUsers.length > 0 && (
              <div className="space-y-3">
                {remoteUsers.map((user) => (
                  <RemoteVideo
                    key={user.userId}
                    stream={user.stream}
                    userId={user.userId}
                    userName={user.name}
                    status={user.status}
                    isAudioEnabled={user.isAudioEnabled}
                    isVideoEnabled={user.hasVideo}
                    onToggleAudio={() => onToggleRemoteAudio?.(user.userId)}
                    onToggleVideo={() => onToggleRemoteVideo?.(user.userId)}
                  />
                ))}
              </div>
            )}

            {remoteUsers.length === 0 && (
              <div className="text-center py-4 text-gray-400 text-sm">
                暂无远程用户
              </div>
            )}
          </div>
        )}
      </GlassCard>
    </div>
  )
}
