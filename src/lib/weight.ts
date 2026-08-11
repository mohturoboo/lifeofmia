/**
 * Affichage d'une masse.
 *
 * Le meme poids s'ecrivait de deux facons sur la meme page : « 75kg » dans les
 * cartes du haut, ou l'unite etait collee au chiffre par une marge CSS, et
 * « 75 kg » dans l'historique juste en dessous, ou elle etait ecrite dans le
 * texte. Deux chemins de rendu pour la meme donnee, donc deux resultats.
 *
 * Un seul point de passage : la valeur est arrondie au dixieme, formatee selon
 * la locale — la virgue decimale francaise n'est pas un point — et suivie de
 * son unite separee par une espace.
 */
export function formatWeight(kilogrammes: number, locale: string, unite = 'kg'): string {
  const arrondi = Math.round(kilogrammes * 10) / 10;
  const texte = arrondi.toLocaleString(locale, { maximumFractionDigits: 1 });
  return `${texte} ${unite}`;
}

/**
 * Ecart de poids, toujours signe.
 *
 * Un ecart nul ne porte pas de signe : « +0 kg » se lit comme une hausse.
 */
export function formatWeightDelta(kilogrammes: number, locale: string, unite = 'kg'): string {
  const arrondi = Math.round(kilogrammes * 10) / 10;
  const signe = arrondi > 0 ? '+' : '';
  return `${signe}${formatWeight(arrondi, locale, unite)}`;
}
