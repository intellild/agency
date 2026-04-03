import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useServerConfig } from '@/stores/connection';

export function Dashboard() {
  const [config, setConfig] = useServerConfig();

  const handleReset = () => {
    setConfig(null);
  };

  return (
    <div className="flex min-h-screen flex-col p-6">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-bold text-2xl">Dashboard</h1>
          <p className="text-muted-foreground text-sm">
            已连接到: {config?.address}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleReset}>
          重新配置
        </Button>
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
    </div>
  );
}
