#!/usr/bin/env tsx
/**
 * Standalone CLI migration runner.
 * Usage: npx tsx scripts/migrate.ts
 *   or:  npm run migrate
 */
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { runMigrations, getMigrationHistory } from '../lib/migrate';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'crm.db');

fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

console.log(`[migrate] database: ${DB_PATH}`);

runMigrations(db);

const history = getMigrationHistory(db);
if (history.length > 0) {
  console.log(`[migrate] applied migrations:`);
  for (const m of history) {
    console.log(`  • ${m.name}  (${m.applied_at})`);
  }
}

db.close();
