// SPDX-License-Identifier: AGPL-3.0-only
// Toolbar section component
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

import type { VNode } from 'preact';

export function ToolbarSection({ children }: { children?: VNode }) {
  return (
    <div className="fade-in slide-in-from-bottom-2 flex max-h-full max-w-sm animate-in snap-start flex-row items-center justify-between gap-2 border-x border-r-border/30 border-l-transparent px-3 first:pl-0 last:border-r-transparent last:pr-0">
      {children}
    </div>
  );
}
