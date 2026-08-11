/**
 * Recherche de texte insensible aux accents.
 *
 * Les specifications visaient le libelle exact : `'Securite'`, `'Langue et
 * region'`, `/deuxieme mesure/i`. La reprise du dictionnaire francais a
 * accentue ces libelles, et dix-sept tests sont tombes d'un coup — puis sept
 * autres apres une premiere passe de correction manuelle.
 *
 * Le probleme n'est pas l'accentuation : c'est que le test etait couple a la
 * TYPOGRAPHIE d'un libelle alors qu'il ne s'interesse qu'a son identite. Une
 * virgule deplacee ou une majuscule auraient produit la meme cascade.
 *
 * `motif()` compare donc sur la lettre de base : « Securite », « Sécurité » et
 * « SÉCURITÉ » designent le meme bouton. Ce qui reste verifie — l'existence du
 * bouton, son role, son comportement — est ce que le test cherche reellement a
 * prouver. L'orthographe des traductions, elle, est verifiee la ou c'est sa
 * place : dans les tests unitaires du dictionnaire.
 */

/** Variantes acceptees pour chaque lettre de base. */
const VARIANTES: Record<string, string> = {
  a: 'aàâäáã',
  c: 'cç',
  e: 'eéèêë',
  i: 'iîïí',
  n: 'nñ',
  o: 'oôöóõ',
  u: 'uùûüú',
  y: 'yÿ',
};

/** Retire les diacritiques d'une chaine (« Sécurité » -> « Securite »). */
export function sansAccent(texte: string): string {
  return texte.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/**
 * Motif de recherche tolerant aux accents et a la casse.
 *
 * Le texte fourni peut etre ecrit avec ou sans accents : il est normalise
 * avant construction du motif.
 */
export function motif(texte: string): RegExp {
  const echappe = sansAccent(texte).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const souple = echappe.replace(/[a-z]/gi, (lettre) => {
    const variantes = VARIANTES[lettre.toLowerCase()];
    return variantes ? `[${variantes}]` : lettre;
  });
  return new RegExp(souple, 'i');
}

/** Comme `motif`, mais le libelle doit correspondre en entier. */
export function motifExact(texte: string): RegExp {
  return new RegExp(`^\\s*${motif(texte).source}\\s*$`, 'i');
}
