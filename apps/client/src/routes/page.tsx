'use client';

import { Helmet } from '@modern-js/runtime/head';
import { useState } from 'react';
import { AuthGuard } from '@/components/auth-guard';
import { Dashboard } from '@/components/dashboard';
import { ServerConfigForm } from '@/components/server-config-form';
import { useIsConfigured, useServerConfig } from '@/stores/connection';

export default function Index() {
  const [isConfigured] = useIsConfigured();
  const [config] = useServerConfig();
  const [isEditing, setIsEditing] = useState(false);

  const showDashboard = isConfigured && !isEditing;

  return (
    <>
      <Helmet>
        <title>Agency</title>
      </Helmet>
      {showDashboard ? (
        <Dashboard onReconfigure={() => setIsEditing(true)} />
      ) : (
        <ServerConfigForm
          initialConfig={config}
          onCancel={isConfigured ? () => setIsEditing(false) : undefined}
        />
      )}
    </>
  );
}
