import { Outlet } from '@modern-js/runtime/router';
import { DevTools } from 'jotai-devtools';
import { TooltipProvider } from '@/components/ui/tooltip';
import 'jotai-devtools/styles.css';

import './index.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { memo } from 'react';
import { AuthGuard } from '@/components/auth-guard';
import { FetchContext } from '@/hooks/fetch';
import { store } from '@/stores';
import { $api, authAtom } from '@/stores/auth';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn(context) {
        const { queryKey } = context;
        return $api(queryKey[0] as string);
      },
      enabled() {
        const auth = store.get(authAtom);
        return typeof window !== 'undefined' && !!auth;
      },
    },
  },
});

const Layout = memo(function Layout() {
  return (
    <FetchContext.Provider value={$api}>
      {import.meta.env.DEV && <DevTools />}
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <AuthGuard>
            <Outlet />
          </AuthGuard>
        </TooltipProvider>
      </QueryClientProvider>
    </FetchContext.Provider>
  );
});

export default Layout;
