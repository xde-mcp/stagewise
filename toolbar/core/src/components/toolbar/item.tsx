// SPDX-License-Identifier: AGPL-3.0-only
// Toolbar item component
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
import type { VNode } from 'preact';

export interface ToolbarItemProps {
  badgeContent?: VNode;
  badgeClassName?: string;
  statusDot?: boolean;
  statusDotClassName?: string;
  children?: VNode;
}

export function ToolbarItem(props: ToolbarItemProps) {
  return (
    <div className="flex h-full shrink-0 items-center justify-center">
      {props.children}
      {props.badgeContent && (
        <div
          className={cn(
            'bg-blue-600 text-white',
            props.badgeClassName,
            '-bottom-0.5 -right-1 pointer-events-none absolute flex h-4 w-max min-w-4 max-w-8 select-none items-center justify-center truncate rounded-full px-1 font-semibold text-xs',
          )}
        >
          {props.badgeContent}
        </div>
      )}
      {props.statusDot && (
        <div
          className={cn(
            'bg-rose-600',
            props.statusDotClassName,
            'pointer-events-none absolute top-0 right-0 size-1.5 rounded-full',
          )}
        />
      )}
    </div>
  );
}
