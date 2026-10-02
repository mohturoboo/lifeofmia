/**
 * `npm run lint:i18n` — controle des dictionnaires (voir `src/i18n/controle.ts`).
 *
 * Sort en erreur sur une cle manquante, une variable perdue ou un mot francais
 * desaccentue ; les avertissements (autres langues) sont affiches sans bloquer.
 */
import { DICTIONARIES } from '../src/i18n';
import { controlerDictionnaires } from '../src/i18n/controle';

const { erreurs, avertissements } = controlerDictionnaires(DICTIONARIES);

for (const avertissement of avertissements) console.warn(`avertissement ${avertissement}`);
for (const erreur of erreurs) console.error(`erreur ${erreur}`);

if (erreurs.length > 0) {
  console.error(`\n${erreurs.length} erreur(s) i18n.`);
  process.exit(1);
}
console.log(`i18n : ${Object.keys(DICTIONARIES).length} langues controlees, aucune erreur.`);
