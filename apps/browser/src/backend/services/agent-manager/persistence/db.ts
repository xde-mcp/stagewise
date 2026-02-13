import { drizzle } from 'drizzle-orm/libsql/driver';
import * as schema from './schema';
import { and, notInArray, ilike, desc, isNull, eq, sql } from 'drizzle-orm';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import { createClient, type Client } from '@libsql/client';
import path from 'node:path';
import type { GlobalDataPathService } from '@/services/global-data-path';
import { migrateDatabase } from '@/utils/migrate-database';
import initSql from './schema.sql?raw';
import { registry, schemaVersion } from './migrations';
import type { Logger } from '@/services/logger';
import {
  AgentTypes,
  type AgentHistoryEntry,
} from '@shared/karton-contracts/ui/agent';

export class AgentPersistenceDB {
  private _dbDriver: Client;
  private _db: LibSQLDatabase<typeof schema>;
  private _globalDataPathService: GlobalDataPathService;
  private _logger: Logger;

  private constructor(
    globalDataPathService: GlobalDataPathService,
    logger: Logger,
  ) {
    const dbPath = path.join(globalDataPathService.globalDataPath, 'Agents');
    logger.debug(
      `[AgentPersistenceDB] Creating agent persistence DB at path: ${dbPath}`,
    );
    this._dbDriver = createClient({ url: `file:${dbPath}` });
    this._db = drizzle(this._dbDriver, { schema });
    this._globalDataPathService = globalDataPathService;
    this._logger = logger;
  }

  public get db(): LibSQLDatabase<typeof schema> {
    return this._db;
  }

  public static async create(
    globalDataPathService: GlobalDataPathService,
    logger: Logger,
  ): Promise<AgentPersistenceDB | null> {
    const instance = new AgentPersistenceDB(globalDataPathService, logger);

    try {
      logger.debug(`[AgentPersistenceDB] Migrating database...`);
      await migrateDatabase({
        db: instance._db,
        client: instance._dbDriver,
        registry,
        initSql,
        schemaVersion,
      });
      logger.debug(`[AgentPersistenceDB] Database migrated successfully`);
    } catch (e) {
      const err: Error = e as Error;
      logger.error(
        `[AgentPersistenceDB] Failed to initialize. Error: ${err.message}, Stack: ${err.stack}`,
      );
      return null;
    }
    return instance;
  }

  // To prevent fetching already active agents as well, you can

  /**
   *
   * @param limit The number of agents to fetch
   * @param offset The offset to fetch the agents from
   * @param excludeIds The ids of the agents to exclude from the fetch
   * @param titleLike The title to filter the agents by (optional, case-insensitive)
   *
   * @note This method will not fetch any agents that have a parent agent instance.
   *
   * @returns The stored agent instances
   */
  public async getAgentHistoryEntries(
    limit: number,
    offset: number,
    excludeIds: string[],
    titleLike?: string,
  ): Promise<AgentHistoryEntry[]> {
    const results = await this._db
      .select({
        id: schema.agentInstances.id,
        title: schema.agentInstances.title,
        createdAt: schema.agentInstances.createdAt,
        lastMessageAt: schema.agentInstances.lastMessageAt,
        messageCount: sql<number>`json_array_length(${schema.agentInstances.history})`,
        parentAgentInstanceId: schema.agentInstances.parentAgentInstanceId,
      })
      .from(schema.agentInstances)
      .orderBy(desc(schema.agentInstances.createdAt))
      .limit(limit)
      .offset(offset)
      .where(
        and(
          notInArray(schema.agentInstances.id, excludeIds),
          isNull(schema.agentInstances.parentAgentInstanceId),
          eq(schema.agentInstances.type, AgentTypes.CHAT),
          titleLike ? ilike(schema.agentInstances.title, titleLike) : undefined,
        ),
      );

    this._logger.debug(`[AgentPersistenceDB] Fetched agent history entries`);

    return results;
  }

  /**
   *
   * @param limit The number of agents to fetch
   * @param offset The offset to fetch the agents from
   * @param excludeIds The ids of the agents to exclude from the fetch
   * @param titleLike The title to filter the agents by (optional, case-insensitive)
   *
   * @note This method will not fetch any agents that have a parent agent instance.
   *
   * @returns The stored agent instances
   */
  public async getStoredAgentInstanceById(
    id: string,
  ): Promise<schema.StoredAgentInstance | null> {
    this._logger.debug(`[AgentPersistenceDB] Fetching agent instance: ${id}`);
    const results = await this._db
      .selectDistinct()
      .from(schema.agentInstances)
      .where(eq(schema.agentInstances.id, id))
      .limit(1)
      .catch((error) => {
        this._logger.error(
          `[AgentPersistenceDB] Failed to fetch agent instance: ${error}`,
        );
        return null;
      });

    return results?.[0] ?? null;
  }

  /**
   * Stores or updates an agent instance in the persistence layer.
   *
   * @param agentInstance The agent instance to store
   */
  public async storeAgentInstance(
    agentInstance: schema.NewStoredAgentInstance,
  ): Promise<void> {
    this._logger.debug(
      `[AgentPersistenceDB] Storing agent instance: ${agentInstance.id}`,
    );
    await this._db
      .insert(schema.agentInstances)
      .values(agentInstance)
      .onConflictDoUpdate({
        target: schema.agentInstances.id,
        set: {
          ...agentInstance,
        },
      })
      .catch((error) => {
        this._logger.error(
          `[AgentPersistenceDB] Failed to store agent instance: ${error.message}, ${error.stack}`,
        );
      });
  }

  /**
   * Returns the activeModelId of the most recently persisted chat agent,
   * or null if no chat agents exist.
   */
  public async getLastChatModelId(): Promise<
    schema.StoredAgentInstance['activeModelId'] | null
  > {
    const results = await this._db
      .select({ activeModelId: schema.agentInstances.activeModelId })
      .from(schema.agentInstances)
      .where(
        and(
          isNull(schema.agentInstances.parentAgentInstanceId),
          eq(schema.agentInstances.type, AgentTypes.CHAT),
        ),
      )
      .orderBy(desc(schema.agentInstances.lastMessageAt))
      .limit(1)
      .catch((error) => {
        this._logger.error(
          `[AgentPersistenceDB] Failed to fetch last chat model id: ${error}`,
        );
        return null;
      });

    return results?.[0]?.activeModelId ?? null;
  }

  /**
   * Deletes an agent instance from the persistence layer.
   *
   * @param id The id of the agent instance to delete
   */
  public async deleteAgentInstance(id: string): Promise<void> {
    this._logger.debug(`[AgentPersistenceDB] Deleting agent instance: ${id}`);
    // We should also delete all persisted child agents as well (do it recursively to catch all agents)
    const childAgentInstanceIds = await this._db
      .select({ id: schema.agentInstances.id })
      .from(schema.agentInstances)
      .where(eq(schema.agentInstances.parentAgentInstanceId, id));
    for (const childAgentInstanceId of childAgentInstanceIds) {
      await this.deleteAgentInstance(childAgentInstanceId.id);
    }

    await this._db
      .delete(schema.agentInstances)
      .where(eq(schema.agentInstances.id, id))
      .catch((error) => {
        this._logger.error(
          `[AgentPersistenceDB] Failed to delete agent instance: ${error}`,
        );
      });
  }
}
