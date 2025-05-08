// SPDX-License-Identifier: AGPL-3.0-only
// Toolbar element size hook
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

import { useCallback, useEffect, useState } from 'preact/hooks';

export function useElementSize(node: HTMLElement | null) {
  const [size, setSize] = useState({ width: 0, height: 0 });

  const handleSize = useCallback(() => {
    if (node) {
      setSize({
        width: node?.offsetWidth ?? 0,
        height: node?.offsetHeight ?? 0,
      });
    }
  }, [node]);

  useEffect(() => {
    if (!node) return;

    handleSize();

    const resizeObserver = new ResizeObserver(handleSize);
    resizeObserver.observe(node);

    return () => resizeObserver.disconnect();
  }, [node, handleSize]);

  return size;
}
