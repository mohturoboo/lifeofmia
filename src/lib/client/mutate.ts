'use client';

import { useCallback } from 'react';
import { ApiClientError } from '@/lib/client/api';
import { useToast } from '@/components/ui/toast';
import { useT } from '@/i18n/provider';

/**
 * Execution d'une ecriture avec retour utilisateur systematique.
 *
 * Onze mutations de l'application appelaient l'API sans aucune gestion d'erreur :
 * `await api.post(...)` seul. Une reponse 4xx ou 5xx produisait alors une
 * promesse rejetee que personne n'attrapait — l'action semblait n'avoir aucun
 * effet, sans le moindre message. C'est precisement ce que decrivent les
 * rapports « le bouton repond au clic mais la donnee n'apparait jamais ».
 *
 * Passer par ce point unique garantit trois choses :
 *
 * 1. un echec produit TOUJOURS une notification visible ;
 * 2. le message vient du serveur quand il en fournit un (« Repas introuvable »,
 *    « Un compte existe deja avec cette adresse »), bien plus utile qu'un
 *    « Une erreur est survenue » generique ;
 * 3. une reussite produit une confirmation, sauf demande contraire — les
 *    bascules rapides (cocher une habitude, epingler une note) s'en passent,
 *    une notification par clic y serait du bruit.
 *
 * La valeur de retour est `null` en cas d'echec : l'appelant sait s'il doit
 * fermer sa fenetre ou reafficher le formulaire.
 */
export interface MutateOptions {
  /** Afficher la confirmation de reussite. Vrai par defaut. */
  notifySuccess?: boolean;
}

export function useMutate() {
  const toast = useToast();
  const t = useT();

  return useCallback(
    async function run<T>(action: () => Promise<T>, options: MutateOptions = {}): Promise<T | null> {
      try {
        const result = await action();
        if (options.notifySuccess !== false) toast.success(t('common.success'));
        return result;
      } catch (error) {
        toast.error(error instanceof ApiClientError ? error.message : t('common.error'));
        return null;
      }
    },
    [toast, t],
  );
}
