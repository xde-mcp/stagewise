import { createHash, randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { rename, mkdir } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import * as path from 'node:path';
import type { OperationMeta, Operation } from '../schema';
import { eq, and, desc, or, gte, sql, inArray } from 'drizzle-orm';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import * as zstd from '@bokuweb/zstd-wasm';
import * as fossilDelta from 'fossil-delta';
import * as schema from '../schema';
import type { ToolCallId, ChatId } from '../schema';

type SnapshotDb = LibSQLDatabase<typeof schema>;

/**
 * Operation type extended with isExternal flag from joined snapshot.
 * Used when queries join operations with snapshots to include LFS status.
 */
export type OperationWithExternal = Operation & { isExternal: boolean };

let zstdInitialized = false;

/**
 * Initialize zstd-wasm. Must be called once before using compression functions.
 */
export async function initCompression(): Promise<void> {
  if (!zstdInitialized) {
    await zstd.init();
    zstdInitialized = true;
  }
}

/**
 * Compute SHA-256 hash of content, returning hex string.
 */
export function computeOid(content: Buffer): string {
  return createHash('sha256').update(content).digest('hex');
}

/**
 * Get a snapshot by oid.
 */
export async function getSnapshot(
  db: SnapshotDb,
  oid: string,
): Promise<{
  oid: string;
  payload: Buffer;
  delta_target_oid: string | null;
  is_external: boolean;
} | null> {
  const row = await db
    .select()
    .from(schema.snapshots)
    .where(eq(schema.snapshots.oid, oid))
    .get();

  if (!row) return null;

  return {
    oid: row.oid,
    payload: row.payload as Buffer,
    delta_target_oid: row.delta_target_oid,
    is_external: row.is_external,
  };
}

/**
 * Check if a snapshot exists.
 */
export async function snapshotExists(
  db: SnapshotDb,
  oid: string,
): Promise<boolean> {
  const s = await getSnapshot(db, oid);
  return s !== null;
}

/**
 * Insert a keyframe snapshot (full compressed blob).
 * For external (LFS) snapshots, pass isExternal=true and an empty buffer for content.
 */
export function insertKeyframe(
  db: SnapshotDb,
  oid: string,
  content: Buffer,
  isExternal = false,
): void {
  const payload = isExternal
    ? Buffer.alloc(0)
    : Buffer.from(zstd.compress(content, 3));

  db.insert(schema.snapshots)
    .values({
      oid,
      payload,
      delta_target_oid: null,
      is_external: isExternal,
    })
    .run();
}

/**
 * Convert an existing keyframe to a delta pointing at a new target.
 * Used in reverse-delta scheme when a new version becomes the keyframe.
 */
export function convertKeyframeToDelta(
  db: SnapshotDb,
  oid: string,
  newTargetOid: string,
  delta: Buffer,
): void {
  db.update(schema.snapshots)
    .set({
      payload: delta,
      delta_target_oid: newTargetOid,
    })
    .where(eq(schema.snapshots.oid, oid))
    .run();
}

/**
 * Retrieve and decompress content for a snapshot oid.
 * Follows delta chain backwards (towards newer versions) to reconstruct.
 * Returns null for external (LFS) snapshots - use streamContent instead.
 */
export async function retrieveContentForOid(
  db: SnapshotDb,
  oid: string,
): Promise<Buffer | null> {
  const chain: Array<{
    oid: string;
    payload: Buffer;
    delta_target_oid: string | null;
    is_external: boolean;
  }> = [];
  let currentOid: string | null = oid;

  // Walk forward to the keyframe (latest version)
  while (currentOid) {
    const snapshot = await getSnapshot(db, currentOid);
    if (!snapshot) throw new Error(`Snapshot not found: ${currentOid}`);

    chain.push(snapshot);

    if (snapshot.delta_target_oid === null) break;

    currentOid = snapshot.delta_target_oid;
  }

  // Start from keyframe (last in chain)
  const keyframe = chain.pop()!;

  // Return null for external snapshots - caller should use streamContent
  if (keyframe.is_external) return null;

  let content = Buffer.from(zstd.decompress(keyframe.payload));

  // Apply deltas in reverse order (newest to oldest)
  while (chain.length > 0) {
    const deltaSnapshot = chain.pop()!;
    // fossil-delta accepts Uint8Array (which Buffer extends) and returns the same type
    content = Buffer.from(
      fossilDelta.applyDelta(content, deltaSnapshot.payload),
    );
  }

  return content;
}

/**
 * Retrieve and decompress content for multiple snapshot oids.
 * Returns a Map from oid to decompressed content.
 * Deduplicates input oids and filters out nulls/undefined automatically.
 * External (LFS) oids are automatically filtered out - they won't appear in the result.
 */
export async function retrieveContentsForOids(
  db: SnapshotDb,
  oids: (string | null | undefined)[],
): Promise<Map<string, Buffer>> {
  const uniqueOids = [...new Set(oids.filter((oid): oid is string => !!oid))];

  if (uniqueOids.length === 0) {
    return new Map();
  }

  // Batch lookup: filter to only inline (non-external) oids
  const snapshotInfo = await db
    .select({
      oid: schema.snapshots.oid,
      is_external: schema.snapshots.is_external,
    })
    .from(schema.snapshots)
    .where(inArray(schema.snapshots.oid, uniqueOids))
    .all();

  const inlineOids = snapshotInfo
    .filter((s) => !s.is_external)
    .map((s) => s.oid);

  const contents = new Map<string, Buffer>();

  await Promise.all(
    inlineOids.map(async (oid) => {
      const content = await retrieveContentForOid(db, oid);
      if (content) contents.set(oid, content);
    }),
  );

  return contents;
}

/**
 * Summary row type for file pending status check.
 */
type FileSummary = {
  filepath: string;
  latest_baseline_oid: string | null;
  latest_edit_oid: string | null;
  latest_init_idx: number | null;
};

/**
 * Get all pending operations for a chat id.
 * Pending edit operations for a file are defined as operations where
 * the latest baseline snapshot_oid differs from the latest edit snapshot_oid.
 *
 * Returns all operations from the latest 'init' baseline to the latest operation
 * for each file that has pending edits. Includes isExternal flag from joined snapshot.
 */
export async function getPendingOperationsForChatId(
  db: SnapshotDb,
  chatId: string,
): Promise<OperationWithExternal[]> {
  const contributor = `chat-${chatId}`;

  // Query 1: Get summary per filepath using raw SQL with correlated subqueries
  // This returns: filepath, latest_baseline_oid, latest_edit_oid, latest_init_idx
  const summaryQuery = sql`
    SELECT 
      o.filepath,
      (SELECT snapshot_oid FROM operations o2 
       WHERE o2.filepath = o.filepath AND o2.operation = 'baseline' 
       ORDER BY o2.idx DESC LIMIT 1) as latest_baseline_oid,
      (SELECT snapshot_oid FROM operations o2 
       WHERE o2.filepath = o.filepath AND o2.operation = 'edit' 
       ORDER BY o2.idx DESC LIMIT 1) as latest_edit_oid,
      (SELECT MAX(o2.idx) FROM operations o2 
       WHERE o2.filepath = o.filepath 
       AND o2.operation = 'baseline' AND o2.reason = 'init') as latest_init_idx
    FROM operations o
    WHERE o.contributor = ${contributor}
    GROUP BY o.filepath
  `;

  const summaryResult = await db.all<FileSummary>(summaryQuery);

  // Filter for files with pending edits (baseline_oid !== edit_oid)
  const pendingFiles = summaryResult.filter(
    (row) =>
      row.latest_init_idx !== null &&
      row.latest_baseline_oid !== row.latest_edit_oid,
  );

  if (pendingFiles.length === 0) return [];

  // Query 2: Fetch all operations for pending files from their init baseline
  // Build OR conditions: (filepath = X AND idx >= Y) OR (filepath = Z AND idx >= W) ...
  const conditions = pendingFiles.map((file) =>
    and(
      eq(schema.operations.filepath, file.filepath),
      gte(schema.operations.idx, file.latest_init_idx!),
    ),
  );

  // Join with snapshots to get is_external flag
  const rows = await db
    .select({
      idx: schema.operations.idx,
      filepath: schema.operations.filepath,
      operation: schema.operations.operation,
      snapshot_oid: schema.operations.snapshot_oid,
      reason: schema.operations.reason,
      contributor: schema.operations.contributor,
      isExternal: schema.snapshots.is_external,
    })
    .from(schema.operations)
    .leftJoin(
      schema.snapshots,
      eq(schema.operations.snapshot_oid, schema.snapshots.oid),
    )
    .where(or(...conditions))
    .orderBy(schema.operations.filepath, schema.operations.idx)
    .all();

  return rows.map((row) => ({
    idx: row.idx,
    filepath: row.filepath,
    operation: row.operation,
    snapshot_oid: row.snapshot_oid,
    reason: row.reason,
    contributor: row.contributor,
    isExternal: row.isExternal ?? false,
  })) as OperationWithExternal[];
}

/**
 * Get all operations for a chat id.
 * Includes isExternal flag from joined snapshot.
 */
export async function getAllOperationsForChatId(
  db: SnapshotDb,
  chatId: string,
): Promise<OperationWithExternal[]> {
  const rows = await db
    .select({
      idx: schema.operations.idx,
      filepath: schema.operations.filepath,
      operation: schema.operations.operation,
      snapshot_oid: schema.operations.snapshot_oid,
      reason: schema.operations.reason,
      contributor: schema.operations.contributor,
      isExternal: schema.snapshots.is_external,
    })
    .from(schema.operations)
    .leftJoin(
      schema.snapshots,
      eq(schema.operations.snapshot_oid, schema.snapshots.oid),
    )
    .where(eq(schema.operations.contributor, `chat-${chatId}`))
    .orderBy(schema.operations.idx)
    .all();

  return rows.map((row) => ({
    idx: row.idx,
    filepath: row.filepath,
    operation: row.operation,
    snapshot_oid: row.snapshot_oid,
    reason: row.reason,
    contributor: row.contributor,
    isExternal: row.isExternal ?? false,
  })) as OperationWithExternal[];
}

/**
 * Get the latest operation for a filepath.
 * Includes isExternal flag from joined snapshot.
 */
export async function getLatestOperation(
  db: SnapshotDb,
  filepath: string,
): Promise<OperationWithExternal | null> {
  const row = await db
    .select({
      idx: schema.operations.idx,
      filepath: schema.operations.filepath,
      operation: schema.operations.operation,
      snapshot_oid: schema.operations.snapshot_oid,
      reason: schema.operations.reason,
      contributor: schema.operations.contributor,
      isExternal: schema.snapshots.is_external,
    })
    .from(schema.operations)
    .leftJoin(
      schema.snapshots,
      eq(schema.operations.snapshot_oid, schema.snapshots.oid),
    )
    .where(eq(schema.operations.filepath, filepath))
    .orderBy(desc(schema.operations.idx))
    .limit(1)
    .get();

  if (!row) return null;

  return {
    idx: row.idx,
    filepath: row.filepath,
    operation: row.operation,
    snapshot_oid: row.snapshot_oid,
    reason: row.reason,
    contributor: row.contributor,
    isExternal: row.isExternal ?? false,
  } as OperationWithExternal;
}

/**
 * Get operation at a specific index for a filepath.
 * Includes isExternal flag from joined snapshot.
 */
export async function getOperationAt(
  db: SnapshotDb,
  filepath: string,
  idx: number,
): Promise<OperationWithExternal | null> {
  const row = await db
    .select({
      idx: schema.operations.idx,
      filepath: schema.operations.filepath,
      operation: schema.operations.operation,
      snapshot_oid: schema.operations.snapshot_oid,
      reason: schema.operations.reason,
      contributor: schema.operations.contributor,
      isExternal: schema.snapshots.is_external,
    })
    .from(schema.operations)
    .leftJoin(
      schema.snapshots,
      eq(schema.operations.snapshot_oid, schema.snapshots.oid),
    )
    .where(
      and(
        eq(schema.operations.filepath, filepath),
        eq(schema.operations.idx, idx),
      ),
    )
    .get();

  if (!row) return null;

  return {
    idx: row.idx,
    filepath: row.filepath,
    operation: row.operation,
    snapshot_oid: row.snapshot_oid,
    reason: row.reason,
    contributor: row.contributor,
    isExternal: row.isExternal ?? false,
  } as OperationWithExternal;
}

/**
 * Get all operations for a filepath, ordered by idx ascending.
 * Includes isExternal flag from joined snapshot.
 */
export async function getOperationHistory(
  db: SnapshotDb,
  filepath: string,
): Promise<OperationWithExternal[]> {
  const rows = await db
    .select({
      idx: schema.operations.idx,
      filepath: schema.operations.filepath,
      operation: schema.operations.operation,
      snapshot_oid: schema.operations.snapshot_oid,
      reason: schema.operations.reason,
      contributor: schema.operations.contributor,
      isExternal: schema.snapshots.is_external,
    })
    .from(schema.operations)
    .leftJoin(
      schema.snapshots,
      eq(schema.operations.snapshot_oid, schema.snapshots.oid),
    )
    .where(eq(schema.operations.filepath, filepath))
    .orderBy(schema.operations.idx)
    .all();

  return rows.map((row) => ({
    idx: row.idx,
    filepath: row.filepath,
    operation: row.operation,
    snapshot_oid: row.snapshot_oid,
    reason: row.reason,
    contributor: row.contributor,
    isExternal: row.isExternal ?? false,
  })) as OperationWithExternal[];
}

/**
 * Insert a new operation.
 * idx is auto-generated by SQLite AUTOINCREMENT.
 */
export function insertOperation(
  db: SnapshotDb,
  filepath: string,
  snapshotOid: string,
  meta: OperationMeta,
): void {
  db.insert(schema.operations)
    .values({
      filepath,
      snapshot_oid: snapshotOid,
      operation: meta.operation,
      reason: meta.reason,
      contributor: meta.contributor,
    })
    .run();
}

/**
 * Result type for the revert info query.
 */
type RevertInfo = {
  target_idx: number | null;
  baseline_idx: number | null;
};

/**
 * Copies a block of operations for a filepath from the previous baseline (inclusive)
 * up to the target operation matching reason+contributor (inclusive).
 * This is the "revert" functionality - it restores the baseline and all operations
 * that existed at the time of the target operation.
 *
 * @param db - Database connection
 * @param filepath - The file path to revert operations for
 * @param reason - The tool-call reason to find (e.g., 'tool-abc123')
 * @param contributor - The chat contributor to find (e.g., 'chat-xyz')
 * @returns The snapshot_oid of the target operation (for writing to disk), or null if not found
 */
export async function copyOperationsUpToBaseline(
  db: SnapshotDb,
  filepath: string,
  reason: `tool-${ToolCallId}`,
  contributor: `chat-${ChatId}`,
): Promise<string | null> {
  // Query 1: Get target idx and baseline idx
  const infoQuery = sql`
    SELECT 
      (SELECT idx FROM operations 
       WHERE filepath = ${filepath} AND reason = ${reason} AND contributor = ${contributor} 
       ORDER BY idx DESC LIMIT 1) as target_idx,
      (SELECT idx FROM operations 
       WHERE filepath = ${filepath} AND operation = 'baseline' 
       AND idx < (SELECT idx FROM operations 
                  WHERE filepath = ${filepath} AND reason = ${reason} AND contributor = ${contributor} 
                  ORDER BY idx DESC LIMIT 1)
       ORDER BY idx DESC LIMIT 1) as baseline_idx
  `;

  const infoResult = await db.get<RevertInfo>(infoQuery);

  if (
    !infoResult ||
    infoResult.target_idx === null ||
    infoResult.baseline_idx === null
  ) {
    // Target operation or previous baseline not found
    return null;
  }

  const { target_idx, baseline_idx } = infoResult;

  // Query 2: INSERT ... SELECT to copy the operations block (idx auto-generated)
  await db.run(sql`
    INSERT INTO operations (filepath, operation, snapshot_oid, reason, contributor)
    SELECT 
      filepath,
      operation,
      snapshot_oid,
      reason,
      contributor
    FROM operations 
    WHERE filepath = ${filepath} AND idx >= ${baseline_idx} AND idx <= ${target_idx}
    ORDER BY idx
  `);

  // Get the snapshot_oid of the target operation (for writing to disk)
  const targetOp = await getOperationAt(db, filepath, target_idx);
  return targetOp?.snapshot_oid ?? null;
}

/**
 * Store new file content with reverse-delta compression.
 * Returns the oid of the stored content.
 */
export async function storeFileContent(
  db: SnapshotDb,
  filepath: string,
  content: Buffer,
  meta: OperationMeta,
): Promise<string> {
  const newOid = computeOid(content);

  // Get current latest for this filepath (for delta compression)
  const latestOp = await getLatestOperation(db, filepath);

  // Check if this exact content already exists
  if (!(await snapshotExists(db, newOid))) {
    if (latestOp?.snapshot_oid) {
      // Try to convert previous keyframe to delta (skip if previous is external)
      const previousContent = await retrieveContentForOid(
        db,
        latestOp.snapshot_oid,
      );
      if (previousContent) {
        // fossil-delta accepts Uint8Array (which Buffer extends) and returns the same type
        const delta = Buffer.from(
          fossilDelta.createDelta(content, previousContent),
        );

        // Previous becomes delta pointing to new
        convertKeyframeToDelta(db, latestOp.snapshot_oid, newOid, delta);
      }
      // If previous was external, we skip delta conversion - both remain keyframes
    }

    // New content becomes keyframe
    insertKeyframe(db, newOid, content);
  }

  // Record operation (idx auto-generated)
  insertOperation(db, filepath, newOid, meta);

  return newOid;
}

/**
 * Store large file content using LFS (Large File Storage).
 * Streams content to disk blob store instead of SQLite.
 * Returns the oid of the stored content.
 *
 * @param db - Database connection
 * @param blobsDir - Directory for storing blob files
 * @param source - Async iterable of content chunks (e.g., from createReadStream)
 * @param filepath - Logical file path for operation tracking
 * @param meta - Operation metadata
 */
export async function storeLargeContent(
  db: SnapshotDb,
  blobsDir: string,
  source: AsyncIterable<Buffer>,
  filepath: string,
  meta: OperationMeta,
): Promise<string> {
  // Ensure blobs directory exists
  await mkdir(blobsDir, { recursive: true });

  const tempPath = path.join(blobsDir, `temp-${randomUUID()}`);
  const hash = createHash('sha256');
  const writeStream = createWriteStream(tempPath);

  // Single pass: hash while writing to temp file
  for await (const chunk of source) {
    hash.update(chunk);
    writeStream.write(chunk);
  }
  writeStream.end();

  // Wait for write to complete
  await new Promise<void>((resolve, reject) => {
    writeStream.on('finish', resolve);
    writeStream.on('error', reject);
  });

  const oid = hash.digest('hex');
  const blobPath = path.join(blobsDir, oid);

  // Atomic rename (overwrites if exists = dedup)
  await rename(tempPath, blobPath);

  // Check if snapshot record exists
  if (!(await snapshotExists(db, oid))) {
    // Insert external snapshot record (empty payload, is_external=true)
    insertKeyframe(db, oid, Buffer.alloc(0), true);
  }

  // Record operation (idx auto-generated)
  insertOperation(db, filepath, oid, meta);

  return oid;
}

/**
 * Stream content from an external (LFS) blob.
 * Use this for memory-efficient retrieval of large files.
 *
 * @param blobsDir - Directory containing blob files
 * @param oid - Content oid to retrieve
 */
export async function* streamContent(
  blobsDir: string,
  oid: string,
): AsyncGenerator<Buffer> {
  const blobPath = path.join(blobsDir, oid);
  const stream = createReadStream(blobPath);

  for await (const chunk of stream) {
    yield Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
  }
}

/**
 * Copy content from an external (LFS) blob directly to a destination path.
 * Use this for reverting deletions of large files - never loads full content into memory.
 *
 * @param blobsDir - Directory containing blob files
 * @param oid - Content oid to copy
 * @param destPath - Destination file path
 */
export async function copyContentToPath(
  blobsDir: string,
  oid: string,
  destPath: string,
): Promise<void> {
  const blobPath = path.join(blobsDir, oid);
  const readStream = createReadStream(blobPath);
  const writeStream = createWriteStream(destPath);

  await pipeline(readStream, writeStream);
}

/**
 * Get all unique filepaths that have operations.
 */
export async function getAllFilepaths(db: SnapshotDb): Promise<string[]> {
  const rows = await db
    .selectDistinct({ filepath: schema.operations.filepath })
    .from(schema.operations)
    .all();

  return rows.map((r) => r.filepath);
}

/**
 * Delete all operations and orphaned snapshots for a filepath.
 */
export function deleteFileHistory(db: SnapshotDb, filepath: string): void {
  db.delete(schema.operations)
    .where(eq(schema.operations.filepath, filepath))
    .run();
}
