import { IDE_LOGOS } from '@ui/assets/ide-logos';
import { IconCodeEditorFill18 } from 'nucleo-ui-fill-18';
import { cn } from '@stagewise/stage-ui/lib/utils';
import type { OpenFilesInIde } from '@shared/karton-contracts/ui/shared-types';

export const IdeLogo = ({
  ide,
  className,
}: {
  ide: OpenFilesInIde;
  className?: string;
}) => {
  return ide === 'other' ? (
    <IconCodeEditorFill18
      className={cn('size-3 shrink-0 text-muted-foreground', className)}
    />
  ) : (
    <img
      src={IDE_LOGOS[ide]}
      alt={ide}
      className={cn('size-3 shrink-0', className)}
    />
  );
};
