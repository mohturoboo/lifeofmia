'use client';

import { ApiClientError } from '@/lib/client/api';

/**
 * Lecture unique des erreurs renvoyees par l'API.
 *
 * Le serveur repond deja en francais et par champ :
 *
 *   { "error": { "code": "VALIDATION",
 *                "message": "Certains champs sont invalides.",
 *                "fields": { "name": "80 caracteres maximum." } } }
 *
 * Cette precision se perdait entierement cote client : les formulaires
 * affichaient « Une erreur est survenue », et le detail par champ n'etait
 * jamais lu. L'utilisateur voyait sa saisie refusee sans savoir quoi corriger.
 *
 * Ce point de passage rend les deux exploitables, quelle que soit la nature de
 * l'echec — reponse structuree, panne reseau, ou exception inattendue.
 */
export interface ErreurLue {
  /** Message global, destine a une notification. */
  message: string;
  /** Message par champ, destine a s'afficher sous le champ concerne. */
  fields: Record<string, string>;
}

export function lireErreur(error: unknown, secours: string): ErreurLue {
  if (error instanceof ApiClientError) {
    return { message: error.message || secours, fields: error.fields ?? {} };
  }
  return { message: secours, fields: {} };
}
