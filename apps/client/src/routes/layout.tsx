import { Outlet } from '@modern-js/runtime/router';
import { TooltipProvider } from '@/components/ui/tooltip';

export default function Layout() {
  return (
    <TooltipProvider>
      <div>
        <Outlet />
      </div>
    </TooltipProvider>
  );
}
