'use client';

import { useCallback, useState } from 'react';
import { lireErreur } from '@/lib/client/errors';
import { useToast } from '@/components/ui/toast';
import { useT } from '@/i18n/provider';

/**
 * Execution d'une ecriture avec retour utilisateur systematique.
 *
 * Onze mutations de l'application appelaient l'API sans aucune gestion
 * d'erreur : `await api.post(...)` seul. Une reponse 4xx ou 5xx produisait une
 * promesse rejetee que personne n'attrapait — l'action semblait n'avoir aucun
 * effet, sans le moindre message.
 *
 * Passer par ce point unique garantit quatre choses :
 *
 * 1. un echec produit TOUJOURS une notification visible ;
 * 2. le message vient du serveur quand il en fournit un (« Repas introuvable »,
 *    « 80 caracteres maximum. »), bien plus utile qu'un « Une erreur est
 *    survenue » generique ;
 * 3. le detail PAR CHAMP est expose dans `fields`, pour s'afficher sous le
 *    champ fautif au lieu d'etre perdu ;
 * 4. une reussite produit une confirmation, sauf demande contraire — les
 *    bascules rapides (cocher une habitude, epingler une note) s'en passent.
 *
 * La valeur de retour est `null` en cas d'echec : l'appelant sait s'il doit
 * fermer sa fenetre ou laisser la saisie en place pour correction.
 */
export interface MutateOptions {
  /** Afficher la confirmation de reussite. Vrai par defaut. */
  notifySuccess?: boolean;
}

export function useMutate() {
  const toast = useToast();
  const t = useT();
  const [fields, setFields] = useState<Record<string, string>>({});

  const run = useCallback(
    async function run<T>(action: () => Promise<T>, options: MutateOptions = {}): Promise<T | null> {
      setFields({});
      try {
        const result = await action();
        if (options.notifySuccess !== false) toast.success(t('common.success'));
        return result;
      } catch (error) {
        const { message, fields: parChamp } = lireErreur(error, t('common.error'));
        setFields(parChamp);
        /*
         * Une erreur de validation est deja rendue visible sous chaque champ :
         * y ajouter une notification ferait doublon. On n'en affiche une que
         * lorsque rien d'autre ne porterait le message.
         */
        if (Object.keys(parChamp).length === 0) toast.error(message);
        return null;
      }
    },
    [toast, t],
  );

  /** A appeler quand l'utilisateur reprend un champ, pour effacer son erreur. */
  const clearField = useCallback((name: string) => {
    setFields((current) => (current[name] ? { ...current, [name]: '' } : current));
  }, []);

  /**
   * Pose une erreur sans passer par le serveur.
   *
   * Certaines regles se verifient avant l'envoi — « la fin doit suivre le
   * debut » n'a pas besoin d'un aller-retour reseau pour etre constatee. Le
   * message emprunte le meme canal que ceux du serveur : meme emplacement,
   * meme apparence, meme effacement des que l'utilisateur reprend le champ.
   */
  const setField = useCallback((name: string, message: string) => {
    setFields((current) => ({ ...current, [name]: message }));
  }, []);

  return { run, fields, clearField, setField };
}
