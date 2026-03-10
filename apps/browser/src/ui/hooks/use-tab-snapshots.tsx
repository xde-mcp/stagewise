import { createContext, useContext } from 'react';
import type { BrowserTabSnapshot } from '@shared/karton-contracts/ui/agent/metadata';

type TabSnapshotMap = Map<string, BrowserTabSnapshot>;

const TabSnapshotsContext = createContext<TabSnapshotMap | null>(null);

export const TabSnapshotsProvider = TabSnapshotsContext.Provider;

export function useTabSnapshots(): TabSnapshotMap | null {
  return useContext(TabSnapshotsContext);
}
