import { cn } from '@/utils';
import type { ComponentChildren } from 'preact';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: ComponentChildren;
  style?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  onClick: () => void;
  asChild?: boolean;
  disabled?: boolean;
}
export function Button({
  children,
  style = 'primary',
  size = 'md',
  onClick,
  asChild,
  disabled,
  ...props
}: ButtonProps) {
  if (asChild) {
    return (
      <button
        {...props}
        onClick={onClick}
        disabled={disabled}
        className="cursor-pointer"
      >
        {children}
      </button>
    );
  }
  return (
    <button
      {...props}
      onClick={onClick}
      className={cn(
        'flex h-12 cursor-pointer items-center justify-center rounded-md p-2 text-white',
        size === 'sm' && 'h-8',
        size === 'md' && 'h-12',
        size === 'lg' && 'h-16',
        style === 'primary' && 'bg-blue-500',
        style === 'secondary' && 'bg-gray-500',
        style === 'outline' && 'border border-blue-500 bg-white text-blue-500',
        style === 'ghost' && 'bg-transparent text-blue-500',
      )}
      type="submit"
      disabled={disabled}
    >
      {children}
    </button>
  );
}
