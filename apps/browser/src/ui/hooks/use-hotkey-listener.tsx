import { useCallback, useMemo } from 'react';
import { useEventListener } from './use-event-listener';
import {
  hotkeyDefinitions,
  getCurrentPlatform,
  isEventMatch,
  type HotkeyActions,
} from '@shared/hotkeys';
import { usePostHog } from 'posthog-js/react';

export function useHotKeyListener(
  action: () => void,
  hotKeyAction: HotkeyActions,
) {
  const posthog = usePostHog();
  const platform = useMemo(() => getCurrentPlatform(), []);
  const definition = hotkeyDefinitions[hotKeyAction];

  const hotKeyListener = useCallback(
    (ev: KeyboardEvent) => {
      // The first matching hotkey action will be executed and abort further processing of other hotkey actions.
      if (isEventMatch(ev, definition, platform)) {
        posthog.capture('agent_select_elements_hotkey_pressed', {
          hotkey_action: hotKeyAction,
        });

        action();
        ev.stopPropagation();
        ev.preventDefault();
      }
    },
    [action, platform, definition, hotKeyAction, posthog],
  );

  // Use capture phase for dominant hotkeys to ensure they work even when
  // focus is inside webcontents (e.g., BrowserView)
  const options = useMemo(
    () => (definition.captureDominantly ? { capture: true } : undefined),
    [definition.captureDominantly],
  );

  useEventListener('keydown', hotKeyListener, options);
}
