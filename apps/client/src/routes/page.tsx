'use client';

import { Helmet } from '@modern-js/runtime/head';
import { Dashboard } from '@/components/dashboard';
import { ServerConfigForm } from '@/components/server-config-form';
import { useIsConfigured } from '@/stores/connection';

export default function Index() {
  const [isConfigured] = useIsConfigured();

  return (
    <>
      <Helmet>
        <title>Agency</title>
      </Helmet>
      {isConfigured ? <Dashboard /> : <ServerConfigForm />}
    </>
  );
}
