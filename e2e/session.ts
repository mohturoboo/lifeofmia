import path from 'node:path';

/** Emplacement de la session partagee par toute l'execution. */
export const FICHIER_SESSION = path.join(__dirname, '.auth', 'session.json');

/** Fuseau du compte de test (voir compte.setup.ts) : c'est lui qui definit « aujourd'hui ». */
export const FUSEAU_COMPTE = 'Europe/Paris';

/**
 * Date du jour (AAAA-MM-JJ) dans le fuseau du compte. `toISOString()` donne la
 * date UTC : entre minuit UTC et minuit a Paris, elle retarde d'un jour sur le
 * serveur et fait echouer les tests de filtres autour de minuit.
 */
export function aujourdhui(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: FUSEAU_COMPTE });
}
