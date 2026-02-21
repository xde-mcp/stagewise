import type { FC, HTMLAttributes } from 'react';
import { cn } from '@/utils';
import { StagewiseOrb } from '@ui/assets/stagewise';
import { LogoText } from '@stagewise/stage-ui/components/logo-text';

export interface LogoWithTextProps extends HTMLAttributes<HTMLDivElement> {
  textClassName?: string;
}

/**
 * stagewise logo with text.
 * Combines the logo orb image with the LogoText SVG component.
 * The text color inherits from the parent via `currentColor`, making it
 * work correctly in both light and dark modes.
 */
export const LogoWithText: FC<LogoWithTextProps> = ({
  className,
  textClassName,
  ...props
}) => {
  return (
    <div className={cn('flex h-10 items-center gap-2', className)} {...props}>
      <img src={StagewiseOrb} alt="" className="h-full w-auto" />
      <LogoText className={cn('h-[60%] w-auto fill-current', textClassName)} />
    </div>
  );
};
