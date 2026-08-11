import { z } from 'zod';

/**
 * Messages de validation ecrits a la main.
 *
 * La locale francaise fournie par la bibliotheque traduit mot a mot des
 * messages destines aux developpeurs. Le resultat est fautif et illisible pour
 * un utilisateur :
 *
 *   « Entrée invalide : chaîne attendu, indéfini reçu »
 *   « Option invalide : une valeur parmi "breakfast"|"lunch"… attendue »
 *   « Trop grand : … »  — sans jamais dire quelle est la limite
 *
 * Le premier accorde « attendu » au masculin apres « chaîne », le deuxieme
 * expose des identifiants techniques anglais, le troisieme ne dit pas ce qu'il
 * faut corriger. Aucun n'aide a reparer sa saisie.
 *
 * Cette table les remplace tous. Elle ne dit jamais le type interne d'un champ,
 * elle dit ce que l'utilisateur doit faire — et rappelle systematiquement la
 * limite en cause.
 */

/** Un champ absent ou vide se dit de la meme facon, quel que soit son type. */
const OBLIGATOIRE = 'Ce champ est obligatoire.';

function accordePluriel(nombre: number, singulier: string, pluriel: string): string {
  return nombre > 1 ? pluriel : singulier;
}

export function messageDeValidation(issue: z.core.$ZodRawIssue): string | undefined {
  switch (issue.code) {
    case 'invalid_type': {
      if (issue.input === undefined || issue.input === null) return OBLIGATOIRE;
      if (issue.expected === 'number') return 'Un nombre est attendu.';
      if (issue.expected === 'boolean') return 'Valeur invalide.';
      if (issue.expected === 'date') return 'Date invalide.';
      return 'Texte attendu.';
    }

    case 'too_small': {
      const minimum = Number(issue.minimum);
      if (issue.origin === 'string') {
        // `min(1)` sur une chaine, c'est « champ requis », pas une longueur.
        if (minimum <= 1) return OBLIGATOIRE;
        return `Au moins ${minimum} ${accordePluriel(minimum, 'caractere', 'caracteres')}.`;
      }
      if (issue.origin === 'array') {
        return `Selectionnez au moins ${minimum} ${accordePluriel(minimum, 'element', 'elements')}.`;
      }
      return `La valeur doit etre superieure ou egale a ${minimum}.`;
    }

    case 'too_big': {
      const maximum = Number(issue.maximum);
      if (issue.origin === 'string') {
        return `Ce champ ne peut pas depasser ${maximum} ${accordePluriel(maximum, 'caractere', 'caracteres')}.`;
      }
      if (issue.origin === 'array') {
        return `Pas plus de ${maximum} ${accordePluriel(maximum, 'element', 'elements')}.`;
      }
      return `La valeur ne peut pas depasser ${maximum}.`;
    }

    /*
     * Les valeurs acceptees sont des identifiants internes, en anglais
     * (« breakfast », « lunch »…). Les afficher n'aiderait personne : ce sont
     * des listes deroulantes, l'utilisateur ne peut se tromper que si quelque
     * chose ne va pas ailleurs.
     */
    case 'invalid_value':
      return 'Choix invalide.';

    case 'invalid_format': {
      if (issue.format === 'email') return 'Adresse email invalide.';
      return 'Format invalide.';
    }

    case 'unrecognized_keys':
      return 'Ce formulaire contient un champ inattendu.';

    case 'not_multiple_of':
      return `La valeur doit etre un multiple de ${issue.divisor}.`;

    case 'invalid_union':
      return 'Valeur invalide.';

    default:
      return undefined; // laisse parler un message explicite s'il existe
  }
}

/**
 * Applique la table a TOUS les schemas.
 *
 * Les messages ecrits explicitement sur un champ restent prioritaires : cette
 * table ne sert que la ou personne n'a redige de phrase adaptee.
 */
export function installerMessagesFrancais() {
  z.config({ customError: messageDeValidation });
}
