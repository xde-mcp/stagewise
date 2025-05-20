import { cn } from '@/utils';
import type { ComponentChildren } from 'preact';

interface BadgeProps {
  children: ComponentChildren;
  color: 'blue' | 'green' | 'red' | 'yellow' | 'purple' | 'orange' | 'pink';
  style: 'default' | 'outline';
}

export function Badge({ children, color, style }: BadgeProps) {
  return (
    <span
      className={cn(
        'rounded-md p-2 text-white',
        style === 'default' && {
          'bg-blue-500': color === 'blue',
          'bg-green-500': color === 'green',
          'bg-red-500': color === 'red',
          'bg-yellow-500': color === 'yellow',
          'bg-purple-500': color === 'purple',
          'bg-orange-500': color === 'orange',
          'bg-pink-500': color === 'pink',
        },
        style === 'outline' && {
          'border border-blue-500 text-zinc-950': color === 'blue',
          'border border-green-500 text-zinc-950': color === 'green',
          'border border-red-500 text-zinc-950': color === 'red',
          'border border-yellow-500 text-zinc-950': color === 'yellow',
          'border border-purple-500 text-zinc-950': color === 'purple',
          'border border-orange-500 text-zinc-950': color === 'orange',
          'border border-pink-500 text-zinc-950': color === 'pink',
        },
      )}
    >
      {children}
    </span>
  );
}
