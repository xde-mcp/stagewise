import {
  createContext,
  useContext,
  useRef,
  useCallback,
  useMemo,
  useState,
  type ReactNode,
  type RefObject,
  type MutableRefObject,
} from 'react';
import type {
  AccessHandle,
  AccessHandleId,
  OverlayEvent,
  Registration,
  RequestAccessOptions,
  WebContentsOverlayEventType,
} from './types';

let handleIdCounter = 0;
function generateHandleId(): AccessHandleId {
  return `overlay-handle-${++handleIdCounter}`;
}

/**
 * Context value for the web contents overlay
 */
export interface WebContentsOverlayContextValue {
  /** Reference to the overlay DOM element */
  overlayRef: RefObject<HTMLDivElement | null>;

  /** Request access to the overlay. Returns null if access cannot be granted. */
  requestAccess: (options: RequestAccessOptions) => AccessHandle | null;

  /** Release a previously granted access handle */
  releaseAccess: (handle: AccessHandle) => void;

  /** True if non-exclusive access can be granted (no exclusive holder) */
  canGetAccess: boolean;

  /** True if exclusive access can be granted (no registrations at all) */
  canGetExclusiveAccess: boolean;

  /** Internal: registrations ref for the overlay component to dispatch events */
  _registrationsRef: MutableRefObject<Registration[]>;

  /** Internal: force update function to re-render on registration changes */
  _forceUpdate: () => void;
}

const WebContentsOverlayContext =
  createContext<WebContentsOverlayContextValue | null>(null);

interface WebContentsOverlayProviderProps {
  children: ReactNode;
}

/**
 * Provider component for the web contents overlay context.
 * This should wrap the area that contains both the overlay and components that need access.
 */
export function WebContentsOverlayProvider({
  children,
}: WebContentsOverlayProviderProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const registrationsRef = useRef<Registration[]>([]);

  // State to trigger re-renders when registrations change
  const [, setUpdateTrigger] = useState(0);
  const forceUpdate = useCallback(() => setUpdateTrigger((n) => n + 1), []);

  const requestAccess = useCallback(
    (options: RequestAccessOptions): AccessHandle | null => {
      const { exclusive = false, cursor, handlers } = options;
      const registrations = registrationsRef.current;

      // Check access rules
      const hasExclusive = registrations.some((r) => r.isExclusive);
      const hasAny = registrations.length > 0;

      // Exclusive requested: fail if any registration exists
      if (exclusive && hasAny) {
        return null;
      }

      // Non-exclusive requested: fail if exclusive exists
      if (!exclusive && hasExclusive) {
        return null;
      }

      // Access granted - create registration
      const id = generateHandleId();
      const registration: Registration = {
        id,
        isExclusive: exclusive,
        cursor,
        handlers,
      };

      registrationsRef.current = [...registrations, registration];
      forceUpdate();

      const release = () => {
        registrationsRef.current = registrationsRef.current.filter(
          (r) => r.id !== id,
        );
        forceUpdate();
      };

      return {
        id,
        isExclusive: exclusive,
        release,
      };
    },
    [forceUpdate],
  );

  const releaseAccess = useCallback(
    (handle: AccessHandle) => {
      registrationsRef.current = registrationsRef.current.filter(
        (r) => r.id !== handle.id,
      );
      forceUpdate();
    },
    [forceUpdate],
  );

  // Derived state for access availability
  const registrations = registrationsRef.current;
  const hasExclusive = registrations.some((r) => r.isExclusive);
  const hasAny = registrations.length > 0;
  const canGetAccess = !hasExclusive;
  const canGetExclusiveAccess = !hasAny;

  const value = useMemo<WebContentsOverlayContextValue>(
    () => ({
      overlayRef,
      requestAccess,
      releaseAccess,
      canGetAccess,
      canGetExclusiveAccess,
      _registrationsRef: registrationsRef,
      _forceUpdate: forceUpdate,
    }),
    [
      requestAccess,
      releaseAccess,
      canGetAccess,
      canGetExclusiveAccess,
      forceUpdate,
    ],
  );

  return (
    <WebContentsOverlayContext.Provider value={value}>
      {children}
    </WebContentsOverlayContext.Provider>
  );
}

/**
 * Hook to access the web contents overlay context.
 * Must be used within a WebContentsOverlayProvider.
 */
export function useWebContentsOverlay(): WebContentsOverlayContextValue {
  const context = useContext(WebContentsOverlayContext);
  if (!context) {
    throw new Error(
      'useWebContentsOverlay must be used within a WebContentsOverlayProvider',
    );
  }
  return context;
}

/**
 * Dispatch an event to all registered handlers in LIFO order.
 * Respects stopPropagation.
 */
export function dispatchOverlayEvent(
  registrations: Registration[],
  eventType: WebContentsOverlayEventType,
  originalEvent: OverlayEvent['originalEvent'],
): void {
  // Create overlay event wrapper
  let propagationStopped = false;
  const overlayEvent: OverlayEvent = {
    originalEvent,
    propagationStopped: false,
    stopPropagation: () => {
      propagationStopped = true;
      overlayEvent.propagationStopped = true;
    },
  };

  // Dispatch in LIFO order (last registered first)
  const reversed = [...registrations].reverse();
  for (const registration of reversed) {
    if (propagationStopped) break;

    const handler = registration.handlers[eventType];
    if (handler) {
      handler(overlayEvent);
    }
  }
}
