import { ApiError } from '@/lib/api/response';
import { dateKeyIn, type DateKey } from '@/lib/date';
import { DATE_INVALIDE, FIN_AVANT_DEBUT } from '@/lib/validation/common';

/**
 * Regles de coherence temporelle, partagees par toutes les routes.
 *
 * Elles etaient jusqu'ici absentes ou, pire, remplacees par une correction
 * silencieuse : un evenement dont la fin precedait le debut recevait « 201
 * Created » et une duree d'une heure imposee par le serveur. L'appelant
 * repartait convaincu d'avoir enregistre ce qu'il avait envoye, alors que la
 * base contenait autre chose. Corriger a la place de l'utilisateur, sans le
 * lui dire, est une facon d'effacer l'erreur plutot que de la signaler.
 *
 * Le message est unique : la meme faute doit se lire de la meme facon, quel
 * que soit le module.
 */

export { DATE_INVALIDE, FIN_AVANT_DEBUT };

/** Une chaine ISO exploitable, ou `null`. */
export function parseInstant(valeur: string): Date | null {
  const date = new Date(valeur);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Verifie qu'un intervalle a une duree strictement positive.
 *
 * Egalite comprise : un evenement qui finit a la seconde ou il commence n'est
 * pas un evenement, c'est une erreur de saisie.
 */
export function assertIntervalle(
  debut: string | Date,
  fin: string | Date,
  champs: { debut: string; fin: string } = { debut: 'startAt', fin: 'endAt' },
): { debut: Date; fin: Date } {
  const depart = debut instanceof Date ? debut : parseInstant(debut);
  const arrivee = fin instanceof Date ? fin : parseInstant(fin);

  if (!depart) throw new ApiError('VALIDATION', DATE_INVALIDE, { [champs.debut]: DATE_INVALIDE });
  if (!arrivee) throw new ApiError('VALIDATION', DATE_INVALIDE, { [champs.fin]: DATE_INVALIDE });

  if (arrivee.getTime() <= depart.getTime()) {
    throw new ApiError('VALIDATION', FIN_AVANT_DEBUT, { [champs.fin]: FIN_AVANT_DEBUT });
  }

  return { debut: depart, fin: arrivee };
}

/**
 * Refuse une journee posterieure a aujourd'hui.
 *
 * Une seance de sport, une entree de journal ou une session de concentration
 * decrivent ce qui a EU LIEU. Datees de la semaine prochaine, elles gonflent
 * l'XP et la serie pour un effort que personne n'a fourni. La borne est
 * calculee dans le fuseau du profil : celui du navigateur peut avancer d'un
 * jour sur celui de l'utilisateur.
 */
export function assertPasDansLeFutur(
  date: DateKey,
  timezone: string,
  champ = 'date',
  quoi = 'Cette saisie',
): void {
  const aujourdhui = dateKeyIn(timezone);
  if (date > aujourdhui) {
    const message = `${quoi} ne peut pas etre datee dans le futur.`;
    throw new ApiError('VALIDATION', message, {
      [champ]: `La date ne peut pas depasser le ${aujourdhui}.`,
    });
  }
}

/**
 * Refuse une echeance deja passee.
 *
 * Le miroir de la regle precedente, pour ce qui se PLANIFIE au lieu de se
 * constater. Un objectif ouvert avec une echeance depassee nait en retard : la
 * date saisie est une faute de frappe, jamais une intention.
 *
 * Aujourd'hui est accepte — se fixer la journee comme echeance est valide.
 */
export function assertPasDansLePasse(
  echeance: Date,
  timezone: string,
  champ = 'deadline',
  quoi = 'Une echeance',
): void {
  const aujourdhui = dateKeyIn(timezone);
  const jour = dateKeyIn(timezone, echeance);
  if (jour < aujourdhui) {
    throw new ApiError('VALIDATION', `${quoi} ne peut pas etre deja passee.`, {
      [champ]: `La date doit etre au plus tot le ${aujourdhui}.`,
    });
  }
}
