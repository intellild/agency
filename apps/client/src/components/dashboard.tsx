'use client';

import { useNavigate } from '@modern-js/runtime/router';

import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useAuth } from '@/hooks/auth';

interface DashboardProps {
  onReconfigure: () => void;
}

export function Dashboard({ onReconfigure }: DashboardProps) {
  const navigate = useNavigate();
  const [_auth, setAuth] = useAuth();

  const handleLogout = async () => {
    setAuth(null);
    navigate('/login');
  };

  return (
    <div className="flex min-h-screen flex-col p-6">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-bold text-2xl">Dashboard</h1>
          <p className="text-muted-foreground text-sm">已连接到服务器</p>
        </div>
        <div className="flex items-center gap-2">
          {/*{userInfo && (*/}
          {/*  <div className="mr-4 flex items-center gap-2">*/}
          {/*    <Avatar className="h-8 w-8">*/}
          {/*      <AvatarImage*/}
          {/*        src={`https://github.com/${userInfo.username}.png`}*/}
          {/*        alt={userInfo.username}*/}
          {/*      />*/}
          {/*      <AvatarFallback>*/}
          {/*        <User className="h-4 w-4" />*/}
          {/*      </AvatarFallback>*/}
          {/*    </Avatar>*/}
          {/*    <span className="font-medium text-sm">{userInfo.username}</span>*/}
          {/*  </div>*/}
          {/*)}*/}
          <Button variant="outline" size="sm" onClick={onReconfigure}>
            重新配置
          </Button>
          <Button variant="outline" size="sm" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            退出登录
          </Button>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
          <div className="text-muted-foreground text-sm">暂无活动记录</div>
        </CardContent>
      </Card>

      {/*{userInfo && (*/}
      {/*  <Card className="mt-6">*/}
      {/*    <CardHeader>*/}
      {/*      <CardTitle className="flex items-center gap-2">*/}
      {/*        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">*/}
      {/*          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />*/}
      {/*        </svg>*/}
      {/*        GitHub 账户信息*/}
      {/*      </CardTitle>*/}
      {/*      <CardDescription>已连接的 GitHub 账户</CardDescription>*/}
      {/*    </CardHeader>*/}
      {/*    <CardContent>*/}
      {/*      <div className="flex items-center gap-4">*/}
      {/*        <Avatar className="h-16 w-16">*/}
      {/*          <AvatarImage*/}
      {/*            src={`https://github.com/${userInfo.username}.png`}*/}
      {/*            alt={userInfo.username}*/}
      {/*          />*/}
      {/*          <AvatarFallback>*/}
      {/*            <User className="h-8 w-8" />*/}
      {/*          </AvatarFallback>*/}
      {/*        </Avatar>*/}
      {/*        <div>*/}
      {/*          <p className="font-medium text-lg">{userInfo.username}</p>*/}
      {/*          <p className="text-muted-foreground text-sm">*/}
      {/*            ID: {userInfo.userId}*/}
      {/*          </p>*/}
      {/*        </div>*/}
      {/*      </div>*/}
      {/*    </CardContent>*/}
      {/*  </Card>*/}
      {/*)}*/}
    </div>
  );
}
