/**
 * `npm run lint:i18n` — controle des dictionnaires et des chaines francaises
 * ecrites hors dictionnaire (voir `src/i18n/controle.ts`).
 *
 * Sort en erreur sur une cle manquante, une variable perdue ou un mot francais
 * desaccentue ; les avertissements (autres langues) sont affiches sans bloquer.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { DICTIONARIES } from '../src/i18n';
import { SOURCES_FRANCAISES, controlerDictionnaires, controlerSource } from '../src/i18n/controle';

const racine = resolve(__dirname, '..');

function fichiers(chemin: string): string[] {
  if (statSync(chemin).isFile()) return /\.tsx?$/.test(chemin) ? [chemin] : [];
  return readdirSync(chemin).flatMap((nom) => fichiers(join(chemin, nom)));
}

const { erreurs, avertissements } = controlerDictionnaires(DICTIONARIES);

for (const source of SOURCES_FRANCAISES.flatMap((chemin) => fichiers(join(racine, chemin)))) {
  for (const { ligne, mots } of controlerSource(readFileSync(source, 'utf8'))) {
    erreurs.push(`${relative(racine, source)}:${ligne} : « ${mots.join(' », « ')} » sans accents`);
  }
}

for (const avertissement of avertissements) console.warn(`avertissement ${avertissement}`);
for (const erreur of erreurs) console.error(`erreur ${erreur}`);

if (erreurs.length > 0) {
  console.error(`\n${erreurs.length} erreur(s) i18n.`);
  process.exit(1);
}
console.log(`i18n : ${Object.keys(DICTIONARIES).length} langues et ${SOURCES_FRANCAISES.length} sources controlees, aucune erreur.`);
