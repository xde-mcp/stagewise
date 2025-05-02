// SPDX-License-Identifier: AGPL-3.0-only
// Toolbar expand button component
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

import { useAppState } from '@/hooks/use-app-state';
import { Logo } from './ui/logo';

export function ExpandButton() {
  const expand = useAppState((state) => state.expand);

  return (
    <button
      type="button"
      onClick={() => expand()}
      className="pointer-events-auto absolute bottom-3 left-3 size-12 rounded-full bg-transparent opacity-80 shadow-sm transition-all duration-500 hover:opacity-100 hover:shadow-lg"
    >
      <Logo color="gradient" />
    </button>
  );
}
