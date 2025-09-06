export type KartonContract = {
  state: {
    noop: boolean;
  };
  clientProcedures: {
    noop: () => Promise<void>;
  };
  serverProcedures: {
    trackCopyToClipboard: () => Promise<void>;
  };
};
