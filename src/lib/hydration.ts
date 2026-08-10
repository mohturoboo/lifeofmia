/**
 * Affichage d'un volume d'hydratation.
 *
 * `(ml / 1000).toFixed(1)` arrondissait 250 ml a « 0.3 L » et 750 ml a
 * « 0.8 L » : un verre bu affichait un tiers de litre, et le total ne
 * correspondait a aucune addition juste. Sous le litre, on parle en
 * millilitres — c'est l'unite dans laquelle l'utilisateur pense.
 */
export function formatWater(millilitres: number, locale: string): string {
  const volume = Math.max(0, Math.round(millilitres));

  if (volume < 1000) {
    return `${volume.toLocaleString(locale)} ml`;
  }

  // Au-dela du litre, deux decimales suffisent et restent exactes au verre pres.
  const litres = volume / 1000;
  const texte = litres.toLocaleString(locale, {
    minimumFractionDigits: litres % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return `${texte} L`;
}
