import { PrismaClient } from '@prisma/client';
import { recomputeDay } from '../src/lib/stats';
import { dateKeyIn, dateKeyRange } from '../src/lib/date';

/**
 * Recalcule l'historique statistique avec la regle de fenetre d'existence.
 *
 * Les lignes `DailyStat` deja ecrites portent l'ancien calcul : leur
 * denominateur d'habitudes etait celui du jour de l'ecriture, pas celui de la
 * journee concernee. Une habitude creee lundi gonflait le total attendu de la
 * semaine precedente et faisait baisser des scores passes ; une habitude
 * archivee disparaissait retroactivement des journees ou elle avait ete
 * validee.
 *
 * Corriger le code ne suffit pas : sans repassage, l'utilisateur continue de
 * lire un historique fausse. Ce script rejoue `recomputeDay()` sur chaque
 * journee depuis la creation du compte, avec la regle corrigee.
 *
 *   npx tsx scripts/recompute-stats.ts            # inventaire, sans ecrire
 *   npx tsx scripts/recompute-stats.ts --appliquer
 *   npx tsx scripts/recompute-stats.ts --appliquer --email=... (un seul compte)
 */
const prisma = new PrismaClient();
const appliquer = process.argv.includes('--appliquer');
const cible = process.argv.find((argument) => argument.startsWith('--email='))?.slice(8);

async function main() {
  const utilisateurs = await prisma.user.findMany({
    where: { deletedAt: null, ...(cible ? { email: cible.toLowerCase() } : {}) },
    select: { id: true, email: true, timezone: true, createdAt: true },
  });

  if (utilisateurs.length === 0) {
    console.log('Aucun compte a traiter.');
    return;
  }

  let journeesTotal = 0;
  let corrigees = 0;

  for (const utilisateur of utilisateurs) {
    const debut = dateKeyIn(utilisateur.timezone, utilisateur.createdAt);
    const fin = dateKeyIn(utilisateur.timezone);
    const journees = dateKeyRange(debut, fin);
    journeesTotal += journees.length;

    // Etat avant recalcul, pour ne signaler que les journees qui bougent.
    const avant = new Map(
      (
        await prisma.dailyStat.findMany({
          where: { userId: utilisateur.id },
          select: { date: true, habitsTotal: true, habitsDone: true, disciplineScore: true, completionRate: true },
        })
      ).map((ligne) => [ligne.date, ligne]),
    );

    const ecarts: string[] = [];

    for (const date of journees) {
      if (!appliquer) {
        // En inventaire, on ne peut comparer que ce qui existe deja.
        const ligne = avant.get(date);
        if (ligne) ecarts.push(`${date} (habitsTotal=${ligne.habitsTotal}, score=${ligne.disciplineScore})`);
        continue;
      }

      const apres = await recomputeDay(utilisateur.id, date);
      const ligne = avant.get(date);
      if (
        ligne &&
        (ligne.habitsTotal !== apres.habitsTotal ||
          ligne.habitsDone !== apres.habitsDone ||
          ligne.disciplineScore !== apres.disciplineScore ||
          ligne.completionRate !== apres.completionRate)
      ) {
        corrigees += 1;
        ecarts.push(
          `${date} : habitsTotal ${ligne.habitsTotal} -> ${apres.habitsTotal}, ` +
            `score ${ligne.disciplineScore} -> ${apres.disciplineScore}`,
        );
      }
    }

    console.log(`\n${utilisateur.email} — ${journees.length} journees (${debut} -> ${fin})`);
    for (const ecart of ecarts.slice(0, 20)) console.log(`  ${ecart}`);
    if (ecarts.length > 20) console.log(`  ... et ${ecarts.length - 20} autres`);
    if (appliquer && ecarts.length === 0) console.log('  historique deja coherent');
  }

  console.log(
    `\n${utilisateurs.length} compte(s), ${journeesTotal} journee(s) parcourue(s).` +
      (appliquer ? ` ${corrigees} journee(s) corrigee(s).` : ' Aucune ecriture (ajoutez --appliquer).'),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
