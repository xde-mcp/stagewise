import { FileIcon } from 'lucide-react';
import type { BadgeProps } from '../types';
import { BadgeShell } from '../shared/badge-shell';

export function FallbackBadge(props: BadgeProps) {
  return (
    <BadgeShell
      {...props}
      icon={<FileIcon className="size-3 shrink-0" />}
      tooltipContent={<span>{props.fileName}</span>}
    />
  );
}
