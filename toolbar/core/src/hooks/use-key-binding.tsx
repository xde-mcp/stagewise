// SPDX-License-Identifier: AGPL-3.0-only
// Toolbar key binding hook
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

import { useCallback } from 'preact/hooks';
import { useEventListener } from './use-event-listener';

const eventListenerOptions: AddEventListenerOptions = {
  capture: true,
};

// binding and unbinding keydown handler
export function useKeydownBinding(
  key: string,
  withCtrl: boolean,
  withAlt: boolean,
  callback: () => void,
) {
  const handler = useCallback(
    (ev: KeyboardEvent) => {
      if (
        ev.key === key &&
        (ev.ctrlKey || !withCtrl) &&
        (ev.altKey || !withAlt)
      )
        callback();
    },
    [callback, key, withAlt, withCtrl],
  );

  useEventListener('keydown', handler, eventListenerOptions);
}
