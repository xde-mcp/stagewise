// SPDX-License-Identifier: AGPL-3.0-only
// Toolbar no user image fallback component
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

import { User } from 'lucide-react';

export function NoUserImageFallback() {
  return (
    <div className="flex size-full items-center justify-center bg-zinc-500 font-bold text-base text-white">
      <User size="size-2/3" />
    </div>
  );
}
