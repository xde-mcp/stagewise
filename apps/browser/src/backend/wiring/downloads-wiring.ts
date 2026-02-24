import { existsSync, unlinkSync } from 'node:fs';
import { shell } from 'electron';
import {
  DownloadState,
  type DownloadSpeedDataPoint,
} from '@shared/karton-contracts/pages-api/types';
import type { DownloadSummary } from '@shared/karton-contracts/ui';
import type { KartonService } from '../services/karton';
import type { DownloadsService } from '../services/download-manager';
import type { HistoryService } from '../services/history';
import type { PagesService } from '../services/pages';
import type { Logger } from '../services/logger';
import type { TelemetryService } from '../services/telemetry';

const MAX_DOWNLOADS_TO_SHOW = 5;

export function wireDownloads(deps: {
  uiKarton: KartonService;
  downloadsService: DownloadsService;
  historyService: HistoryService;
  pagesService: PagesService;
  logger: Logger;
  telemetryService: TelemetryService;
}): void {
  const {
    uiKarton,
    downloadsService,
    historyService,
    pagesService,
    logger,
    telemetryService,
  } = deps;

  let cachedFinishedDownloads: DownloadSummary[] = [];
  let finishedDownloadsDirty = true;
  let previousActiveCount = 0;

  const invalidateFinishedDownloadsCache = () => {
    finishedDownloadsDirty = true;
  };

  const updateUIDownloadsState = async (
    activeDownloads: {
      id: number;
      filename: string;
      progress: number;
      state: DownloadState;
      isPaused: boolean;
      targetPath: string;
      startTime: Date;
      currentSpeedKBps: number;
      speedHistory: DownloadSpeedDataPoint[];
    }[],
  ) => {
    const activeCount = activeDownloads.length;
    const finishedToFetch = Math.max(0, MAX_DOWNLOADS_TO_SHOW - activeCount);
    const lastSeenAt = downloadsService.getDownloadsLastSeenAt();

    const items: DownloadSummary[] = activeDownloads.map((d) => ({
      id: d.id,
      filename: d.filename,
      progress: d.progress,
      isActive: true,
      state: d.state,
      isPaused: d.isPaused,
      targetPath: d.targetPath,
      startTime: d.startTime,
      currentSpeedKBps: d.currentSpeedKBps,
      speedHistory: d.speedHistory,
    }));

    let hasUnseenDownloads = false;

    if (activeCount !== previousActiveCount) {
      finishedDownloadsDirty = true;
      previousActiveCount = activeCount;
    }

    if (finishedToFetch > 0 && finishedDownloadsDirty) {
      try {
        const allDownloads = await historyService.queryDownloads({
          limit: MAX_DOWNLOADS_TO_SHOW * 2,
        });

        const finishedDownloads = allDownloads.filter(
          (d) => d.state !== DownloadState.IN_PROGRESS,
        );

        cachedFinishedDownloads = finishedDownloads
          .slice(0, MAX_DOWNLOADS_TO_SHOW)
          .map((d) => {
            const parsedGuid = Number.parseInt(d.guid, 10);
            const downloadId = Number.isNaN(parsedGuid) ? d.id : parsedGuid;

            const progress =
              d.state === DownloadState.COMPLETE
                ? 100
                : d.totalBytes > 0
                  ? Math.round((d.receivedBytes / d.totalBytes) * 100)
                  : 0;

            return {
              id: downloadId,
              filename: d.targetPath
                ? (d.targetPath.split('/').pop() ?? 'Unknown')
                : 'Unknown',
              progress,
              isActive: false,
              state: d.state,
              targetPath: d.targetPath,
              startTime: d.startTime,
              endTime: d.endTime ?? undefined,
            };
          });

        finishedDownloadsDirty = false;
      } catch (err) {
        logger.warn(
          '[Downloads] Failed to fetch recent finished downloads',
          err,
        );
        telemetryService.captureException(err as Error, {
          service: 'main',
          operation: 'fetchFinishedDownloads',
        });
      }
    }

    if (finishedToFetch > 0) {
      for (const d of cachedFinishedDownloads.slice(0, finishedToFetch)) {
        if (items.some((item) => item.id === d.id)) continue;

        if (d.endTime && (!lastSeenAt || d.endTime > lastSeenAt)) {
          hasUnseenDownloads = true;
        }

        items.push(d);
      }
    }

    uiKarton.setState((draft) => {
      draft.downloads = {
        items,
        activeCount,
        hasUnseenDownloads,
        lastSeenAt,
      };
    });
  };

  downloadsService.setOnUIDownloadsChange(updateUIDownloadsState);

  const mapActiveDownloadsToUIFormat = () =>
    downloadsService.getActiveDownloads().map((d) => ({
      id: d.id,
      filename: d.filename,
      progress:
        d.totalBytes > 0
          ? Math.round((d.receivedBytes / d.totalBytes) * 100)
          : 0,
      state: d.state,
      isPaused: d.isPaused,
      targetPath: d.targetPath,
      startTime: d.startTime,
      currentSpeedKBps: d.currentSpeedKBps,
      speedHistory: d.speedHistory,
    }));

  const markDownloadsSeen = async () => {
    const now = new Date();
    await downloadsService.setDownloadsLastSeenAt(now);
    await updateUIDownloadsState(mapActiveDownloadsToUIFormat()).catch(
      (err) => {
        logger.warn(
          '[Downloads] Failed to update downloads state after marking seen',
          err,
        );
        telemetryService.captureException(err as Error, {
          service: 'main',
          operation: 'updateDownloadsAfterMarkSeen',
        });
      },
    );
  };

  // Register procedure handlers on UI Karton
  uiKarton.registerServerProcedureHandler(
    'downloads.markSeen',
    async (_callingClientId: string) => markDownloadsSeen(),
  );

  uiKarton.registerServerProcedureHandler(
    'downloads.pause',
    async (_callingClientId: string, downloadId: number) => {
      const paused = downloadsService.pauseDownload(downloadId);
      if (paused) {
        return { success: true };
      }
      return {
        success: false,
        error: 'Download not found or cannot be paused',
      };
    },
  );

  uiKarton.registerServerProcedureHandler(
    'downloads.resume',
    async (_callingClientId: string, downloadId: number) => {
      const resumed = downloadsService.resumeDownload(downloadId);
      if (resumed) {
        return { success: true };
      }
      return {
        success: false,
        error: 'Download not found or cannot be resumed',
      };
    },
  );

  uiKarton.registerServerProcedureHandler(
    'downloads.cancel',
    async (_callingClientId: string, downloadId: number) => {
      const cancelled = await downloadsService.cancelDownload(downloadId);
      if (cancelled) {
        return { success: true };
      }
      return { success: false, error: 'Download not found' };
    },
  );

  const isKnownDownloadPath = async (filePath: string): Promise<boolean> => {
    try {
      const downloads = await historyService.queryDownloads({ limit: 1000 });
      return downloads.some((d) => d.targetPath === filePath);
    } catch {
      return false;
    }
  };

  uiKarton.registerServerProcedureHandler(
    'downloads.openFile',
    async (_callingClientId: string, filePath: string) => {
      try {
        if (!filePath) {
          return { success: false, error: 'No file path provided' };
        }
        const isKnown = await isKnownDownloadPath(filePath);
        if (!isKnown) {
          logger.warn('[Downloads] Attempted to open unknown file path', {
            filePath,
          });
          return { success: false, error: 'File is not a known download' };
        }
        if (!existsSync(filePath)) {
          return { success: false, error: 'File not found' };
        }
        const errorMessage = await shell.openPath(filePath);
        if (errorMessage) {
          return { success: false, error: errorMessage };
        }
        return { success: true };
      } catch (error) {
        telemetryService.captureException(
          error instanceof Error ? error : new Error(String(error)),
          { service: 'main', operation: 'openDownloadFile' },
        );
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },
  );

  uiKarton.registerServerProcedureHandler(
    'downloads.showInFolder',
    async (_callingClientId: string, filePath: string) => {
      try {
        if (!filePath) {
          return { success: false, error: 'No file path provided' };
        }
        const isKnown = await isKnownDownloadPath(filePath);
        if (!isKnown) {
          logger.warn(
            '[Downloads] Attempted to show unknown file path in folder',
            { filePath },
          );
          return { success: false, error: 'File is not a known download' };
        }
        if (!existsSync(filePath)) {
          return { success: false, error: 'File not found' };
        }
        shell.showItemInFolder(filePath);
        return { success: true };
      } catch (error) {
        telemetryService.captureException(
          error instanceof Error ? error : new Error(String(error)),
          { service: 'main', operation: 'showDownloadInFolder' },
        );
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },
  );

  uiKarton.registerServerProcedureHandler(
    'downloads.delete',
    async (_callingClientId: string, downloadId: number) => {
      try {
        const activeDownload = downloadsService.getActiveDownload(downloadId);
        if (activeDownload) {
          await downloadsService.cancelDownload(downloadId);
        }

        const download = await historyService.getDownloadByGuid(
          `${downloadId}`,
        );
        const filePath = download?.targetPath;

        const deleted = await historyService.deleteDownloadByGuid(
          `${downloadId}`,
        );

        if (filePath && existsSync(filePath)) {
          try {
            unlinkSync(filePath);
          } catch (err) {
            logger.warn('[Downloads] Failed to delete download file', {
              filePath,
              error: err,
            });
          }
        }

        if (deleted) {
          invalidateFinishedDownloadsCache();
          await updateUIDownloadsState(mapActiveDownloadsToUIFormat());
          return { success: true };
        }
        return { success: false, error: 'Download not found' };
      } catch (error) {
        telemetryService.captureException(
          error instanceof Error ? error : new Error(String(error)),
          { service: 'main', operation: 'deleteDownload' },
        );
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },
  );

  // Wire the shared markDownloadsSeen handler to pages-api contract
  pagesService.setMarkDownloadsSeenHandler(markDownloadsSeen);

  // Trigger initial load of downloads state
  void updateUIDownloadsState([]);
}
