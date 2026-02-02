import { DisposableService } from '@/services/disposable';
import path from 'node:path';
import { drizzle, type LibSQLDatabase } from 'drizzle-orm/libsql';
import { type Client, createClient } from '@libsql/client';
import * as schema from './schema';
import chokidar, { type FSWatcher } from 'chokidar';
import type { Logger } from '@/services/logger';
import fs from 'node:fs/promises';
import type { KartonService } from '@/services/karton';
import type { GlobalDataPathService } from '@/services/global-data-path';
import type { FileDiff } from '@shared/karton-contracts/ui/shared-types';
import {
  getAllOperationsForAgentInstanceId,
  getPendingOperationsForAgentInstanceId,
  insertOperation,
  retrieveContentsForOids,
} from './utils/db';
import {
  acceptAndRejectHunks as acceptAndRejectHunksUtils,
  buildContributorMap,
  createFileDiffsFromGenerations,
  type OperationWithContent,
  segmentFileOperationsIntoGenerations,
} from './utils/diff';
import type { Operation } from './schema';
import type { OperationWithExternal } from './utils/db';

// GLOBAL!!!

export class DiffHistoryService extends DisposableService {
  private readonly logger: Logger;
  private readonly uiKarton: KartonService;
  private readonly globalDataPathsService: GlobalDataPathService;
  private watcher: FSWatcher | null = null;
  private filesLockedByAgent: Set<string> = new Set();
  private currentlyWatchedFiles: Set<string> = new Set();
  private dbDriver: Client;
  private db: LibSQLDatabase<typeof schema>;
  private activeAgentInstanceIds: string[];
  private editSummariesByAgentInstanceId: Map<string, FileDiff[]> = new Map();
  private pendingFileDiffsByAgentInstanceId: Map<string, FileDiff[]> =
    new Map();

  private constructor(
    logger: Logger,
    uiKarton: KartonService,
    globalDataPathService: GlobalDataPathService,
    activeAgentInstanceIds: string[],
  ) {
    super();
    this.logger = logger;
    this.uiKarton = uiKarton;
    this.globalDataPathsService = globalDataPathService;
    const dbPath = path.join(
      globalDataPathService.globalDataPath,
      'DiffHistory',
    );
    this.dbDriver = createClient({ url: `file:${dbPath}`, intMode: 'bigint' });
    this.db = drizzle(this.dbDriver, { schema });
    this.activeAgentInstanceIds = activeAgentInstanceIds;
  }

  public static async create(
    logger: Logger,
    uiKarton: KartonService,
    globalDataPathService: GlobalDataPathService,
    activeAgentInstanceIds: string[],
  ): Promise<DiffHistoryService> {
    const instance = new DiffHistoryService(
      logger,
      uiKarton,
      globalDataPathService,
      activeAgentInstanceIds,
    );
    await instance.initialize();
    logger.debug('[DiffHistoryService] Created service');
    return instance;
  }
  private async initialize(): Promise<void> {
    this.watcher = chokidar
      .watch([], {
        persistent: true,
        atomic: true,
        ignoreInitial: true,
      })
      .on('change', async (path) => {
        if (this.filesLockedByAgent.has(path)) return;

        try {
          const _fileContent = await fs.readFile(path, 'utf8');
          // TODO: Add user-edit to db
          //   this.pushSnapshot('USER_SAVE', newFiles, []);
        } catch (error) {
          this.logError(`[DiffHistory] Failed to read file: ${path}`, error);
          return;
        }
        this.logDebug(`File changed: ${path}`);
      })
      .on('unlink', (path) => {
        if (this.filesLockedByAgent.has(path)) return;
        // TODO: Add user-edit with snapshot_oid=null to db (deletion)
        this.logDebug(`File unlinked: ${path}`);
      })
      .on('add', (_path) => {
        // File is now being watched
      });
    for (const agentInstanceId of this.activeAgentInstanceIds) {
      try {
        const summary =
          await this.getEditSummaryForAgentInstanceId(agentInstanceId);
        this.editSummariesByAgentInstanceId.set(agentInstanceId, summary);
        const pendingDiffs =
          await this.getPendingFileDiffsForAgentInstanceId(agentInstanceId);
        this.pendingFileDiffsByAgentInstanceId.set(
          agentInstanceId,
          pendingDiffs,
        );
        pendingDiffs.forEach((diff) => {
          this.watcher?.add(diff.path);
        });
      } catch (error) {
        this.logError(
          `[DiffHistory] Failed to get edit summary for agent instance ${agentInstanceId}`,
          error,
        );
      }
    }
  }

  private async acceptAndRejectHunks(
    agentInstanceId: string, // Need to remove
    hunkIdsToAccept: string[],
    hunkIdsToReject: string[],
  ) {
    const pendingDiffs =
      this.pendingFileDiffsByAgentInstanceId.get(agentInstanceId);
    if (!pendingDiffs) return;

    const { result, failedAcceptedHunkIds, failedRejectedHunkIds } =
      acceptAndRejectHunksUtils(pendingDiffs, hunkIdsToAccept, hunkIdsToReject);
    for (const [filePath, fileResult] of Object.entries(result)) {
      if (fileResult.isExternal && fileResult.newBaselineOid !== undefined) {
        insertOperation(this.db, filePath, fileResult.newBaselineOid, {
          operation: 'baseline',
          contributor: 'user',
          reason: 'accept',
        });
      }
      if (!fileResult.isExternal && fileResult.newBaseline) {
      }
      if (fileResult.isExternal && fileResult.newCurrentOid !== undefined) {
      }
      if (!fileResult.isExternal && fileResult.newCurrent) {
      }
    }
  }

  private async restoreToolCallIds(
    _agentInstanceId: string,
    _toolCallIds: string[],
  ): Promise<void> {}

  private async getEditSummaryForAgentInstanceId(
    agentInstanceId: string,
  ): Promise<FileDiff[]> {
    const allops = await getAllOperationsForAgentInstanceId(
      this.db,
      agentInstanceId,
    );
    const fileDiffs = await this.getFileDiffForOperations(allops);
    return fileDiffs;
  }

  private async getPendingFileDiffsForAgentInstanceId(
    agentInstanceId: string,
  ): Promise<FileDiff[]> {
    const pendingOps = await getPendingOperationsForAgentInstanceId(
      this.db,
      agentInstanceId,
    );
    const fileDiffs = await this.getFileDiffForOperations(pendingOps);
    return fileDiffs;
  }

  private async getFileDiffForOperations(
    operations: OperationWithExternal[],
  ): Promise<FileDiff[]> {
    const nonExternalOps = operations.filter((op) => !op.isExternal);
    const externalOps = operations
      .filter((op) => op.isExternal)
      .map((op) => ({
        ...op,
        snapshot_content: null,
      }));
    const nonExternalOpsWithContent =
      await this.getOperationsWithContent(nonExternalOps);
    const mergedOps = [...nonExternalOpsWithContent, ...externalOps].sort(
      (a, b) => a.idx - b.idx,
    );
    const generations = segmentFileOperationsIntoGenerations(mergedOps);
    const contributorMap = buildContributorMap(generations);
    const fileDiffs = createFileDiffsFromGenerations(
      generations,
      contributorMap,
    );
    return fileDiffs;
  }

  private async getOperationsWithContent(
    operations: Operation[],
  ): Promise<OperationWithContent[]> {
    const oids = operations.map((op) => op.snapshot_oid);
    const contents = await retrieveContentsForOids(this.db, oids);
    const stringContents = new Map<string, string>();
    for (const [oid, content] of contents.entries())
      stringContents.set(oid, content.toString('utf-8'));

    const o: OperationWithContent[] = [];
    for (const op of operations) {
      o.push({
        ...op,
        snapshot_content: stringContents.get(op.snapshot_oid ?? ''),
      } as OperationWithContent);
    }
    return o;
  }

  protected onTeardown(): Promise<void> | void {}

  public unlockFileForAgent(path: string): void {
    this.filesLockedByAgent.delete(path);
  }

  private logError(error: string, e: unknown) {
    this.logger.error(`[DiffHistory] ${error}`, e);
  }
  private logDebug(debug: string) {
    this.logger.debug(`[DiffHistory] ${debug}`);
  }
  private logInfo(info: string) {
    this.logger.info(`[DiffHistory] ${info}`);
  }
}
