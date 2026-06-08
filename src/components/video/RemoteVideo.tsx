import React, { useEffect, useRef, useState } from 'react'
import { User, Volume2, VolumeX, Video, VideoOff } from 'lucide-react'
import { GlassCard } from '@/components/ui/GlassCard'
import { GlowButton } from '@/components/ui/GlowButton'
import { StatusIndicator, StatusType } from '@/components/ui/StatusIndicator'
import { cn } from '@/lib/utils'

export interface RemoteVideoProps {
  stream: MediaStream | null
  userId: string
  userName: string
  status?: StatusType
  isAudioEnabled?: boolean
  isVideoEnabled?: boolean
  onToggleAudio?: () => void
  onToggleVideo?: () => void
  className?: string
}

export default function RemoteVideo({
  stream,
  userId,
  userName,
  status = 'online',
  isAudioEnabled: externalAudioEnabled,
  isVideoEnabled: externalVideoEnabled,
  onToggleAudio,
  onToggleVideo,
  className,
}: RemoteVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [internalAudioEnabled, setInternalAudioEnabled] = useState(false)
  const [internalVideoEnabled, setInternalVideoEnabled] = useState(true)

  const isAudioEnabled = externalAudioEnabled !== undefined ? externalAudioEnabled : internalAudioEnabled
  const isVideoEnabled = externalVideoEnabled !== undefined ? externalVideoEnabled : internalVideoEnabled

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream
      videoRef.current.muted = !isAudioEnabled
    }
  }, [stream, isAudioEnabled])

  const handleToggleAudio = () => {
    if (onToggleAudio) {
      onToggleAudio()
    } else {
      const newState = !isAudioEnabled
      setInternalAudioEnabled(newState)
      if (videoRef.current) {
        videoRef.current.muted = !newState
      }
      if (stream) {
        stream.getAudioTracks().forEach((track) => {
          track.enabled = newState
        })
      }
    }
  }

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
      borderGlow={status === 'online'}
      borderColor="cyan"
    >
      <div className="relative aspect-video bg-space-950 rounded-lg overflow-hidden">
        {isVideoEnabled && stream ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-space-900/80">
            <User className="w-12 h-12 text-gray-500 mb-2" />
            <span className="text-gray-400 text-sm">{userName}</span>
          </div>
        )}

        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-t from-space-950/60 via-transparent to-transparent" />
        </div>

        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <StatusIndicator status={status} size="sm" />
            <span className="text-white text-sm font-medium drop-shadow-lg truncate max-w-[100px]">
              {userName}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <GlowButton
              variant={isAudioEnabled ? 'primary' : 'danger'}
              size="sm"
              icon={isAudioEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              onClick={handleToggleAudio}
            />
            <GlowButton
              variant={isVideoEnabled ? 'primary' : 'danger'}
              size="sm"
              icon={isVideoEnabled ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
              onClick={handleToggleVideo}
            />
          </div>
        </div>
      </div>
    </GlassCard>
  )
}
