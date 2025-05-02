// SPDX-License-Identifier: AGPL-3.0-only
// Toolbar focus lock component
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

import { useEventListener } from '@/hooks/use-event-listener';
import { companionAnchorTagName } from '@/utils';
import { useEffect, useRef } from 'preact/hooks';

// The FocusLock component is responsible for preventing programmatic focus loss to the main app when the companion receives focus.
// It should be instantiated once in the companion's root component and directly inter-operates with the FocusLockManager.
export function FocusLock() {
  const focusInCompanion = useRef(false);

  useEffect(() => {
    const originalFocus = HTMLElement.prototype.focus;

    HTMLElement.prototype.focus = function (...args) {
      const shadowRoot = this.getRootNode();
      const isInCompanion =
        shadowRoot instanceof ShadowRoot &&
        shadowRoot.host instanceof HTMLElement &&
        shadowRoot.host.nodeName === 'STAGEWISE-COMPANION-ANCHOR';
      if (!isInCompanion && focusInCompanion.current) {
        return;
      }
      originalFocus.apply(this, args);
    };

    return () => {
      HTMLElement.prototype.focus = originalFocus;
    };
  }, []);

  useEventListener(
    'focusin',
    (event) => {
      if (event.target.localName === companionAnchorTagName) {
        focusInCompanion.current = true;
      }
    },
    { capture: true },
  );

  useEventListener(
    'focusout',
    (event) => {
      if (event.target.localName === companionAnchorTagName) {
        focusInCompanion.current = false;
      }
    },
    { capture: true },
  );

  return null;
}
