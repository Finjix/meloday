import Database from "better-sqlite3";
import { ensureRuntimeDirs, config } from "./config";

type GlobalWithDb = typeof globalThis & { __melodayDb?: Database.Database };

const migrations: Array<{ version: number; sql: string }> = [
  {
    version: 1,
    sql: `
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL COLLATE NOCASE UNIQUE,
        display_name TEXT NOT NULL,
        agent_name TEXT NOT NULL DEFAULT 'Melody',
        avatar_asset_id TEXT,
        password_hash TEXT NOT NULL,
        diary_limit INTEGER NOT NULL DEFAULT 31 CHECK (diary_limit >= 0),
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS auth_sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash TEXT NOT NULL UNIQUE,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        last_seen_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_auth_sessions_token ON auth_sessions(token_hash);

      CREATE TABLE IF NOT EXISTS active_sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status TEXT NOT NULL CHECK (status IN ('active', 'generating', 'completed', 'abandoned', 'expired')),
        state_json TEXT NOT NULL,
        stable_text TEXT NOT NULL DEFAULT '',
        recent_text TEXT NOT NULL DEFAULT '',
        user_turn_count INTEGER NOT NULL DEFAULT 0,
        turns_since_organization INTEGER NOT NULL DEFAULT 0,
        weather_json TEXT,
        created_at TEXT NOT NULL,
        last_activity_at TEXT NOT NULL,
        expires_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_active_sessions_user ON active_sessions(user_id, status);
      CREATE INDEX IF NOT EXISTS idx_active_sessions_expiry ON active_sessions(expires_at);

      CREATE TABLE IF NOT EXISTS session_messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL REFERENCES active_sessions(id) ON DELETE CASCADE,
        role TEXT NOT NULL CHECK (role IN ('user', 'agent')),
        content TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_session_messages_session ON session_messages(session_id, created_at);

      CREATE TABLE IF NOT EXISTS media_assets (
        id TEXT PRIMARY KEY,
        owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        kind TEXT NOT NULL CHECK (kind IN ('audio', 'cover', 'avatar')),
        storage_path TEXT NOT NULL UNIQUE,
        mime_type TEXT NOT NULL,
        byte_size INTEGER NOT NULL CHECK (byte_size >= 0),
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_media_assets_owner ON media_assets(owner_user_id);

      CREATE TABLE IF NOT EXISTS generation_jobs (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL REFERENCES active_sessions(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        parent_generation_id TEXT REFERENCES generation_jobs(id),
        status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'succeeded', 'failed')),
        stage TEXT NOT NULL CHECK (stage IN ('finalizing', 'music', 'cover', 'complete')),
        feedback TEXT,
        title TEXT NOT NULL DEFAULT '',
        summary TEXT NOT NULL DEFAULT '',
        body TEXT NOT NULL DEFAULT '',
        music_direction_json TEXT NOT NULL,
        audio_asset_id TEXT REFERENCES media_assets(id),
        cover_asset_id TEXT REFERENCES media_assets(id),
        error_message TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_generation_jobs_user ON generation_jobs(user_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_generation_jobs_status ON generation_jobs(status, updated_at);

      CREATE TABLE IF NOT EXISTS diary_entries (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        generation_id TEXT NOT NULL UNIQUE REFERENCES generation_jobs(id),
        title TEXT NOT NULL,
        summary TEXT NOT NULL,
        body TEXT NOT NULL,
        music_direction_json TEXT NOT NULL,
        audio_asset_id TEXT REFERENCES media_assets(id),
        cover_asset_id TEXT REFERENCES media_assets(id),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_diary_entries_user ON diary_entries(user_id, created_at DESC);

      CREATE TABLE IF NOT EXISTS community_posts (
        entry_id TEXT PRIMARY KEY REFERENCES diary_entries(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        published_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_community_posts_published ON community_posts(published_at DESC);

      CREATE TABLE IF NOT EXISTS capacity_grants (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        amount INTEGER NOT NULL CHECK (amount > 0),
        reason TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `,
  },
  {
    version: 2,
    sql: `
      ALTER TABLE active_sessions DROP COLUMN weather_json;
    `,
  },
  {
    version: 3,
    sql: `
      UPDATE users SET agent_name = username WHERE agent_name = 'Melody';
    `,
  },
];

function createDb(): Database.Database {
  ensureRuntimeDirs();
  const database = new Database(config.databasePath);
  database.pragma("foreign_keys = ON");
  database.pragma("journal_mode = WAL");
  database.pragma("busy_timeout = 5000");
  database.exec("CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)");

  const applied = new Set(
    database.prepare("SELECT version FROM schema_migrations ORDER BY version").all().map((row) => Number((row as { version: number }).version)),
  );

  for (const migration of migrations) {
    if (applied.has(migration.version)) continue;
    const apply = database.transaction(() => {
      database.exec(migration.sql);
      database.prepare("INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)").run(migration.version, new Date().toISOString());
    });
    apply();
  }

  const now = new Date().toISOString();
  database.prepare("UPDATE generation_jobs SET status = 'failed', audio_asset_id = NULL, cover_asset_id = NULL, error_message = '服务重启后任务已结束，请重新生成。', updated_at = ? WHERE status IN ('queued', 'running')").run(now);
  database.prepare("UPDATE active_sessions SET status = 'active', last_activity_at = ?, expires_at = ? WHERE status = 'generating'").run(now, new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString());

  return database;
}

export function getDb(): Database.Database {
  const globalDb = globalThis as GlobalWithDb;
  if (!globalDb.__melodayDb) globalDb.__melodayDb = createDb();
  return globalDb.__melodayDb;
}

export function closeDb(): void {
  const globalDb = globalThis as GlobalWithDb;
  globalDb.__melodayDb?.close();
  delete globalDb.__melodayDb;
}
