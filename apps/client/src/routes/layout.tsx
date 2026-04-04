import { Outlet } from '@modern-js/runtime/router';
import { TooltipProvider } from '@/components/ui/tooltip';

import './index.css';

export default function Layout() {
  return (
    <TooltipProvider>
      <Outlet />
    </TooltipProvider>
  );
}
