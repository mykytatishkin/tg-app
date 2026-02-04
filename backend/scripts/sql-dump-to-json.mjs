#!/usr/bin/env node
/**
 * Exports all data from PostgreSQL to a single JSON file.
 * Format is compatible with import-json-to-db.mjs.
 * Usage: node scripts/sql-dump-to-json.mjs [path/to/output.json]
 * Default output: data.json in backend root.
 * Requires: DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME (or defaults from .env)
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

const outPath = process.argv[2] ? path.resolve(process.argv[2]) : path.join(process.cwd(), 'data.json');

const client = new Client({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  user: process.env.DB_USER || 'tgapp',
  password: process.env.DB_PASSWORD || 'tgapp_secret',
  database: process.env.DB_NAME || 'tgapp',
});

// Same table order as import-json-to-db.mjs (logical read order, no FK issues for SELECT)
const tableOrder = [
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

  const data = {};

  for (const table of tableOrder) {
    const res = await client.query(`SELECT * FROM public."${table}"`);
    data[table] = res.rows;
    console.log('  ', table, res.rowCount, 'rows');
  }

  await client.end();

  fs.writeFileSync(outPath, JSON.stringify(data, null, 2), 'utf8');
  console.log('Written to', outPath);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
