import { prisma } from '@/lib/prisma';
import { route } from '@/lib/api/handler';
import { RATE_LIMITS } from '@/lib/auth/rate-limit';
import { ok } from '@/lib/api/response';
import { addDaysToKey, dateKeyIn, dateKeyRange, COMPARE_PERIODS, type ComparePeriod } from '@/lib/date';
import { aggregate, habitCountsOn, heatmap, readRange } from '@/lib/stats';
import { levelProgress } from '@/lib/gamification';
import { buildRadar } from '@/lib/analytics';
import { methodeRefusee, optionsPour, type MethodeHttp } from '@/lib/api/methodes';

/**
 * GET /api/stats?period=7d|30d|3m|6m|1y|all
 *
 * Vue analytique complete : serie temporelle, agregats, heatmap annuelle,
 * repartition des habitudes par categorie et profil radar d'equilibre de vie.
 */
export const GET = route(async ({ user, searchParams }) => {
  const period = (searchParams.get('period') ?? '30d') as ComparePeriod;
  const days = COMPARE_PERIODS[period] ?? 30;
  const today = dateKeyIn(user.timezone);

  /*
   * La fenetre ne remonte pas avant la creation du compte.
   *
   * Sur un compte de deux jours, « les 30 derniers jours » comptaient 28
   * journees inexistantes comme des zeros : toutes les moyennes etaient
   * divisees par quinze, et la page annoncait un effondrement la ou il n'y
   * avait qu'une absence d'historique.
   */
  const accountStart = dateKeyIn(user.timezone, user.createdAt);
  const requestedFrom = addDaysToKey(today, -(days - 1));
  const range = dateKeyRange(requestedFrom < accountStart ? accountStart : requestedFrom, today);
  const [series, yearHeatmap, habits, badges] = await Promise.all([
    readRange(user.id, range),
    heatmap(user.id, today, 364),
    prisma.habit.findMany({
      where: { userId: user.id, archivedAt: null },
      select: {
        id: true,
        name: true,
        category: true,
        color: true,
        weekDays: true,
        frequency: true,
        createdAt: true,
        archivedAt: true,
        logs: { where: { date: { gte: range[0] } }, select: { status: true } },
      },
    }),
    prisma.userBadge.findMany({ where: { userId: user.id }, include: { badge: true } }),
  ]);

  const totals = aggregate(series);

  // Repartition des validations par categorie d'habitude.
  const byCategory = habits.reduce<Record<string, number>>((accumulator, habit) => {
    const done = habit.logs.filter((log) => log.status === 'done').length;
    accumulator[habit.category] = (accumulator[habit.category] ?? 0) + done;
    return accumulator;
  }, {});

  /*
   * Taux de reussite par habitude.
   *
   * Le denominateur est le nombre de jours ou l'habitude etait REELLEMENT
   * attendue dans la fenetre : depuis sa creation, et seulement les jours de
   * sa frequence. Diviser par la longueur de la fenetre — 30 jours quelle que
   * soit l'habitude — affichait 3 % a une habitude creee le jour meme et
   * validee, et plafonnait a 43 % une habitude hebdomadaire parfaitement
   * tenue. Le chiffre punissait l'anciennete du compte, pas la regularite.
   *
   * `expected` est aussi renvoye : « 1/1 » et « 30/30 » valent tous deux
   * 100 %, et l'interface doit pouvoir distinguer les deux.
   */
  const perHabit = habits
    .map((habit) => {
      const done = habit.logs.filter((log) => log.status === 'done').length;
      const expected = range.filter((date) => habitCountsOn(habit, date, user.timezone)).length;
      return {
        id: habit.id,
        name: habit.name,
        color: habit.color,
        done,
        missed: Math.max(0, expected - done),
        expected,
        rate: expected > 0 ? Math.round((Math.min(done, expected) / expected) * 100) : 0,
      };
    })
    .sort((a, b) => b.rate - a.rate);

  /**
   * Radar d'equilibre : chaque axe est ramene sur 0-100 par rapport a une cible
   * quotidienne raisonnable, afin que les dimensions soient comparables entre
   * elles malgre des unites tres differentes.
   */
  const radar = buildRadar(totals, range.length);

  return ok({
    period,
    days: range.length,
    accountStart,
    series,
    totals,
    heatmap: yearHeatmap,
    byCategory,
    perHabit,
    radar,
    progress: levelProgress(user.xp),
    streak: { current: user.currentStreak, longest: user.longestStreak },
    badges: badges.map((entry) => ({ ...entry.badge, unlockedAt: entry.unlockedAt })),
  });
}, { rateLimit: { key: 'analytics', ...RATE_LIMITS.analytics } });

// --- Methodes non prises en charge
//
// Sans handler declare, Next.js repond en HTML sous une URL qui promet du
// JSON : le client echouait sur « Unexpected token '<' ». Le 405 porte
// desormais le meme format que toutes les autres erreurs, et l'en-tete
// `Allow` annonce ce qui est accepte.
const AUTORISEES: MethodeHttp[] = ['GET'];
export const POST = methodeRefusee(AUTORISEES);
export const PUT = methodeRefusee(AUTORISEES);
export const PATCH = methodeRefusee(AUTORISEES);
export const DELETE = methodeRefusee(AUTORISEES);
export const OPTIONS = optionsPour(AUTORISEES);
