import { cn } from '@/utils';
import { glassyBoxClassName } from './glassy';

import * as React from 'react';
import { Select as BaseSelect } from '@base-ui-components/react/select';

export interface SelectItem<T = any> {
  label: string;
  value: T;
  icon?: React.ReactNode;
}

export interface SelectProps<T = any> {
  items: SelectItem<T>[];
  value?: T;
  onChange?: (value: T) => void;
  placeholder?: string;
  className?: string;
}

export function Select<T = any>({
  items,
  value,
  onChange,
  placeholder = 'Select an option',
  className,
}: SelectProps<T>) {
  return (
    <BaseSelect.Root items={items} value={value} onValueChange={onChange}>
      <BaseSelect.Trigger
        className={cn(
          'relative flex h-8 w-full items-center justify-between gap-2 rounded-lg px-3 py-2',
          'bg-white/90 backdrop-blur-sm',
          'border border-zinc-200/80 shadow-sm',
          'hover:border-zinc-300 hover:bg-white hover:shadow-md',
          'focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20',
          'transition-all duration-150 ease-out',
          'font-normal text-foreground/80 text-sm',
          className,
        )}
      >
        <BaseSelect.Value className="flex items-center gap-2 truncate">
          {(selectedValue) => {
            const selectedItem = items.find(
              (item) => item.value === selectedValue,
            );
            return (
              <>
                {selectedItem?.icon && (
                  <span className="size-4 flex-shrink-0">
                    {selectedItem.icon}
                  </span>
                )}
                <span className="truncate">
                  {selectedItem?.label || placeholder}
                </span>
              </>
            );
          }}
        </BaseSelect.Value>
        <BaseSelect.Icon>
          <ChevronDownIcon className="size-3 text-foreground/60" />
        </BaseSelect.Icon>
      </BaseSelect.Trigger>
      <BaseSelect.Portal>
        <BaseSelect.Positioner sideOffset={4}>
          <BaseSelect.Popup
            className={cn(
              glassyBoxClassName,
              'z-50 w-full min-w-[8rem] overflow-hidden rounded-xl p-1',
              'shadow-black/10 shadow-xl',
              'fade-in-0 zoom-in-95 animate-in',
            )}
          >
            <BaseSelect.ScrollUpArrow className="flex h-6 items-center justify-center text-zinc-400">
              <ChevronUpIcon className="size-4" />
            </BaseSelect.ScrollUpArrow>
            {items.map(
              (item) =>
                item && (
                  <BaseSelect.Item
                    key={String(item.value)}
                    value={item.value}
                    className={cn(
                      'relative flex cursor-pointer select-none items-center rounded-lg px-2 py-2 text-sm',
                      'text-foreground/80 outline-none',
                      'transition-colors duration-150',
                      'hover:bg-zinc-100/80',
                      'data-[selected]:bg-blue-600 data-[selected]:text-white',
                      'data-[selected]:data-[focused]:bg-blue-600 data-[focused]:bg-zinc-100/80',
                    )}
                  >
                    <BaseSelect.ItemText className="flex items-center gap-2">
                      {item.icon && (
                        <span className="size-4 flex-shrink-0">
                          {item.icon}
                        </span>
                      )}
                      <span>{item.label}</span>
                    </BaseSelect.ItemText>
                  </BaseSelect.Item>
                ),
            )}
            <BaseSelect.ScrollDownArrow className="flex h-6 items-center justify-center text-zinc-400">
              <ChevronDownIcon className="size-4" />
            </BaseSelect.ScrollDownArrow>
          </BaseSelect.Popup>
        </BaseSelect.Positioner>
      </BaseSelect.Portal>
    </BaseSelect.Root>
  );
}

function ChevronUpIcon(props: React.ComponentProps<'svg'>) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M3 7.5L6 4.5L9 7.5" />
    </svg>
  );
}

function ChevronDownIcon(props: React.ComponentProps<'svg'>) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M3 4.5L6 7.5L9 4.5" />
    </svg>
  );
}
