import { createContext, useContext } from 'react';

const MessageAccessPathContext = createContext<string | null>(null);

export const MessageAccessPathProvider = MessageAccessPathContext.Provider;

export function useMessageAccessPath(): string | null {
  return useContext(MessageAccessPathContext);
}
