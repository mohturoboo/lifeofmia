import { PrismaClient } from '@prisma/client';

/**
 * Repare les donnees temporellement incoherentes deja enregistrees.
 *
 * Trois failles laissaient passer des valeurs que le code refuse desormais :
 *
 *  - un evenement dont la fin precede — ou egale — le debut. La route
 *    « corrigeait » silencieusement le cas a une heure ; les enregistrements
 *    anterieurs a cette correction, ainsi que ceux passes par une modification
 *    partielle (qui n'etait pas controlee), ont pu rester en duree negative ;
 *  - une seance de sport, une session de concentration ou une entree de
 *    journal datee dans le futur ;
 *  - un objectif encore ouvert dont l'echeance est deja passee.
 *
 * Les deux derniers cas ne sont PAS modifies : ce sont des dates saisies par
 * l'utilisateur, et les deviner a sa place serait refaire l'erreur que ce
 * chantier corrige. Le script les inventorie pour qu'il decide.
 *
 * Seuls les evenements a duree nulle ou negative sont reparables sans
 * interpretation : la fin est portee a une heure apres le debut — la valeur
 * que la route imposait deja — et chaque correction est journalisee.
 *
 *   npx tsx scripts/fix-intervalles.ts              # inventaire, sans ecrire
 *   npx tsx scripts/fix-intervalles.ts --appliquer  # repare les evenements
 */
const prisma = new PrismaClient();
const appliquer = process.argv.includes('--appliquer');

async function main() {
  const utilisateurs = await prisma.user.findMany({
    where: { deletedAt: null },
    select: { id: true, email: true, timezone: true },
  });
  const fuseauPar = new Map(utilisateurs.map((entree) => [entree.id, entree.timezone]));
  const emailPar = new Map(utilisateurs.map((entree) => [entree.id, entree.email]));

  const jourDans = (timezone: string, at: Date = new Date()) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(at);

  // --- Evenements a duree nulle ou negative ----------------------------------
  const evenements = await prisma.calendarEvent.findMany({
    select: { id: true, userId: true, title: true, startAt: true, endAt: true },
  });
  const invalides = evenements.filter((evenement) => evenement.endAt.getTime() <= evenement.startAt.getTime());

  console.log(`\nEvenements : ${invalides.length} incoherent(s) sur ${evenements.length}`);
  for (const evenement of invalides) {
    console.log(
      `  ${emailPar.get(evenement.userId) ?? evenement.userId} — « ${evenement.title} » ` +
        `${evenement.startAt.toISOString()} -> ${evenement.endAt.toISOString()}`,
    );
    if (appliquer) {
      await prisma.calendarEvent.update({
        where: { id: evenement.id },
        data: { endAt: new Date(evenement.startAt.getTime() + 3_600_000) },
      });
      console.log('    -> fin portee a une heure apres le debut');
    }
  }

  // --- Dates futures : inventaire seulement ----------------------------------
  const [seances, sessions, entrees] = await Promise.all([
    prisma.workout.findMany({ select: { id: true, userId: true, date: true, name: true } }),
    prisma.focusSession.findMany({ select: { id: true, userId: true, date: true } }),
    prisma.journalEntry.findMany({ select: { id: true, userId: true, date: true } }),
  ]);

  const dansLeFutur = <T extends { userId: string; date: string }>(lignes: T[]) =>
    lignes.filter((ligne) => ligne.date > jourDans(fuseauPar.get(ligne.userId) ?? 'UTC'));

  const seancesFutures = dansLeFutur(seances);
  const sessionsFutures = dansLeFutur(sessions);
  const entreesFutures = dansLeFutur(entrees);

  console.log(`\nSeances datees dans le futur : ${seancesFutures.length}`);
  for (const seance of seancesFutures) {
    console.log(`  ${emailPar.get(seance.userId) ?? seance.userId} — ${seance.date} « ${seance.name} »`);
  }
  console.log(`Sessions de concentration dans le futur : ${sessionsFutures.length}`);
  console.log(`Entrees de journal dans le futur : ${entreesFutures.length}`);

  // --- Objectifs ouverts a echeance depassee ---------------------------------
  const objectifs = await prisma.goal.findMany({
    where: { status: { in: ['active', 'paused'] }, deadline: { not: null } },
    select: { id: true, userId: true, title: true, deadline: true },
  });
  const enRetard = objectifs.filter(
    (objectif) => jourDans(fuseauPar.get(objectif.userId) ?? 'UTC', objectif.deadline!) < jourDans(fuseauPar.get(objectif.userId) ?? 'UTC'),
  );

  console.log(`\nObjectifs ouverts dont l'echeance est passee : ${enRetard.length}`);
  for (const objectif of enRetard) {
    console.log(`  ${emailPar.get(objectif.userId) ?? objectif.userId} — « ${objectif.title} » ${objectif.deadline?.toISOString().slice(0, 10)}`);
  }
  if (enRetard.length > 0) {
    console.log("  (non modifies : un objectif en retard est une situation reelle, pas une donnee cassee)");
  }

  console.log(
    appliquer
      ? `\n${invalides.length} evenement(s) repare(s). Les dates saisies n'ont pas ete touchees.`
      : '\nAucune ecriture (ajoutez --appliquer pour reparer les evenements).',
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
