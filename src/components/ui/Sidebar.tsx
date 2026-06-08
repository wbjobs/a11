import React, { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Home,
  Database,
  Users,
  Wifi,
  Radio,
  Circle,
  User,
  Crown,
  Edit3,
  Eye,
  Video,
  VideoOff,
  Clock,
  Hash,
  Layers,
  Activity,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { StatsCard } from './StatsCard';
import { useAppStore } from '@/store/useAppStore';
import type { User as UserType, PointCloudVersion, PointCloudData, ReconstructStatus } from 'shared/types';

interface SidebarProps {
  users: UserType[];
  currentPointCloud: PointCloudData | null;
  reconstructStatus: ReconstructStatus;
  roomId: string;
  wsConnected: boolean;
  className?: string;
}

type CollapsibleSection = 'room' | 'stats' | 'users' | 'connection';

const roleConfig = {
  creator: { icon: Crown, label: '创建者', color: 'text-amber-400' },
  collaborator: { icon: Edit3, label: '协作者', color: 'text-cyan-400' },
  viewer: { icon: Eye, label: '查看者', color: 'text-slate-400' },
};

export const Sidebar: React.FC<SidebarProps> = ({
  users,
  currentPointCloud,
  reconstructStatus,
  roomId,
  wsConnected,
  className,
}) => {
  const {
    currentUser,
    pointCloudVersions,
    webrtcConnected,
    roomStatus,
    sidebarOpen,
    setSidebarOpen,
  } = useAppStore();

  const [collapsedSections, setCollapsedSections] = useState<
    Record<CollapsibleSection, boolean>
  >({
    room: false,
    stats: false,
    users: false,
    connection: false,
  });

  const toggleSection = (section: CollapsibleSection) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const latestVersion: PointCloudVersion | undefined = [...pointCloudVersions].sort(
    (a, b) => b.versionNumber - a.versionNumber
  )[0];

  const totalPoints = currentPointCloud?.pointCount ?? latestVersion?.pointCount ?? 0;
  const currentVersionNumber = latestVersion?.versionNumber ?? 0;

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(2)}M`;
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  };

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const onlineUsers = users.filter((u) => u.isOnline);
  const offlineUsers = users.filter((u) => !u.isOnline);

  const renderUserCard = (user: UserType) => {
    const isCurrentUser = user.userId === currentUser?.userId;
    const RoleIcon = roleConfig[user.role].icon;

    return (
      <div
        key={user.userId}
        className={cn(
          'flex items-center gap-3 p-3 rounded-lg transition-all duration-200',
          isCurrentUser
            ? 'bg-cyan-500/10 border border-cyan-500/30'
            : 'bg-slate-800/50 border border-transparent hover:bg-slate-700/50'
        )}
      >
        <div className="relative">
          <div
            className={cn(
              'w-10 h-10 rounded-full flex items-center justify-center text-white font-bold',
              isCurrentUser
                ? 'bg-gradient-to-br from-cyan-500 to-blue-600'
                : 'bg-gradient-to-br from-slate-600 to-slate-700'
            )}
          >
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div
            className={cn(
              'absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-slate-900',
              user.isOnline ? 'bg-emerald-500' : 'bg-slate-500'
            )}
          />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn('font-medium truncate', user.isOnline ? 'text-slate-200' : 'text-slate-500')}>
              {user.name}
              {isCurrentUser && <span className="text-xs text-cyan-400">(我)</span>}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <RoleIcon className={cn('w-3 h-3', roleConfig[user.role].color)} />
            <span className={roleConfig[user.role].color}>
              {roleConfig[user.role].label}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {user.hasVideo ? (
            <Video className="w-4 h-4 text-emerald-400" />
          ) : (
            <VideoOff className="w-4 h-4 text-slate-600" />
          )}
        </div>
      </div>
    );
  };

  const CollapsiblePanel: React.FC<{
    id: CollapsibleSection;
    title: string;
    icon: React.ReactNode;
    children: React.ReactNode;
    badge?: string | number;
  }> = ({ id, title, icon, children, badge }) => (
    <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 overflow-hidden">
      <button
        onClick={() => toggleSection(id)}
        className="w-full flex items-center gap-3 p-3 text-left transition-colors hover:bg-slate-700/30"
      >
        {icon}
        <span className="flex-1 font-medium text-slate-200">{title}</span>
        {badge !== undefined && (
          <span className="px-2 py-0.5 text-xs rounded-full bg-cyan-500/20 text-cyan-400">
            {badge}
          </span>
        )}
        {collapsedSections[id] ? (
          <ChevronRight className="w-4 h-4 text-slate-400 transition-transform" />
        ) : (
          <ChevronLeft className="w-4 h-4 text-slate-400 transition-transform" />
        )}
      </button>
      {!collapsedSections[id] && (
        <div className="px-3 pb-3">{children}</div>
      )}
    </div>
  );

  if (!sidebarOpen) {
    return (
      <div
        className={cn(
          'fixed right-0 top-1/2 -translate-y-1/2 z-40',
          className
        )}
      >
        <button
          onClick={() => setSidebarOpen(true)}
          className={cn(
            'p-2 rounded-l-xl',
            'bg-gradient-to-l from-slate-800 to-slate-900',
            'border border-r-0 border-slate-700/50',
            'text-slate-400 hover:text-cyan-400',
            'shadow-lg shadow-cyan-500/5',
            'transition-all duration-200'
          )}
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'relative h-full w-80 flex flex-col',
        'bg-gradient-to-b from-slate-900/95 to-slate-800/95',
        'backdrop-blur-xl border-l border-slate-700/50',
        'shadow-2xl shadow-black/30',
        className
      )}
    >
      <div className="flex items-center justify-between p-4 border-b border-slate-700/50">
        <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
          <Activity className="w-5 h-5 text-cyan-400" />
          控制面板
        </h2>
        <button
          onClick={() => setSidebarOpen(false)}
          className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10 transition-all"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <CollapsiblePanel
          id="room"
          title="房间信息"
          icon={<Home className="w-4 h-4 text-cyan-400" />}
        >
          <div className="space-y-3">
            <div className="p-3 rounded-lg bg-slate-800/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-400">房间ID</span>
                <span className="text-xs font-mono text-cyan-400">
                  {roomId.slice(0, 8)}...
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Hash className="w-4 h-4 text-slate-500" />
                <span className="text-sm text-slate-300">
                  {roomId.slice(0, 8) || '未加入'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="p-2 rounded-lg bg-slate-800/50 text-center">
                <div
                  className={cn(
                    'w-2 h-2 rounded-full mx-auto mb-1',
                    roomStatus === 'reconstructing'
                      ? 'bg-cyan-400 animate-pulse'
                      : roomStatus === 'paused'
                      ? 'bg-amber-400'
                      : 'bg-emerald-400'
                  )}
                />
                <span className="text-xs text-slate-400">
                  {roomStatus === 'reconstructing'
                    ? '重建中'
                    : roomStatus === 'paused'
                    ? '已暂停'
                    : '空闲'}
                </span>
              </div>
              <div className="p-2 rounded-lg bg-slate-800/50 text-center">
                <Clock className="w-4 h-4 text-slate-500 mx-auto mb-1" />
                <span className="text-xs text-slate-400">
                  {latestVersion ? formatDate(latestVersion.timestamp) : '--'}
                </span>
              </div>
            </div>
          </div>
        </CollapsiblePanel>

        <CollapsiblePanel
          id="stats"
          title="点云统计"
          icon={<Layers className="w-4 h-4 text-emerald-400" />}
        >
          <div className="grid grid-cols-2 gap-3">
            <StatsCard
              icon={Database}
              value={formatNumber(totalPoints)}
              label="总点数"
              gradient="emerald"
            />
            <StatsCard
              icon={Hash}
              value={`v${currentVersionNumber}`}
              label="当前版本"
              gradient="cyan"
            />
          </div>

          {reconstructStatus.status === 'processing' && (
            <div className="mt-3 p-3 rounded-lg bg-slate-800/50 border border-cyan-500/30">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-400">重建进度</span>
                <span className="text-xs text-cyan-400">
                  {reconstructStatus.framesProcessed}/{reconstructStatus.totalFrames} 帧
                </span>
              </div>
              <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-300"
                  style={{ width: `${reconstructStatus.progress}%` }}
                />
              </div>
            </div>
          )}

          <div className="mt-3 p-3 rounded-lg bg-slate-800/50">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">历史版本</span>
              <span className="text-cyan-400 font-medium">
                {pointCloudVersions.length} 个
              </span>
            </div>
          </div>
        </CollapsiblePanel>

        <CollapsiblePanel
          id="users"
          title="在线用户"
          icon={<Users className="w-4 h-4 text-purple-400" />}
          badge={onlineUsers.length}
        >
          <div className="space-y-2">
            {onlineUsers.length > 0 && (
              <div>
                <div className="text-xs text-slate-500 mb-2 px-1">
                  在线 ({onlineUsers.length})
                </div>
                <div className="space-y-2">
                  {onlineUsers.map(renderUserCard)}
                </div>
              </div>
            )}

            {offlineUsers.length > 0 && (
              <div>
                <div className="text-xs text-slate-500 mb-2 px-1 mt-4">
                  离线 ({offlineUsers.length})
                </div>
                <div className="space-y-2 opacity-60">
                  {offlineUsers.map(renderUserCard)}
                </div>
              </div>
            )}

            {users.length === 0 && (
              <div className="text-center py-4 text-slate-500 text-sm">
                暂无用户
              </div>
            )}
          </div>
        </CollapsiblePanel>

        <CollapsiblePanel
          id="connection"
          title="连接状态"
          icon={<Wifi className="w-4 h-4 text-amber-400" />}
        >
          <div className="space-y-3">
            <div
              className={cn(
                'flex items-center gap-3 p-3 rounded-lg',
                wsConnected
                  ? 'bg-emerald-500/10 border border-emerald-500/30'
                  : 'bg-rose-500/10 border border-rose-500/30'
              )}
            >
              <div className="relative">
                <Radio className={cn('w-5 h-5', wsConnected ? 'text-emerald-400' : 'text-rose-400')} />
                <Circle
                  className={cn(
                    'absolute -top-0.5 -right-0.5 w-2.5 h-2.5 fill-current',
                    wsConnected ? 'text-emerald-500 animate-pulse' : 'text-rose-500'
                  )}
                />
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium text-slate-200">WebSocket</div>
                <div className={cn('text-xs', wsConnected ? 'text-emerald-400' : 'text-rose-400')}>
                  {wsConnected ? '已连接' : '未连接'}
                </div>
              </div>
            </div>

            <div
              className={cn(
                'flex items-center gap-3 p-3 rounded-lg',
                webrtcConnected
                  ? 'bg-emerald-500/10 border border-emerald-500/30'
                  : 'bg-amber-500/10 border border-amber-500/30'
              )}
            >
              <div className="relative">
                <Radio className={cn('w-5 h-5', webrtcConnected ? 'text-emerald-400' : 'text-amber-400')} />
                <Circle
                  className={cn(
                    'absolute -top-0.5 -right-0.5 w-2.5 h-2.5 fill-current',
                    webrtcConnected ? 'text-emerald-500 animate-pulse' : 'text-amber-500'
                  )}
                />
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium text-slate-200">WebRTC</div>
                <div className={cn('text-xs', webrtcConnected ? 'text-emerald-400' : 'text-amber-400')}>
                  {webrtcConnected ? '已连接' : '等待连接'}
                </div>
              </div>
            </div>
          </div>
        </CollapsiblePanel>
      </div>

      <div className="p-4 border-t border-slate-700/50">
        <div className="flex items-center gap-3 p-2 rounded-lg bg-slate-800/50">
          <div className="relative">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white text-sm font-bold">
              {currentUser?.name.charAt(0).toUpperCase() || '?'}
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-slate-900 bg-emerald-500" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-slate-200 truncate">
              {currentUser?.name || '未登录'}
            </div>
            <div className="flex items-center gap-1 text-xs">
              <User className="w-3 h-3 text-slate-500" />
              <span className="text-slate-500">
                {currentUser ? roleConfig[currentUser.role].label : '访客'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
