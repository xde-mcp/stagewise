import { Button } from '@stagewise/stage-ui/components/button';
import { IconOpenRectArrowInFillDuo18 } from 'nucleo-ui-fill-duo-18';
import { useKartonProcedure } from '@/hooks/use-karton';
import { Logo } from '@/components/ui/logo';

export function NotSignedIn() {
  const startLogin = useKartonProcedure((p) => p.userAccount.startLogin);

  return (
    <div className="flex size-full flex-col items-center justify-center gap-10 p-4 text-center">
      <div className="flex flex-col items-center justify-center gap-4">
        <Logo className="size-12 text-muted-foreground/20" color="current" />
        <span className="font-medium text-foreground text-xl">
          One last step...
        </span>
        <span className="text-muted-foreground text-sm">
          Sign in to get started with{' '}
          <strong className="font-semibold">stage</strong>, our purpose-built
          coding agent for web frontend development.
        </span>
      </div>
      <Button variant="primary" size="md" onClick={() => startLogin()}>
        Sign into stagewise
        <IconOpenRectArrowInFillDuo18 className="size-4" />
      </Button>
    </div>
  );
}
