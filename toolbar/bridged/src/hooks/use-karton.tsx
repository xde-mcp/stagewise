import type { KartonContract } from '@stagewise/karton-contract-bridged';
import {
  createKartonReactClient,
  useComparingSelector,
} from '@stagewise/karton/react/client';

const [KartonProvider, useKartonState, useKartonProcedure, useKartonConnected] =
  createKartonReactClient<KartonContract>({
    webSocketPath: `${window.location.protocol}//${window.location.host}/stagewise-toolbar-app/karton`,
    procedures: {
      noop: async () => {},
    },
    fallbackState: {
      noop: false,
    },
  });

export {
  KartonProvider,
  useKartonState,
  useKartonProcedure,
  useKartonConnected,
  useComparingSelector,
};
