import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const MIGRATIONS_DIR = path.join(process.cwd(), 'migrations');

export interface MigrationRecord {
  id: number;
  name: string;
  applied_at: string;
}

/**
 * Ensures the _migrations tracking table exists, then applies every
 * *.sql file in /migrations that has not yet been recorded, in
 * alphabetical (version) order.  Each file is wrapped in a transaction
 * so a partial failure leaves the database unchanged.
 */
export function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT    UNIQUE NOT NULL,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const applied = new Set(
    (db.prepare('SELECT name FROM _migrations ORDER BY name').all() as MigrationRecord[])
      .map(r => r.name)
  );

  if (!fs.existsSync(MIGRATIONS_DIR)) {
    console.warn('[migrate] migrations/ directory not found — skipping');
    return;
  }

  const pending = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort()
    .filter(f => !applied.has(f));

  if (pending.length === 0) return;

  for (const file of pending) {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8');

    const apply = db.transaction(() => {
      db.exec(sql);
      db.prepare('INSERT INTO _migrations (name) VALUES (?)').run(file);
    });

    try {
      apply();
      console.log(`[migrate] ✓ ${file}`);
    } catch (err) {
      console.error(`[migrate] ✗ ${file}:`, (err as Error).message);
      throw err; // bubble up — app should not start with a broken schema
    }
  }

  console.log(`[migrate] ${pending.length} migration(s) applied`);
}

/** Returns all recorded migrations — useful for health checks or admin UI. */
export function getMigrationHistory(db: Database.Database): MigrationRecord[] {
  // _migrations may not exist yet if called before runMigrations
  try {
    return db.prepare('SELECT * FROM _migrations ORDER BY name').all() as MigrationRecord[];
  } catch {
    return [];
  }
}
