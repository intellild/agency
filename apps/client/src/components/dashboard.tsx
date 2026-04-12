'use client';

import { useNavigate } from '@modern-js/runtime/router';
import { useSetAtom } from 'jotai';
import { Loader2, LogOut, Wifi, WifiOff } from 'lucide-react';
import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useP2P } from '@/p2p';
import { authAtom } from '@/stores/auth';

export function Dashboard() {
  const navigate = useNavigate();
  const setAuth = useSetAtom(authAtom);

  // Use P2P hook for connection management
  const {
    isConnected,
    isConnecting,
    hasError,
    errorMessage,
    canConnect,
    info,
    connect,
    disconnect,
  } = useP2P();

  const handleLogout = async () => {
    await disconnect();
    setAuth(null);
    navigate('/login');
  };

  const handleConnect = async () => {
    try {
      await connect();
    } catch (err) {
      console.error('Failed to connect:', err);
    }
  };

  const handleDisconnect = async () => {
    await disconnect();
  };

  // Get connection status display
  const status = useMemo(() => {
    if (isConnected) {
      return { icon: Wifi, color: 'text-green-500', text: '已连接' };
    }
    if (isConnecting) {
      return {
        icon: Loader2,
        color: 'text-yellow-500 animate-spin',
        text: '连接中...',
      };
    }
    if (hasError) {
      return {
        icon: WifiOff,
        color: 'text-red-500',
        text: errorMessage || '连接错误',
      };
    }
    return { icon: WifiOff, color: 'text-gray-400', text: '未连接' };
  }, [isConnected, isConnecting, hasError, errorMessage]);

  const StatusIcon = status.icon;

  return (
    <div className="flex min-h-screen flex-col p-6">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-bold text-2xl">Dashboard</h1>
          <p className="text-muted-foreground text-sm">已连接到服务器</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            退出登录
          </Button>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* P2P Connection Status Card */}
        <Card>
          <CardHeader>
            <CardTitle>P2P 连接状态</CardTitle>
            <CardDescription>与服务器的 P2P 连接状态</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <StatusIcon className={`h-5 w-5 ${status.color}`} />
                <span className="font-medium text-sm">{status.text}</span>
              </div>

              {info.peerId && (
                <div className="text-muted-foreground text-xs">
                  <p>节点 ID: {info.peerId.slice(0, 20)}...</p>
                </div>
              )}

              {info.directConnected && (
                <div className="flex items-center gap-2 text-green-600 text-xs">
                  <div className="h-2 w-2 rounded-full bg-green-500" />
                  直接 WebRTC 连接
                </div>
              )}

              {info.relayConnected && (
                <div className="flex items-center gap-2 text-xs text-yellow-600">
                  <div className="h-2 w-2 rounded-full bg-yellow-500" />
                  中继连接
                </div>
              )}

              <div className="flex gap-2 pt-2">
                {canConnect && (
                  <Button size="sm" onClick={handleConnect}>
                    连接
                  </Button>
                )}
                {(isConnected || isConnecting) && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleDisconnect}
                  >
                    断开
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>代理状态</CardTitle>
            <CardDescription>当前代理连接状态</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500" />
              <span className="text-sm">运行中</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>任务队列</CardTitle>
            <CardDescription>待处理任务数量</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">0</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>消息统计</CardTitle>
            <CardDescription>今日消息收发统计</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">0</div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6 flex-1">
        <CardHeader>
          <CardTitle>活动日志</CardTitle>
          <CardDescription>最近的系统活动</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground text-sm">
            {isConnected ? (
              <p className="text-green-600">✓ P2P 连接已建立</p>
            ) : (
              <p>暂无活动记录</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
