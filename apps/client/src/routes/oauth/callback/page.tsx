'use client';

import { useNavigate } from '@modern-js/runtime/router';
import { useMutation } from '@tanstack/react-query';
import { CheckCircle, Loader2, XCircle } from 'lucide-react';
import { $fetch } from 'ofetch';
import { useEffect } from 'react';
import { useSearchParam } from 'react-use';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useAuth, useServerAddress, useSessionState } from '@/hooks/auth';
import type { Auth } from '@/stores/auth';

export default function OAuthCallbackPage() {
  const navigate = useNavigate();

  const [serverAddress] = useServerAddress();
  const [sessionState, setSessionState] = useSessionState();
  const code = useSearchParam('code');
  const state = useSearchParam('state');

  const [_auth, setAuth] = useAuth();

  const { mutate, isPending, isError, isSuccess, error } = useMutation({
    async mutationFn() {
      if (!code) {
        throw new Error('Invalid code');
      }
      if (!state || state !== sessionState) {
        throw new Error(`Invalid state ${state}, expected ${sessionState}`);
      }
      return await $fetch<Auth>('/auth/github/callback', {
        method: 'POST',
        baseURL: serverAddress,
        body: {
          code,
        },
      });
    },
    onSuccess(data) {
      setSessionState(undefined);
      navigate('/');
      setAuth(data);
    },
  });

  useEffect(() => {
    mutate();
  }, []);

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
          {isSuccess && (
            <>
              <CheckCircle className="mx-auto mb-4 h-12 w-12 text-green-500" />
              <CardTitle className="text-2xl">Login Successful!</CardTitle>
              <CardDescription>Redirecting to dashboard...</CardDescription>
            </>
          )}
          {isError && (
            <>
              <XCircle className="mx-auto mb-4 h-12 w-12 text-red-500" />
              <CardTitle className="text-2xl">Login Failed</CardTitle>
              <CardDescription>{error.message}</CardDescription>
            </>
          )}
        </CardHeader>
        <CardContent>
          {isError && (
            <Button
              onClick={() => navigate('/login')}
              className="w-full rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
            >
              Back to Login
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
