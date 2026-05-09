'use client';

import { useNavigate } from '@modern-js/runtime/router';
import { CheckCircle, Loader2, XCircle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParam } from 'react-use';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useAuth, useSessionState } from '@/hooks/auth';

export default function OAuthCallbackPage() {
  const navigate = useNavigate();
  const [sessionState, setSessionState] = useSessionState();
  const [_auth, setAuth] = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);

  const state = useSearchParam('state');
  const accessToken = useSearchParam('accessToken');
  const refreshToken = useSearchParam('refreshToken');
  const githubToken = useSearchParam('githubToken');
  const userId = useSearchParam('userId');
  const username = useSearchParam('username');
  const oauthError = useSearchParam('error');

  const isPending = !completed && !error;

  const authPayload = useMemo(() => {
    if (!accessToken || !refreshToken || !githubToken || !userId || !username) {
      return null;
    }

    return {
      accessToken,
      refreshToken,
      githubToken,
      userId,
      username,
    };
  }, [accessToken, refreshToken, githubToken, userId, username]);

  useEffect(() => {
    if (oauthError) {
      setError(oauthError);
      return;
    }

    if (!state || state !== sessionState) {
      setError(`Invalid state ${state}, expected ${sessionState}`);
      return;
    }

    if (!authPayload) {
      setError('Missing authentication payload');
      return;
    }

    setAuth(authPayload);
    setSessionState(undefined);
    setCompleted(true);
    navigate('/');
  }, [authPayload, oauthError, state, sessionState]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          {isPending && (
            <>
              <Loader2 className="mx-auto mb-4 h-12 w-12 animate-spin text-primary" />
              <CardTitle className="text-2xl">Completing Login...</CardTitle>
              <CardDescription>
                Please wait while we verify your credentials
              </CardDescription>
            </>
          )}
          {completed && (
            <>
              <CheckCircle className="mx-auto mb-4 h-12 w-12 text-green-500" />
              <CardTitle className="text-2xl">Login Successful!</CardTitle>
              <CardDescription>Redirecting to dashboard...</CardDescription>
            </>
          )}
          {error && (
            <>
              <XCircle className="mx-auto mb-4 h-12 w-12 text-red-500" />
              <CardTitle className="text-2xl">Login Failed</CardTitle>
              <CardDescription>{error}</CardDescription>
            </>
          )}
        </CardHeader>
        <CardContent>
          {error && (
            <Button onClick={() => navigate('/login')} className="w-full">
              Back to Login
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
