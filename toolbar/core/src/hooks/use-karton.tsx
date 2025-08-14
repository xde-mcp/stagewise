import type { KartonContract } from '@stagewise/karton-contract';
import {
  createKartonReactClient,
  useComparingSelector,
} from '@stagewise/karton/react/client';

const [KartonProvider, useKartonState, useKartonProcedure, useKartonConnected] =
  createKartonReactClient<KartonContract>({
    webSocketPath: `${window.location.protocol}//${window.location.host}/stagewise-toolbar-app/karton`,
    procedures: {
      getAvailableTools: async () => [],
    },
    fallbackState: {
      chats: {},
      activeChatId: '',
      isWorking: false,
      toolCallApprovalRequests: [],
      creditsLeft: 0,
    },
  });

export {
  KartonProvider,
  useKartonState,
  useKartonProcedure,
  useKartonConnected,
  useComparingSelector,
};
