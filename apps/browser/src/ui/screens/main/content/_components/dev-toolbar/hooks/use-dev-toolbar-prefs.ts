import { useCallback, useEffect, useMemo, useRef } from 'react';
import { arrayMove } from '@dnd-kit/sortable';
import { useKartonState, useKartonProcedure } from '@/hooks/use-karton';
import {
  DEFAULT_WIDGET_ORDER,
  type WidgetId,
  type DevToolbarOriginSettings,
} from '@shared/karton-contracts/ui/shared-types';

/**
 * Merges stored widget order with defaults:
 * - Keeps existing widgets in user's order
 * - Adds new widgets at their default position
 * - Removes widgets that no longer exist
 */
function mergeWidgetOrder(storedOrder: WidgetId[]): WidgetId[] {
  const result: WidgetId[] = [];
  const storedSet = new Set(storedOrder);
  const defaultSet = new Set(DEFAULT_WIDGET_ORDER);

  // Keep existing widgets in user's order (if they still exist)
  for (const id of storedOrder) {
    if (defaultSet.has(id)) {
      result.push(id);
    }
  }

  // Add new widgets at their default position
  for (let i = 0; i < DEFAULT_WIDGET_ORDER.length; i++) {
    const id = DEFAULT_WIDGET_ORDER[i];
    if (!storedSet.has(id)) {
      // Find the position to insert: after the last existing item that comes before it in defaults
      let insertIndex = result.length;
      for (let j = i - 1; j >= 0; j--) {
        const prevInDefault = DEFAULT_WIDGET_ORDER[j];
        const prevIndex = result.indexOf(prevInDefault);
        if (prevIndex !== -1) {
          insertIndex = prevIndex + 1;
          break;
        }
      }
      result.splice(insertIndex, 0, id);
    }
  }

  return result;
}

/**
 * Extracts origin from a URL string.
 * Returns null if the URL is invalid or doesn't have a valid origin.
 */
function getOriginFromUrl(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    // Only return origin for http/https URLs
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.origin;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Hook for managing widget order with Karton persistence.
 * Handles merging with defaults for new/removed widgets.
 */
export function useWidgetOrder() {
  const storedOrder = useKartonState(
    (s) => s.preferences.devToolbar?.widgetOrder ?? DEFAULT_WIDGET_ORDER,
  );
  const updateWidgetOrder = useKartonProcedure(
    (p) => p.devToolbar.updateWidgetOrder,
  );

  // Merge stored order with defaults to handle new/removed widgets
  const order = useMemo(() => mergeWidgetOrder(storedOrder), [storedOrder]);

  const reorderWidgets = useCallback(
    (fromIndex: number, toIndex: number) => {
      const newOrder = arrayMove(order, fromIndex, toIndex);
      updateWidgetOrder(newOrder);
    },
    [order, updateWidgetOrder],
  );

  return {
    order,
    reorderWidgets,
  };
}

/**
 * Hook for managing per-origin dev toolbar settings.
 * Returns the settings for the current origin and a function to update them.
 */
export function useOriginSettings(tabUrl: string | undefined) {
  const origin = useMemo(() => getOriginFromUrl(tabUrl), [tabUrl]);

  const originSettings = useKartonState((s) =>
    origin ? s.preferences.devToolbar?.originSettings?.[origin] : undefined,
  );

  const updateOriginSettings = useKartonProcedure(
    (p) => p.devToolbar.updateOriginSettings,
  );
  const getOrCreateOriginSettings = useKartonProcedure(
    (p) => p.devToolbar.getOrCreateOriginSettings,
  );

  // Track if we've initialized this origin
  const initializedOriginRef = useRef<string | null>(null);

  // Initialize origin settings if needed
  useEffect(() => {
    if (origin && origin !== initializedOriginRef.current && !originSettings) {
      initializedOriginRef.current = origin;
      getOrCreateOriginSettings(origin).catch((err) => {
        console.error(
          '[useOriginSettings] Failed to get/create settings:',
          err,
        );
      });
    }
  }, [origin, originSettings, getOrCreateOriginSettings]);

  const updateSettings = useCallback(
    (settings: Partial<Omit<DevToolbarOriginSettings, 'lastAccessedAt'>>) => {
      if (!origin) return;
      updateOriginSettings(origin, settings).catch((err) => {
        console.error('[useOriginSettings] Failed to update settings:', err);
      });
    },
    [origin, updateOriginSettings],
  );

  return {
    origin,
    settings: originSettings,
    updateSettings,
  };
}

/**
 * Hook for managing a specific panel's open state and height.
 */
export function usePanelSettings(
  widgetId: WidgetId,
  tabUrl: string | undefined,
) {
  const { origin, settings, updateSettings } = useOriginSettings(tabUrl);

  const isOpen = settings?.panelOpenStates?.[widgetId] ?? false;

  const setOpen = useCallback(
    (open: boolean) => {
      if (!origin) return;
      updateSettings({
        panelOpenStates: { [widgetId]: open },
      });
    },
    [origin, widgetId, updateSettings],
  );

  return {
    isOpen,
    setOpen,
    hasOrigin: !!origin,
  };
}

/**
 * Hook for managing toolbar width per origin.
 */
export function useToolbarWidth(tabUrl: string | undefined) {
  const { origin, settings, updateSettings } = useOriginSettings(tabUrl);

  const width = settings?.toolbarWidth ?? null;

  const setWidth = useCallback(
    (newWidth: number | null) => {
      if (!origin) return;
      updateSettings({
        toolbarWidth: newWidth,
      });
    },
    [origin, updateSettings],
  );

  return {
    width,
    setWidth,
    hasOrigin: !!origin,
  };
}

/**
 * Hook that returns true if any panel is currently open.
 * Used to conditionally show the ResizableHandle.
 */
export function useHasOpenPanel(tabUrl: string | undefined) {
  const { settings } = useOriginSettings(tabUrl);

  const hasOpenPanel = useMemo(() => {
    if (!settings?.panelOpenStates) return false;
    return Object.values(settings.panelOpenStates).some((isOpen) => isOpen);
  }, [settings?.panelOpenStates]);

  return hasOpenPanel;
}
