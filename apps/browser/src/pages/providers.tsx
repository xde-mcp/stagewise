import { KartonProvider } from './hooks/use-karton';
import { TooltipProvider } from '@stagewise/stage-ui/components/tooltip';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider>
      <KartonProvider>{children}</KartonProvider>
    </TooltipProvider>
  );
}
