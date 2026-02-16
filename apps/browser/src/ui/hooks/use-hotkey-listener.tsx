import { useCallback, useMemo } from 'react';
import { useEventListener } from './use-event-listener';
import {
  hotkeyDefinitions,
  getCurrentPlatform,
  isEventMatch,
  type HotkeyActions,
} from '@shared/hotkeys';
import { shouldNativeInputConsumeEvent } from '@shared/native-input-events';

export function useHotKeyListener(
  action: () => void,
  hotKeyAction: HotkeyActions,
) {
  const platform = useMemo(() => getCurrentPlatform(), []);
  const definition = hotkeyDefinitions[hotKeyAction];

  const hotKeyListener = useCallback(
    (ev: KeyboardEvent) => {
      // For non-dominant hotkeys, check if a native editable element should consume the event
      // This allows standard text editing behavior to work (e.g., Cmd+ArrowLeft in inputs)
      if (!definition.captureDominantly && shouldNativeInputConsumeEvent(ev))
        return;

      // The first matching hotkey action will be executed and abort further processing of other hotkey actions.
      if (isEventMatch(ev, definition, platform)) {
        action();
        ev.stopPropagation();
        ev.preventDefault();
      }
    },
    [action, platform, definition, hotKeyAction],
  );

  // Use capture phase for dominant hotkeys to ensure they work even when
  // focus is inside webcontents (e.g., BrowserView)
  const options = useMemo(
    () => (definition.captureDominantly ? { capture: true } : undefined),
    [definition.captureDominantly],
  );

  useEventListener('keydown', hotKeyListener, options);
}
