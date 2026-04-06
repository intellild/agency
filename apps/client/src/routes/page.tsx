'use client';

import { Helmet } from '@modern-js/runtime/head';
import { Dashboard } from '@/components/dashboard';

export default function Index() {
  return (
    <>
      <Helmet>
        <title>Agency</title>
      </Helmet>
      <Dashboard />
    </>
  );
}
