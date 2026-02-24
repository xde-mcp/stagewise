import { DisposableService } from '@/services/disposable';
import type { Logger } from '@/services/logger';
import { ClientRuntimeNode } from '@stagewise/agent-runtime-node';
import { LspService } from '../lsp';
import path from 'node:path';
import { createHash } from 'node:crypto';
import type { FilePickerService } from '@/services/file-picker';
import type { GlobalDataPathService } from '@/services/global-data-path';
import type { KartonService } from '@/services/karton';
import type { UserExperienceService } from '@/services/experience';
import type { TelemetryService } from '@/services/telemetry';
import type { WorkspaceSnapshot } from '../../types';
import { readWorkspaceMd } from '@/agents/shared/prompts/utils/read-workspace-md';
import { readAgentsMd } from '@/agents/shared/prompts/utils/read-agents-md';
import { getSkills } from '@/agents/shared/prompts/utils/get-skills';
import { isGitRepo } from '@/utils/git-tools';

type AgentInstanceId = string;
type MountPrefix = string;
type WorkspacePath = string;

function mountPrefixForPath(workspacePath: string): MountPrefix {
  const hash = createHash('sha256')
    .update(workspacePath)
    .digest('hex')
    .slice(0, 4);
  return `w${hash}`;
}

export type MountedClientRuntimes = Map<MountPrefix, ClientRuntimeNode>;
export type MountedLspServices = Map<MountPrefix, LspService>;

export class MountManagerService extends DisposableService {
  private readonly logger: Logger;
  private readonly filePickerService: FilePickerService;
  private readonly globalDataPathService: GlobalDataPathService;
  private readonly userExperienceService: UserExperienceService;
  private readonly uiKarton: KartonService;
  private readonly telemetryService: TelemetryService;
  private onMountsChanged?: (agentInstanceId: string) => void;

  private agentMounts: Map<AgentInstanceId, Set<MountPrefix>> = new Map();
  private workspacePathsPerMount: Map<MountPrefix, WorkspacePath> = new Map();

  private clientRuntimesPerPath: Map<string, ClientRuntimeNode> = new Map();
  private lspServicesPerPath: Map<string, LspService> = new Map();

  /** Promise that resolves when LSP service is ready (or null if no workspace) */
  private lspReady: Map<string, Promise<LspService | null>> = new Map();

  public constructor(
    logger: Logger,
    filePickerService: FilePickerService,
    globalDataPathService: GlobalDataPathService,
    userExperienceService: UserExperienceService,
    uiKarton: KartonService,
    telemetryService: TelemetryService,
  ) {
    super();
    this.logger = logger;
    this.filePickerService = filePickerService;
    this.globalDataPathService = globalDataPathService;
    this.userExperienceService = userExperienceService;
    this.uiKarton = uiKarton;
    this.telemetryService = telemetryService;
  }

  public static async create(
    logger: Logger,
    filePickerService: FilePickerService,
    globalDataPathService: GlobalDataPathService,
    userExperienceService: UserExperienceService,
    uiKarton: KartonService,
    telemetryService: TelemetryService,
  ): Promise<MountManagerService> {
    const instance = new MountManagerService(
      logger,
      filePickerService,
      globalDataPathService,
      userExperienceService,
      uiKarton,
      telemetryService,
    );
    await instance.initialize();
    return instance;
  }

  public setOnMountsChanged(cb: (agentInstanceId: string) => void) {
    this.onMountsChanged = cb;
  }

  private async initialize(): Promise<void> {
    this.uiKarton.registerServerProcedureHandler(
      'toolbox.mountWorkspace',
      async (
        _callingClientId: string,
        agentInstanceId: string,
        workspacePath?: string,
      ) => {
        await this.handleMountWorkspace(agentInstanceId, workspacePath);
      },
    );

    this.uiKarton.registerServerProcedureHandler(
      'toolbox.unmountWorkspace',
      async (
        _callingClientId: string,
        agentInstanceId: string,
        mountPrefix: string,
      ) => {
        await this.handleUnmountWorkspace(agentInstanceId, mountPrefix);
      },
    );
  }

  public async handleMountWorkspace(
    agentInstanceId: string,
    workspacePath?: string,
  ): Promise<void> {
    let resolvedWorkspacePath: string | undefined;
    if (!workspacePath) {
      const filePickerResponses = await this.filePickerService.createRequest({
        title: 'Select a workspace',
        description: 'Select a workspace to load',
        type: 'directory',
        multiple: false,
      });
      if (filePickerResponses.length === 0) return;
      resolvedWorkspacePath = filePickerResponses[0];
    } else {
      resolvedWorkspacePath = workspacePath;
    }
    if (!resolvedWorkspacePath) return;

    if (!this.clientRuntimesPerPath.has(resolvedWorkspacePath)) {
      this.clientRuntimesPerPath.set(
        resolvedWorkspacePath,
        new ClientRuntimeNode({
          workingDirectory: resolvedWorkspacePath,
          rgBinaryBasePath: this.globalDataPathService.globalDataPath,
        }),
      );
      const lspPromise = LspService.create(
        this.logger,
        this.clientRuntimesPerPath.get(resolvedWorkspacePath)!,
      );
      this.lspReady.set(resolvedWorkspacePath, lspPromise);
      const lspService = await lspPromise;
      this.lspServicesPerPath.set(resolvedWorkspacePath, lspService);
    }

    await this.userExperienceService.saveRecentlyOpenedWorkspace({
      path: resolvedWorkspacePath,
      name: path.basename(resolvedWorkspacePath),
      openedAt: Date.now(),
    });

    if (!this.uiKarton.state.toolbox[agentInstanceId]) {
      this.uiKarton.setState((draft) => {
        draft.toolbox[agentInstanceId] = {
          workspace: { mounts: [] },
          pendingFileDiffs: [],
          editSummary: [],
        };
      });
    }

    const mounts = this.agentMounts.get(agentInstanceId) ?? new Set();
    const alreadyMounted = [...mounts].some(
      (prefix) =>
        this.workspacePathsPerMount.get(prefix) === resolvedWorkspacePath,
    );
    if (alreadyMounted) return;

    const prefix = mountPrefixForPath(resolvedWorkspacePath);
    mounts.add(prefix);
    this.agentMounts.set(agentInstanceId, mounts);
    this.workspacePathsPerMount.set(prefix, resolvedWorkspacePath);

    const clientRuntime = this.clientRuntimesPerPath.get(
      resolvedWorkspacePath,
    )!;

    const [workspaceMdContent, agentsMdContent, skills] = await Promise.all([
      readWorkspaceMd(resolvedWorkspacePath),
      readAgentsMd(clientRuntime),
      getSkills(clientRuntime),
    ]);
    const gitRepo = isGitRepo(resolvedWorkspacePath);

    this.uiKarton.setState((draft) => {
      draft.toolbox[agentInstanceId].workspace.mounts.push({
        prefix,
        path: resolvedWorkspacePath,
        hasWorkspaceMd: workspaceMdContent !== null,
        hasAgentsMd: agentsMdContent !== null,
        isGitRepo: gitRepo,
        skills: skills.map((s) => ({
          name: s.name,
          description: s.description,
        })),
      });
    });

    this.onMountsChanged?.(agentInstanceId);
  }

  public async handleUnmountWorkspace(
    agentInstanceId: string,
    mountPrefix: string,
  ): Promise<void> {
    const mounts = this.agentMounts.get(agentInstanceId);
    if (!mounts || !mounts.has(mountPrefix)) return;

    const workspacePath = this.workspacePathsPerMount.get(mountPrefix);
    mounts.delete(mountPrefix);
    this.workspacePathsPerMount.delete(mountPrefix);

    if (workspacePath) {
      const stillInUse = [...this.workspacePathsPerMount.values()].includes(
        workspacePath,
      );
      if (!stillInUse) {
        const lspService = this.lspServicesPerPath.get(workspacePath);
        if (lspService) void lspService.teardown();
        this.clientRuntimesPerPath.delete(workspacePath);
        this.lspServicesPerPath.delete(workspacePath);
        this.lspReady.delete(workspacePath);
      }
    }

    this.uiKarton.setState((draft) => {
      draft.toolbox[agentInstanceId].workspace.mounts = draft.toolbox[
        agentInstanceId
      ].workspace.mounts.filter((m) => m.prefix !== mountPrefix);
    });

    this.onMountsChanged?.(agentInstanceId);
  }

  public getMountedPathsWithRuntimes(agentInstanceId: string): Array<{
    prefix: string;
    path: string;
    clientRuntime: ClientRuntimeNode;
  }> {
    const mounts = this.agentMounts.get(agentInstanceId);
    if (!mounts) return [];
    const result: Array<{
      prefix: string;
      path: string;
      clientRuntime: ClientRuntimeNode;
    }> = [];
    for (const prefix of mounts) {
      const wsPath = this.workspacePathsPerMount.get(prefix);
      const rt = wsPath ? this.clientRuntimesPerPath.get(wsPath) : undefined;
      if (wsPath && rt) {
        result.push({ prefix, path: wsPath, clientRuntime: rt });
      }
    }
    return result;
  }

  public findWorkspaceForFile(
    agentInstanceId: string,
    filePath: string,
  ): string | undefined {
    const mounts = this.agentMounts.get(agentInstanceId);
    if (!mounts) return undefined;
    for (const prefix of mounts) {
      const wsPath = this.workspacePathsPerMount.get(prefix);
      if (wsPath && filePath.startsWith(wsPath)) return wsPath;
    }
    return undefined;
  }

  public getAllMountedPaths(): Set<string> {
    return new Set(this.workspacePathsPerMount.values());
  }

  public getMountedRuntimes(agentInstanceId: string): MountedClientRuntimes {
    const mounts = this.agentMounts.get(agentInstanceId);
    const result: MountedClientRuntimes = new Map();
    for (const prefix of mounts ?? []) {
      const wsPath = this.workspacePathsPerMount.get(prefix);
      if (!wsPath) continue;
      const rt = this.clientRuntimesPerPath.get(wsPath);
      if (rt) result.set(prefix, rt);
    }
    return result;
  }

  public getMountedLspServices(agentInstanceId: string): MountedLspServices {
    const mounts = this.agentMounts.get(agentInstanceId);
    const result: MountedLspServices = new Map();
    for (const prefix of mounts ?? []) {
      const wsPath = this.workspacePathsPerMount.get(prefix);
      if (!wsPath) continue;
      const lsp = this.lspServicesPerPath.get(wsPath);
      if (lsp) result.set(prefix, lsp);
    }
    return result;
  }

  public clearAgentMounts(agentInstanceId: string): void {
    this.agentMounts.delete(agentInstanceId);
  }

  public setWorkspaceMdExistsByPath(
    workspacePath: string,
    exists: boolean,
  ): void {
    this.uiKarton.setState((draft) => {
      for (const agentId in draft.toolbox) {
        const mounts = draft.toolbox[agentId].workspace.mounts;
        for (const mount of mounts) {
          if (mount.path === workspacePath) {
            mount.hasWorkspaceMd = exists;
          }
        }
      }
    });
  }

  public getClientRuntimeForPath(
    wsPath: string,
  ): ClientRuntimeNode | undefined {
    return this.clientRuntimesPerPath.get(wsPath);
  }

  public getWorkspaceSnapshot(agentInstanceId: string): WorkspaceSnapshot {
    const mounts = this.agentMounts.get(agentInstanceId);
    if (!mounts || mounts.size === 0) return { mounts: [] };

    return {
      mounts: [...mounts]
        .map((prefix) => ({
          prefix,
          path: this.workspacePathsPerMount.get(prefix) ?? '',
        }))
        .filter((m) => m.path !== ''),
    };
  }

  /**
   * Update a file's content in all applicable LSP servers.
   * Call this after a file is modified by a tool.
   * Waits for LSP service to be ready before syncing.
   */
  public async syncFileWithLsp(
    agentInstanceId: string,
    filePath: string,
    content: string,
  ): Promise<void> {
    const wsPath = this.findWorkspaceForFile(agentInstanceId, filePath);
    if (!wsPath) throw new Error('No workspace connected');
    const lsp = await this.lspReady.get(wsPath);
    if (!lsp) return;

    try {
      await lsp.touchFile(filePath);
      await lsp.updateFile(filePath, content);
    } catch (err) {
      this.logger.debug('[MountManager] Failed to sync file with LSP', {
        error: err,
        path: filePath,
      });
      this.report(err as Error, 'syncFileWithLsp', { path: filePath });
    }
  }

  /**
   * Close a file in all applicable LSP servers.
   * Call this after a file is deleted by a tool.
   * Waits for LSP service to be ready before closing.
   */
  public async syncFileCloseWithLsp(
    agentInstanceId: string,
    filePath: string,
  ): Promise<void> {
    const wsPath = this.findWorkspaceForFile(agentInstanceId, filePath);
    if (!wsPath) throw new Error('No workspace connected');
    const lsp = await this.lspReady.get(wsPath);
    if (!lsp) return;
    try {
      await lsp.closeFile(filePath);
    } catch (err) {
      this.logger.debug('[MountManager] Failed to close file in LSP', {
        error: err,
        path: filePath,
      });
      this.report(err as Error, 'syncFileCloseWithLsp', {
        path: filePath,
      });
    }
  }

  private report(
    error: Error,
    operation: string,
    extra?: Record<string, unknown>,
  ): void {
    this.telemetryService.captureException(error, {
      service: 'mount-manager',
      operation,
      ...extra,
    });
  }

  protected onTeardown(): Promise<void> | void {
    for (const lspService of this.lspServicesPerPath.values())
      void lspService.teardown();
    this.lspServicesPerPath.clear();
    this.clientRuntimesPerPath.clear();
    this.uiKarton.removeServerProcedureHandler('toolbox.mountWorkspace');
    this.uiKarton.removeServerProcedureHandler('toolbox.unmountWorkspace');
    return Promise.resolve();
  }
}
