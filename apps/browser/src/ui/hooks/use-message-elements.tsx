import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { SelectedElement } from '@shared/selected-elements';

/**
 * Context for providing selected elements within a message scope.
 * This allows child components (like InlineAttachmentBadge) to access
 * the message's selected elements without prop drilling.
 *
 * In view mode, elements come from message metadata (selectedPreviewElements).
 * In edit mode, elements come from local state + Karton state.
 */

interface MessageElementsContext {
  /** Selected elements available in this message's scope */
  elements: SelectedElement[];
}

const MessageElementsContext = createContext<MessageElementsContext>({
  elements: [],
});

interface MessageElementsProviderProps {
  children: ReactNode;
  /** Elements to provide to children */
  elements: SelectedElement[];
}

export function MessageElementsProvider({
  children,
  elements,
}: MessageElementsProviderProps) {
  const value = useMemo(() => ({ elements }), [elements]);

  return (
    <MessageElementsContext.Provider value={value}>
      {children}
    </MessageElementsContext.Provider>
  );
}

/**
 * Hook to access the selected elements in the current message scope.
 * Returns an empty array if used outside of a MessageElementsProvider.
 */
export function useMessageElements() {
  return useContext(MessageElementsContext);
}
