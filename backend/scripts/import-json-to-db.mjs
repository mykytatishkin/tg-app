#!/usr/bin/env node
/**
 * Imports a JSON file (from sql-dump-to-json.mjs) into PostgreSQL.
 * Order: truncate child tables first, then insert in FK order.
 * Usage: node scripts/import-json-to-db.mjs <path/to/data.json>
 * Requires: DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME (or defaults from .env)
 * For import to production: set DB_HOST (and credentials) to target server.
 */

import fs from 'fs';
import path from 'path';
import pg from 'pg';

const { Client } = pg;

// Load .env from backend root if present
const envPath = path.join(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  const env = fs.readFileSync(envPath, 'utf8');
  for (const line of env.split('\n')) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
  }
}

const jsonPath = process.argv[2];
if (!jsonPath) {
  console.error('Usage: node scripts/import-json-to-db.mjs <path/to/data.json>');
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(path.resolve(jsonPath), 'utf8'));

const client = new Client({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  user: process.env.DB_USER || 'tgapp',
  password: process.env.DB_PASSWORD || 'tgapp_secret',
  database: process.env.DB_NAME || 'tgapp',
});

function toBool(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'boolean') return v;
  return v === 't' || v === 'true' || v === '1';
}

// Columns that are json/jsonb in DB: value must be sent as valid JSON string
const jsonColumnsByTable = {
  users: new Set(['drinkOptions', 'feedbackOptions']),
  appointment_feedback: new Set(['whatWasGood']),
  giveaways: new Set(['conditions']),
};

function toDbValue(table, col, v) {
  if (v === null || v === undefined) return null;
  const jsonCols = jsonColumnsByTable[table];
  if (jsonCols && jsonCols.has(col)) {
    if (typeof v === 'string') return v;
    return JSON.stringify(v);
  }
  if (typeof v === 'string' && (v === 't' || v === 'f')) return toBool(v);
  return v;
}

// Truncate in reverse FK order (children first)
const truncateOrder = [
  'appointment_feedback',
  'appointments',
  'giveaway_participants',
  'giveaway_winners',
  'giveaways',
  'availability_slots',
  'services',
  'clients',
  'monthly_expenses',
  'users',
];

// Insert in FK order
const insertOrder = [
  'users',
  'clients',
  'services',
  'availability_slots',
  'appointments',
  'appointment_feedback',
  'giveaways',
  'giveaway_participants',
  'giveaway_winners',
  'monthly_expenses',
];

async function run() {
  await client.connect();
  console.log('Connected to', process.env.DB_NAME || 'tgapp');

  try {
    console.log('Truncating tables (CASCADE)...');
    for (const table of truncateOrder) {
      if (!data[table]) continue;
      await client.query(`TRUNCATE TABLE public."${table}" CASCADE`);
      console.log('  truncated', table);
    }

    console.log('Inserting data...');
    for (const table of insertOrder) {
      const rows = data[table];
      if (!rows || rows.length === 0) {
        if (rows && rows.length === 0) console.log('  skip', table, '(empty)');
        continue;
      }
      const cols = Object.keys(rows[0]);
      const quotedCols = cols.map((c) => `"${c}"`).join(', ');
      const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
      const sql = `INSERT INTO public."${table}" (${quotedCols}) VALUES (${placeholders}) ON CONFLICT (id) DO NOTHING`;

      let ok = 0,
        errCount = 0;
      for (const row of rows) {
        const values = cols.map((col) => toDbValue(table, col, row[col]));
        try {
          const res = await client.query(sql, values);
          if (res.rowCount) ok++;
        } catch (e) {
          errCount++;
          console.error(`  ERROR ${table} id=${row.id}:`, e.message);
        }
      }
      console.log('  ', table, ok, 'inserted', errCount ? `, ${errCount} errors` : '');
    }
  } finally {
    await client.end();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
