'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Helmet } from '@modern-js/runtime/head';
import { useNavigate } from '@modern-js/runtime/router';
import { Controller, useForm } from 'react-hook-form';
import { resolveURL, withQuery } from 'ufo';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  useAuth,
  useGithubClientId,
  useServerAddress,
  useSessionState,
} from '@/hooks/auth';
import MdiGithub from '~icons/mdi/github';

const schema = z.object({
  serverAddress: z.url(),
  githubClientId: z.string().min(1),
});

export default function LoginPage() {
  const navigate = useNavigate();
  const [serverAddress, setServerAddress] = useServerAddress();
  const [githubClientId, setGithubClientId] = useGithubClientId();
  const [_sessionState, setSessionState] = useSessionState();
  const [auth] = useAuth();

  if (auth) {
    navigate('/');
  }

  const {
    handleSubmit,
    control,
    formState: { isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      serverAddress: serverAddress,
      githubClientId: githubClientId || '',
    },
  });

  const onSubmit = handleSubmit(async data => {
    setServerAddress(data.serverAddress);
    setGithubClientId(data.githubClientId);

    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    // @ts-expect-error
    const state = bytes.toHex();
    setSessionState(state);

    window.location.href = withQuery(
      'https://github.com/login/oauth/authorize',
      {
        client_id: data.githubClientId,
        redirect_uri: resolveURL(window.location.origin, 'oauth/callback'),
        state,
        scope: 'read:user',
      },
    );
  });

  return (
    <>
      <Helmet>
        <title>Login - Agency</title>
      </Helmet>
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background to-muted p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex items-center justify-center rounded-full">
              <MdiGithub className="h-12 w-12" />
            </div>
            <CardTitle className="text-2xl">Welcome to Agency</CardTitle>
            <CardDescription>
              Connect to your agency server to get started
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={onSubmit}>
              <FieldGroup>
                <Controller
                  name="githubClientId"
                  control={control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="form-rhf-github-client-id">
                        Github Client ID
                      </FieldLabel>
                      <Input
                        {...field}
                        id="form-rhf-github-client-id"
                        aria-invalid={fieldState.invalid}
                        autoComplete="off"
                      />
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />
                <Controller
                  name="serverAddress"
                  control={control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="form-rhf-server-address">
                        Server Address
                      </FieldLabel>
                      <Input
                        {...field}
                        id="form-rhf-server-address"
                        aria-invalid={fieldState.invalid}
                        autoComplete="off"
                      />
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />
              </FieldGroup>
            </form>

            <CardFooter className="flex flex-col">
              <Button
                className="w-full"
                size="lg"
                disabled={isSubmitting}
                onClick={onSubmit}
              >
                <MdiGithub />
                Sign in with GitHub
              </Button>

              <p className="text-center text-muted-foreground text-xs">
                By signing in, you agree to the terms of service and privacy
                policy.
              </p>
            </CardFooter>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
