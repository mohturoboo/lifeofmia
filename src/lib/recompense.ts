import { prisma } from '@/lib/prisma';
import { awardXp, evaluateBadges, levelProgress, refreshStreak, type XpSource } from '@/lib/gamification';
import type { LevelProgress } from '@/lib/levels';

/**
 * Ce qu'une action reussie a REELLEMENT produit.
 *
 * Toute la matiere existait deja cote serveur — `awardXp` renvoie le passage de
 * niveau, `refreshStreak` la serie, `evaluateBadges` les badges obtenus — mais
 * chaque route en gardait une partie pour elle : la route des taches jetait la
 * serie et les badges, celle du profil ne renvoyait rien du tout. L'XP montait
 * en base sans que personne ne le voie jamais monter.
 *
 * Ce type rassemble le tout en une seule forme, pour que l'interface n'ait
 * qu'une chose a lire et une seule facon de feter.
 */
export interface Recompense {
  /** XP de l'action. Negatif quand l'utilisateur annule. */
  xpAwarded: number;
  /** Total apres l'action, et progression dans le niveau. */
  progress: LevelProgress;
  leveledUp: boolean;
  previousLevel: number;
  /** Serie en cours apres l'action. */
  streak: number;
  /**
   * Palier de serie atteint a l'instant, ou `null`.
   *
   * Distinct de `streak` : c'est le franchissement qui se fete, pas la valeur.
   * Sans cette distinction, la celebration se rejouait a chaque validation
   * pendant toute la journee du septieme jour.
   */
  streakMilestone: number | null;
  /** Codes des badges debloques par cette action. */
  newBadges: string[];
}

/** Paliers de serie celebres. */
export const PALIERS_SERIE = [3, 7, 30, 100, 365] as const;

/**
 * Applique l'XP d'une action et rassemble tout ce qui merite d'etre annonce.
 *
 * `serieAvant` doit etre lue AVANT l'action : c'est la comparaison qui permet
 * de savoir si un palier vient d'etre franchi.
 */
export async function accorderRecompense(options: {
  userId: string;
  timezone: string;
  montant: number;
  raison: string;
  source: XpSource;
  /** Rafraichir la serie : uniquement quand l'action est une progression. */
  rafraichirSerie?: boolean;
  evaluerBadges?: boolean;
}): Promise<Recompense> {
  const { userId, timezone, montant, raison, source } = options;

  const avant = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { currentStreak: true },
  });

  const xp = await awardXp(userId, montant, raison, source);

  const [streak, newBadges] = await Promise.all([
    options.rafraichirSerie ? refreshStreak(userId, timezone) : Promise.resolve(avant.currentStreak),
    options.evaluerBadges ? evaluateBadges(userId) : Promise.resolve<string[]>([]),
  ]);

  /*
   * Le total d'XP est relu apres coup : `refreshStreak` accorde son propre
   * bonus de palier, et le renvoyer sans le prendre en compte aurait affiche
   * une barre de progression en retard sur la base.
   */
  const apres = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { xp: true, level: true },
  });

  const palier =
    streak > avant.currentStreak && (PALIERS_SERIE as readonly number[]).includes(streak)
      ? streak
      : null;

  return {
    xpAwarded: montant,
    progress: levelProgress(apres.xp),
    leveledUp: apres.level > xp.previousLevel,
    previousLevel: xp.previousLevel,
    streak,
    streakMilestone: palier,
    newBadges,
  };
}
