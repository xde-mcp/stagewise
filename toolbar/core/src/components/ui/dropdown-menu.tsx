// SPDX-License-Identifier: AGPL-3.0-only
// Toolbar dropdown menu component
// Copyright (C) 2025 Goetze, Scharpff & Toews GbR

// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as
// published by the Free Software Foundation, either version 3 of the
// License, or (at your option) any later version.

// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU Affero General Public License for more details.

// You should have received a copy of the GNU Affero General Public License
// along with this program. If not, see <https://www.gnu.org/licenses/>.

import { cn } from '@/utils';
import {
  Menu,
  MenuButton,
  type MenuButtonProps,
  MenuItems,
  type MenuItemsProps,
  MenuItem,
  type MenuItemProps,
  Button,
} from '@headlessui/react';
import { forwardRef, Fragment, type Ref } from 'preact/compat';

export const DropdownMenu = Menu;

export const DropdownMenuButton = forwardRef(
  (props: MenuButtonProps, ref: Ref<typeof MenuButton>) => {
    return <MenuButton as={Fragment} ref={ref} {...props} />;
  },
);

export const DropdownMenuContent = forwardRef(
  (props: MenuItemsProps, ref: Ref<typeof MenuItems>) => {
    return (
      <MenuItems
        ref={ref}
        anchor="bottom"
        transition
        portal
        {...props}
        className={cn(
          'z-50 flex w-fit min-w-24 max-w-90 flex-col items-stretch justify-start gap-1 rounded-lg border border-border/30 border-solid bg-background/60 p-1 shadow-black/50 shadow-lg outline-none backdrop-blur-md data-focus:outline-none',
          props.className,
        )}
      />
    );
  },
);

const DropdownMenuItemStyles =
  'w-full flex flex-row select-none items-center justify-start gap-2 p-2 pr-6 truncate overflow-hidden rounded-md hover:bg-zinc-950/10 focus:text-zinc-900 cursor-pointer transition-color duration-150 text-sm font-normal text-foreground';

export const DropdownMenuButttonItem = forwardRef(
  (props: MenuItemProps, ref: Ref<typeof MenuItem>) => {
    return (
      <MenuItem ref={ref}>
        <Button
          {...props}
          className={cn(DropdownMenuItemStyles, props.className)}
        />
      </MenuItem>
    );
  },
);

export const DropdownMenuLinkItem = forwardRef(
  (props: MenuItemProps, ref: Ref<typeof MenuItem>) => {
    return (
      <MenuItem ref={ref}>
        <a {...props} className={cn(DropdownMenuItemStyles, props.className)} />
      </MenuItem>
    );
  },
);
