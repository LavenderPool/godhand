import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  unlinkSync,
} from "fs";
import { dirname, join } from "path";
import * as schema from "./schema.js";

export type Db = BetterSQLite3Database<typeof schema>;

const MAX_BACKUPS = 5;

export function getBackupsDir(dbPath: string): string {
  return join(dirname(dbPath), "backups");
}

export function backupDatabase(dbPath: string, label?: string): Promise<string | null> {
  if (!existsSync(dbPath)) return Promise.resolve(null);

  const backupsDir = getBackupsDir(dbPath);
  mkdirSync(backupsDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupName = label ? `godhand.${label}.${timestamp}.db` : `godhand.${timestamp}.db`;
  const backupPath = join(backupsDir, backupName);

  const source = new Database(dbPath, { readonly: true });
  return source
    .backup(backupPath)
    .then(() => {
      pruneOldBackups(backupsDir, MAX_BACKUPS);
      return backupPath;
    })
    .finally(() => {
      source.close();
    });
}

function pruneOldBackups(backupsDir: string, maxBackups: number): void {
  const backups = readdirSync(backupsDir)
    .filter((file) => file.endsWith(".db"))
    .map((file) => join(backupsDir, file))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);

  for (const oldBackup of backups.slice(maxBackups)) {
    unlinkSync(oldBackup);
  }
}

export function listBackups(dbPath: string): string[] {
  const backupsDir = getBackupsDir(dbPath);
  if (!existsSync(backupsDir)) return [];

  return readdirSync(backupsDir)
    .filter((file) => file.endsWith(".db"))
    .map((file) => join(backupsDir, file))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
}

export function restoreDatabaseFromBackup(dbPath: string, backupPath: string): void {
  if (!existsSync(backupPath)) {
    throw new Error(`Backup not found: ${backupPath}`);
  }

  for (const suffix of ["-wal", "-shm"]) {
    const sidecarPath = `${dbPath}${suffix}`;
    if (existsSync(sidecarPath)) {
      unlinkSync(sidecarPath);
    }
  }

  copyFileSync(backupPath, dbPath);
}

export function restoreLatestBackup(dbPath: string): boolean {
  const backups = listBackups(dbPath);
  if (backups.length === 0) return false;
  restoreDatabaseFromBackup(dbPath, backups[0]!);
  return true;
}

export function createDb(dbPath: string): { db: Db; sqlite: Database.Database } {
  mkdirSync(dirname(dbPath), { recursive: true });
  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  const db = drizzle(sqlite, { schema });

  return { db, sqlite };
}

function initSchemaFallback(sqlite: Database.Database, migrationsFolder: string) {
  const sqlPath = join(migrationsFolder, "0000_init.sql");
  if (!existsSync(sqlPath)) return;
  const sql = readFileSync(sqlPath, "utf-8");
  const statements = sql
    .split(/-->\s*statement-breakpoint/)
    .map((s) => s.trim())
    .filter(Boolean);
  for (const statement of statements) {
    sqlite.exec(statement);
  }
}

export async function runMigrations(
  dbPath: string,
  migrationsFolder: string
): Promise<{ db: Db; sqlite: Database.Database }> {
  const dbExisted = existsSync(dbPath);
  let backupPath: string | null = null;

  if (dbExisted) {
    try {
      backupPath = await backupDatabase(dbPath, "pre-migrate");
    } catch (err) {
      console.warn("Failed to backup database before migration:", err);
    }
  }

  const { db, sqlite } = createDb(dbPath);
  try {
    migrate(db, { migrationsFolder });
    return { db, sqlite };
  } catch (migrateErr) {
    sqlite.close();

    if (dbExisted && backupPath && existsSync(backupPath)) {
      restoreDatabaseFromBackup(dbPath, backupPath);
      return createDb(dbPath);
    }

    const fresh = createDb(dbPath);
    try {
      const hasProjects = fresh.sqlite
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='projects'")
        .get();
      if (!hasProjects) {
        initSchemaFallback(fresh.sqlite, migrationsFolder);
      }
      return fresh;
    } catch {
      fresh.sqlite.close();
      throw migrateErr;
    }
  }
}

export {
  projects,
  generations,
  skills,
  mcpConnections,
  providerCredentials,
  appSettings,
} from "./schema.js";
export { schema };
