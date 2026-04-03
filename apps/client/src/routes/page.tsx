import { Helmet } from '@modern-js/runtime/head';
import type { FunctionComponent, PropsWithChildren } from 'react';
import './index.css';

const Index: FunctionComponent<PropsWithChildren> = ({ children }) => {
  return (
    <div>
      <Helmet>{children}</Helmet>
    </div>
  );
};

export default Index;
