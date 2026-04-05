import { Outlet } from '@modern-js/runtime/router';
import { TooltipProvider } from '@/components/ui/tooltip';

import './index.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthGuard } from '@/components/auth-guard';

const queryClient = new QueryClient();

export default function Layout() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthGuard>
          <Outlet />
        </AuthGuard>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
