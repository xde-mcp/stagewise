// SPDX-License-Identifier: AGPL-3.0-only
// Toolbar hotkey listener component
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
import { useCallback, useMemo } from 'preact/hooks';
import { hotkeyActionDefinitions, HotkeyActions } from '../utils';
import { useChatState } from '@/hooks/use-chat-state';

// This listener is responsible for listening to hotkeys and triggering the appropriate actions in the global app state.
export function HotkeyListener() {
  const { startPromptCreation, stopPromptCreation } = useChatState();

  const hotKeyHandlerMap: Record<HotkeyActions, () => void> = useMemo(
    () => ({
      [HotkeyActions.CTRL_ALT_C]: () => {
        startPromptCreation();
      },
      [HotkeyActions.ESC]: () => {
        stopPromptCreation();
      },
    }),
    [startPromptCreation, stopPromptCreation],
  );

  const hotKeyListener = useCallback(
    (ev: KeyboardEvent) => {
      // The first matching hotkey action will be executed and abort further processing of other hotkey actions.
      for (const [action, definition] of Object.entries(
        hotkeyActionDefinitions,
      )) {
        if (definition.isEventMatching(ev)) {
          ev.preventDefault();
          ev.stopPropagation();
          hotKeyHandlerMap[action as unknown as HotkeyActions]();
          break;
        }
      }
    },
    [hotKeyHandlerMap],
  );

  useEventListener('keydown', hotKeyListener, {
    capture: true,
  });
  return null;
}
