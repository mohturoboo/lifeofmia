'use client';

import { useSyncExternalStore } from 'react';

/**
 * L'interface est-elle vivante ?
 *
 * Repond `false` pendant le rendu serveur et le premier rendu client, `true`
 * des que React a pris la main. C'est exactement la frontiere qui compte pour
 * un bouton : avant, son gestionnaire n'existe pas et le clic est perdu ;
 * apres, il fonctionne.
 *
 * Les boutons d'action attendaient jusque-la l'ARRIVEE DES DONNEES — mesure sur
 * /habits : 3 385 ms, alors que le document etait charge a 351 ms. Or ouvrir un
 * formulaire de creation ne demande aucune donnee : il n'affiche qu'un
 * formulaire vide. Trois secondes d'attente etaient imposees sans raison.
 *
 * `useSyncExternalStore` est prefere a un `useEffect` : il donne deux valeurs
 * distinctes au serveur et au client sans provoquer d'erreur d'hydratation, et
 * bascule des le premier rendu client au lieu d'attendre un effet.
 */
const sabonner = () => () => {};

export function useHydrated(): boolean {
  return useSyncExternalStore(
    sabonner,
    () => true, // cote client
    () => false, // cote serveur
  );
}
