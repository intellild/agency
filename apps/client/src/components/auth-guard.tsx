'use client';

import { useLocation, useNavigate } from '@modern-js/runtime/router';
import type { PropsWithChildren } from 'react';
import { useAuth } from '@/hooks/auth';

export function AuthGuard({ children }: PropsWithChildren) {
  const navigate = useNavigate();
  const location = useLocation();
  const [state] = useAuth();

  if (!!state && !['/login', '/oauth/callback'].includes(location.pathname)) {
    navigate('/login');
  }

  return <>{children}</>;
}
