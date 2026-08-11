import { PrismaClient } from '@prisma/client';
import { FALLBACK_CITIES } from '../src/lib/cities';

/**
 * Remet d'aplomb les profils dont le fuseau ne correspond pas a la ville.
 *
 * A l'inscription, le fuseau venait du navigateur et la ville d'un champ de
 * formulaire : rien ne les rapprochait. Un profil pouvait donc porter
 * `city: "Paris"`, des coordonnees parisiennes et `timezone:
 * "Africa/Casablanca"` — soit une heure d'ecart sur tout ce qui est date, des
 * horaires de priere aux bornes de « aujourd'hui ».
 *
 * Le script ne touche qu'aux villes dont on connait le fuseau avec certitude,
 * et signale les autres sans les modifier : mieux vaut une incoherence visible
 * qu'une correction devinee.
 *
 *   npx tsx scripts/fix-timezones.ts           # inventaire, sans rien changer
 *   npx tsx scripts/fix-timezones.ts --appliquer
 */
const prisma = new PrismaClient();
const appliquer = process.argv.includes('--appliquer');

async function main() {
  const utilisateurs = await prisma.user.findMany({
    select: { id: true, email: true, city: true, timezone: true, latitude: true, longitude: true },
  });

  const aCorriger: Array<{ id: string; email: string; de: string; vers: string; ville: string }> = [];
  const inconnues: Array<{ email: string; ville: string }> = [];

  for (const utilisateur of utilisateurs) {
    const reference = FALLBACK_CITIES[utilisateur.city];
    if (!reference) {
      inconnues.push({ email: utilisateur.email, ville: utilisateur.city });
      continue;
    }
    if (reference.timezone === utilisateur.timezone) continue;

    aCorriger.push({
      id: utilisateur.id,
      email: utilisateur.email,
      de: utilisateur.timezone,
      vers: reference.timezone,
      ville: utilisateur.city,
    });
  }

  console.log(`  ${utilisateurs.length} profil(s) examine(s)`);

  for (const { email, ville, de, vers } of aCorriger) {
    console.log(`  incoherent : ${email} — ${ville} avec ${de}, attendu ${vers}`);
  }
  for (const { email, ville } of inconnues) {
    console.log(`  ville hors reference, laissee telle quelle : ${email} — « ${ville} »`);
  }

  if (aCorriger.length === 0) {
    console.log('  aucun fuseau a corriger');
    return;
  }

  if (!appliquer) {
    console.log(`\n  ${aCorriger.length} correction(s) possible(s). Relancez avec --appliquer.`);
    return;
  }

  for (const { id, vers, ville } of aCorriger) {
    const reference = FALLBACK_CITIES[ville];
    await prisma.user.update({
      where: { id },
      data: { timezone: vers, latitude: reference.latitude, longitude: reference.longitude },
    });
  }
  console.log(`\n  ${aCorriger.length} profil(s) corrige(s)`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
