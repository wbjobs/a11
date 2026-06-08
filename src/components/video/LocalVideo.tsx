import React, { useEffect, useRef, useState } from 'react'
import { Video, VideoOff, User } from 'lucide-react'
import { GlassCard } from '@/components/ui/GlassCard'
import { GlowButton } from '@/components/ui/GlowButton'
import { StatusIndicator } from '@/components/ui/StatusIndicator'
import { cn } from '@/lib/utils'

export interface LocalVideoProps {
  stream?: MediaStream | null
  userName?: string
  isVideoEnabled?: boolean
  onToggleVideo?: () => void
  className?: string
}

export default function LocalVideo({
  stream,
  userName = '我',
  isVideoEnabled: externalVideoEnabled,
  onToggleVideo,
  className,
}: LocalVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [internalVideoEnabled, setInternalVideoEnabled] = useState(true)

  const isVideoEnabled = externalVideoEnabled !== undefined ? externalVideoEnabled : internalVideoEnabled

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream
    }
  }, [stream])

  const handleToggleVideo = () => {
    if (onToggleVideo) {
      onToggleVideo()
    } else {
      setInternalVideoEnabled((prev) => !prev)
    }

    if (stream) {
      stream.getVideoTracks().forEach((track) => {
        track.enabled = !isVideoEnabled
      })
    }
  }

  return (
    <GlassCard
      className={cn('relative overflow-hidden', className)}
      rounded="lg"
      shadow="md"
      borderGlow={true}
      borderColor="cyan"
    >
      <div className="relative aspect-video bg-space-950 rounded-lg overflow-hidden">
        {isVideoEnabled && stream ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover transform scale-x-[-1]"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-space-900/80">
            <User className="w-12 h-12 text-gray-500 mb-2" />
            <span className="text-gray-400 text-sm">摄像头已关闭</span>
          </div>
        )}

        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-t from-space-950/60 via-transparent to-transparent" />
        </div>

        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <StatusIndicator status="online" size="sm" />
            <span className="text-white text-sm font-medium drop-shadow-lg">
              {userName}
            </span>
          </div>

          <GlowButton
            variant={isVideoEnabled ? 'primary' : 'danger'}
            size="sm"
            icon={isVideoEnabled ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
            onClick={handleToggleVideo}
          />
        </div>

        <div className="absolute top-3 left-3">
          <span className="px-2 py-0.5 bg-space-950/70 backdrop-blur-xs rounded text-tech-cyan text-xs font-medium">
            本地
          </span>
        </div>
      </div>
    </GlassCard>
  )
}
