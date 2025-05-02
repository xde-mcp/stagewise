// SPDX-License-Identifier: AGPL-3.0-only
// Toolbar cyclic update hook
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

// This hook is used to call a configured function cyclically with the given frame rate.
// If no frame rate is given, it will default to trigger the function every repaint (requestAnimationFrame).
// If a frame rate of 0 is set, the update call will never be made.

import { useCallback, useEffect, useMemo, useRef } from 'preact/hooks';

export function useCyclicUpdate(func: () => void, frameRate?: number) {
  const animationFrameHandle = useRef<number | undefined>(undefined);

  const timeBetweenFrames = useMemo(
    () => (frameRate && frameRate > 0 ? 1000 / frameRate : 0),
    [frameRate],
  );

  const lastCallFrameTime = useRef<number>(0);

  const update = useCallback(
    (frameTime: number) => {
      if (frameTime - lastCallFrameTime.current >= timeBetweenFrames) {
        func();
        lastCallFrameTime.current = frameTime;
      }

      animationFrameHandle.current = requestAnimationFrame(update);
    },
    [func, timeBetweenFrames],
  );

  useEffect(() => {
    if (!frameRate || frameRate > 0) {
      animationFrameHandle.current = requestAnimationFrame(update);
    }

    return () => {
      if (animationFrameHandle.current) {
        cancelAnimationFrame(animationFrameHandle.current);
        animationFrameHandle.current = undefined;
      }
    };
  }, [frameRate, update]);
}
