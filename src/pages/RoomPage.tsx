import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Video, Users, Zap, Sparkles, ArrowRight, Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store/useAppStore';
import { apiClient } from '@/services';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlowButton } from '@/components/ui/GlowButton';
import { UserRole } from 'shared/types';

export default function RoomPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [username, setUsername] = useState('');
  const [roomId, setRoomId] = useState('');
  const [role, setRole] = useState<UserRole>('collaborator');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [createdRoomId, setCreatedRoomId] = useState('');

  const setUser = useAppStore((state) => state.setUser);
  const joinRoom = useAppStore((state) => state.joinRoom);

  const handleCreateRoom = async () => {
    if (!username.trim()) {
      setError('请输入用户名');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await apiClient.createRoom(username.trim());
      setCreatedRoomId(response.roomId);
      setUser(response.userId, response.token, username.trim(), 'creator');
      joinRoom(response.roomId, 'creator');
    } catch (err: any) {
      setError(err.message || '创建房间失败');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinRoom = async () => {
    if (!username.trim()) {
      setError('请输入用户名');
      return;
    }
    if (!roomId.trim()) {
      setError('请输入房间号');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await apiClient.joinRoom(roomId.trim(), username.trim(), role);
      setUser(response.userId, response.token, username.trim(), role);
      joinRoom(roomId.trim(), role);
      navigate(`/room/${roomId.trim()}`);
    } catch (err: any) {
      setError(typeof err?.message === 'string' ? err.message : '加入房间失败');
    } finally {
      setLoading(false);
    }
  };

  const handleEnterRoom = () => {
    navigate(`/room/${createdRoomId}`);
  };

  const copyRoomId = async () => {
    await navigator.clipboard.writeText(createdRoomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#0A192F] relative overflow-hidden">
      <div className="absolute inset-0 bg-radial-gradient from-tech-cyan/5 via-transparent to-transparent" />
      <div className="absolute inset-0 grid-bg" />
      
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-tech-cyan/10 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-tech-purple/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />

      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4 py-12">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-tech-cyan to-tech-purple flex items-center justify-center shadow-glow-cyan">
              <Zap className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-tech-cyan via-white to-tech-purple bg-clip-text text-transparent">
              PointCloud Studio
            </h1>
          </div>
          <p className="text-slate-400 text-lg max-w-xl mx-auto">
            实时三维点云重建与协作标注平台
          </p>
        </div>

        <div className="w-full max-w-md">
          {!createdRoomId ? (
            <GlassCard className="p-8" glow="cyan">
              <div className="flex gap-2 mb-8 bg-slate-800/50 p-1 rounded-xl">
                <button
                  onClick={() => setMode('create')}
                  className={cn(
                    'flex-1 py-3 px-4 rounded-lg font-medium transition-all duration-300 flex items-center justify-center gap-2',
                    mode === 'create'
                      ? 'bg-tech-cyan text-slate-900 shadow-glow-cyan'
                      : 'text-slate-400 hover:text-white'
                  )}
                >
                  <Sparkles className="w-4 h-4" />
                  创建房间
                </button>
                <button
                  onClick={() => setMode('join')}
                  className={cn(
                    'flex-1 py-3 px-4 rounded-lg font-medium transition-all duration-300 flex items-center justify-center gap-2',
                    mode === 'join'
                      ? 'bg-tech-purple text-white shadow-glow-purple'
                      : 'text-slate-400 hover:text-white'
                  )}
                >
                  <Users className="w-4 h-4" />
                  加入房间
                </button>
              </div>

              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    用户名
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="输入您的名称"
                    className="w-full px-4 py-3 bg-slate-800/60 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-tech-cyan focus:ring-2 focus:ring-tech-cyan/20 transition-all"
                  />
                </div>

                {mode === 'join' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        房间号
                      </label>
                      <input
                        type="text"
                        value={roomId}
                        onChange={(e) => setRoomId(e.target.value)}
                        placeholder="输入8位房间号"
                        maxLength={8}
                        className="w-full px-4 py-3 bg-slate-800/60 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-tech-purple focus:ring-2 focus:ring-tech-purple/20 transition-all tracking-widest font-mono text-center"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        加入身份
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => setRole('collaborator')}
                          className={cn(
                            'py-2.5 px-4 rounded-lg font-medium transition-all text-sm',
                            role === 'collaborator'
                              ? 'bg-tech-cyan/20 border border-tech-cyan text-tech-cyan'
                              : 'bg-slate-800/40 border border-slate-700 text-slate-400 hover:border-slate-600'
                          )}
                        >
                          <Users className="w-4 h-4 inline mr-1" />
                          协作者
                        </button>
                        <button
                          onClick={() => setRole('viewer')}
                          className={cn(
                            'py-2.5 px-4 rounded-lg font-medium transition-all text-sm',
                            role === 'viewer'
                              ? 'bg-slate-500/20 border border-slate-500 text-slate-300'
                              : 'bg-slate-800/40 border border-slate-700 text-slate-400 hover:border-slate-600'
                          )}
                        >
                          <Video className="w-4 h-4 inline mr-1" />
                          观察者
                        </button>
                      </div>
                    </div>
                  </>
                )}

                {error && (
                  <div className="p-3 bg-status-error/10 border border-status-error/30 rounded-lg text-status-error text-sm">
                    {error}
                  </div>
                )}

                <GlowButton
                  variant={mode === 'create' ? 'primary' : 'secondary'}
                  className="w-full py-4 text-base"
                  onClick={mode === 'create' ? handleCreateRoom : handleJoinRoom}
                  loading={loading}
                >
                  {mode === 'create' ? (
                    <>
                      <Sparkles className="w-5 h-5" />
                      创建新房间
                    </>
                  ) : (
                    <>
                      <ArrowRight className="w-5 h-5" />
                      加入房间
                    </>
                  )}
                </GlowButton>
              </div>
            </GlassCard>
          ) : (
            <GlassCard className="p-8 text-center" glow="cyan">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-tech-cyan/20 to-tech-purple/20 flex items-center justify-center">
                <Check className="w-10 h-10 text-tech-cyan" />
              </div>
              
              <h2 className="text-2xl font-bold text-white mb-2">
                房间创建成功！
              </h2>
              <p className="text-slate-400 mb-6">
                请将房间号分享给协作者
              </p>

              <div className="bg-slate-800/60 rounded-xl p-4 mb-6">
                <p className="text-sm text-slate-400 mb-2">房间号</p>
                <div className="flex items-center justify-center gap-3">
                  <span className="text-3xl font-mono font-bold tracking-widest text-tech-cyan">
                    {createdRoomId}
                  </span>
                  <button
                    onClick={copyRoomId}
                    className="p-2 rounded-lg bg-slate-700/50 hover:bg-slate-700 transition-colors"
                  >
                    {copied ? (
                      <Check className="w-5 h-5 text-emerald-400" />
                    ) : (
                      <Copy className="w-5 h-5 text-slate-300" />
                    )}
                  </button>
                </div>
              </div>

              <GlowButton
                variant="primary"
                className="w-full py-4 text-base"
                onClick={handleEnterRoom}
              >
                进入工作区
                <ArrowRight className="w-5 h-5" />
              </GlowButton>
            </GlassCard>
          )}
        </div>

        <div className="mt-12 grid grid-cols-3 gap-6 max-w-2xl w-full">
          <div className="text-center">
            <div className="w-14 h-14 mx-auto mb-3 rounded-xl bg-tech-cyan/10 flex items-center justify-center">
              <Video className="w-7 h-7 text-tech-cyan" />
            </div>
            <h3 className="text-white font-medium mb-1">实时视频流</h3>
            <p className="text-slate-500 text-sm">WebRTC P2P 低延迟传输</p>
          </div>
          <div className="text-center">
            <div className="w-14 h-14 mx-auto mb-3 rounded-xl bg-tech-purple/10 flex items-center justify-center">
              <Zap className="w-7 h-7 text-tech-purple" />
            </div>
            <h3 className="text-white font-medium mb-1">三维重建</h3>
            <p className="text-slate-500 text-sm">COLMAP 稀疏点云重建</p>
          </div>
          <div className="text-center">
            <div className="w-14 h-14 mx-auto mb-3 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <Users className="w-7 h-7 text-emerald-400" />
            </div>
            <h3 className="text-white font-medium mb-1">协作标注</h3>
            <p className="text-slate-500 text-sm">多人实时同步 3D 标注</p>
          </div>
        </div>
      </div>
    </div>
  );
}
