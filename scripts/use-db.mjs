#!/usr/bin/env node
/**
 * Bascule le provider Prisma entre SQLite (developpement local, zero install)
 * et PostgreSQL (production).
 *
 *   node scripts/use-db.mjs sqlite
 *   node scripts/use-db.mjs postgresql
 *
 * Prisma n'accepte pas de variable d'environnement pour `provider` : ce script
 * reecrit donc la ligne dans prisma/schema.prisma. Le reste du schema est ecrit
 * dans un sous-ensemble compatible avec les deux moteurs, aucune autre
 * modification n'est necessaire.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCHEMA = resolve(__dirname, '..', 'prisma', 'schema.prisma');

const SUPPORTED = ['sqlite', 'postgresql'];
const target = (process.argv[2] || '').toLowerCase();

if (!SUPPORTED.includes(target)) {
  console.error(`Usage: node scripts/use-db.mjs <${SUPPORTED.join('|')}>`);
  process.exit(1);
}

const source = readFileSync(SCHEMA, 'utf8');
const updated = source.replace(
  /(datasource\s+db\s*\{[^}]*?provider\s*=\s*)"[^"]+"/,
  `$1"${target}"`,
);

if (source === updated) {
  console.log(`Provider deja configure sur "${target}".`);
} else {
  writeFileSync(SCHEMA, updated, 'utf8');
  console.log(`Provider Prisma bascule sur "${target}".`);
}

console.log(
  target === 'sqlite'
    ? '-> Verifiez DATABASE_URL="file:./dev.db" dans .env'
    : '-> Verifiez DATABASE_URL="postgresql://user:pass@host:5432/lifeofm" dans .env',
);
