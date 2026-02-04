#!/usr/bin/env node
/**
 * Extracts COPY blocks from pg_dump and writes them in FK order so COPY succeeds.
 * Usage: node reorder-dump-data-only.mjs [input.sql] [output.sql]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const inputPath = path.resolve(process.argv[2] || path.join(scriptDir, 'backup_all_additional_Data.sql'));
const outputPath = process.argv[3] ? path.resolve(process.argv[3]) : path.join(scriptDir, 'backup_data_only_ordered.sql');

const FK_ORDER = [
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

const sql = fs.readFileSync(inputPath, 'utf8');
const blocks = new Map();

const copyRe = /COPY public\.(\w+) \([^)]+\) FROM stdin;\n([\s\S]*?)^\\\.$/gm;
let m;
while ((m = copyRe.exec(sql)) !== null) {
  blocks.set(m[1], m[0]);
}

const header = `-- Data in FK order. Load with: psql ... -f this_file -v ON_ERROR_STOP=0
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;

`;

const out = header + FK_ORDER.map((t) => blocks.get(t)).filter(Boolean).join('\n\n') + '\n';
fs.writeFileSync(outputPath, out, 'utf8');
console.log('Written:', outputPath);
