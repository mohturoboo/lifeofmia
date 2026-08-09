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
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCHEMA = resolve(__dirname, '..', 'prisma', 'schema.prisma');
const ENV_FILE = resolve(__dirname, '..', '.env');

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

/*
 * Verification de coherence avec `.env`.
 *
 * Prisma ne compare le provider a l'URL qu'au moment d'executer une requete :
 * un decalage ne se voit donc qu'a l'execution, sous la forme d'un
 * « Invalid prisma.<modele>.<methode>() invocation » qui n'indique pas la
 * cause reelle. On previent ici, immediatement et sans ambiguite.
 */
const EXPECTED = {
  sqlite: { prefixes: ['file:'], example: 'file:./dev.db' },
  postgresql: {
    prefixes: ['postgresql://', 'postgres://'],
    example: 'postgresql://user:pass@host:5432/lifeofm',
  },
};

const { prefixes, example } = EXPECTED[target];

if (!existsSync(ENV_FILE)) {
  console.warn(`\n!! Aucun fichier .env. Creez-le avec DATABASE_URL="${example}"`);
  process.exit(0);
}

const currentUrl = readFileSync(ENV_FILE, 'utf8')
  .split(/\r?\n/)
  .find((line) => line.trimStart().startsWith('DATABASE_URL'))
  ?.split('=')
  .slice(1)
  .join('=')
  .trim()
  .replace(/^["']|["']$/g, '');

if (!currentUrl) {
  console.warn(`\n!! DATABASE_URL absente de .env. Ajoutez : DATABASE_URL="${example}"`);
  process.exit(1);
}

if (prefixes.some((prefix) => currentUrl.startsWith(prefix))) {
  console.log(`-> DATABASE_URL coherente avec le provider. Rien d'autre a faire.`);
} else {
  console.error(
    [
      '',
      '!! INCOHERENCE — l application ne demarrera pas en l etat.',
      '',
      `   provider    : ${target}`,
      `   DATABASE_URL: ${currentUrl}`,
      '',
      `   Corrigez .env : DATABASE_URL="${example}"`,
      '   puis relancez : npx prisma generate',
      '',
    ].join('\n'),
  );
  process.exit(1);
}
