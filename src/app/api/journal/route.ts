import { prisma } from '@/lib/prisma';
import { route } from '@/lib/api/handler';
import { ok } from '@/lib/api/response';
import { journalSchema } from '@/lib/validation/modules';
import { parseJson, parseStringArray, stringifyJson } from '@/lib/json';
import { dateKeyIn, isDateKey } from '@/lib/date';
import { recomputeDay } from '@/lib/stats';
import { awardXp, evaluateBadges } from '@/lib/gamification';

interface Media {
  url: string;
  type: 'image' | 'audio' | 'document';
  name: string;
}

/**
 * GET /api/journal
 *   ?date=YYYY-MM-DD  -> l'entree de ce jour
 *   sinon             -> les 60 dernieres entrees (vue liste)
 */
export const GET = route(async ({ user, searchParams }) => {
  const raw = searchParams.get('date');

  if (isDateKey(raw)) {
    const entry = await prisma.journalEntry.findUnique({
      where: { userId_date: { userId: user.id, date: raw } },
    });
    return ok({
      date: raw,
      entry: entry
        ? { ...entry, tags: parseStringArray(entry.tags), media: parseJson<Media[]>(entry.media, []) }
        : null,
    });
  }

  const entries = await prisma.journalEntry.findMany({
    where: { userId: user.id },
    orderBy: { date: 'desc' },
    take: 60,
  });

  return ok({
    date: dateKeyIn(user.timezone),
    entries: entries.map((entry) => ({
      ...entry,
      tags: parseStringArray(entry.tags),
      media: parseJson<Media[]>(entry.media, []),
    })),
  });
});

/**
 * PUT /api/journal — cree ou remplace l'entree du jour.
 * Une seule entree par date : l'ecriture est idempotente.
 */
export const PUT = route(
  async ({ user, body }) => {
    const payload = {
      mood: body.mood,
      energy: body.energy,
      title: body.title,
      content: body.content,
      gratitude: body.gratitude,
      tags: stringifyJson(body.tags),
      media: stringifyJson(body.media),
    };

    const existing = await prisma.journalEntry.findUnique({
      where: { userId_date: { userId: user.id, date: body.date } },
      select: { id: true },
    });

    const entry = await prisma.journalEntry.upsert({
      where: { userId_date: { userId: user.id, date: body.date } },
      create: { userId: user.id, date: body.date, ...payload },
      update: payload,
    });

    await recomputeDay(user.id, body.date);

    // L'XP n'est accordee qu'a la premiere ecriture du jour.
    if (!existing) {
      await awardXp(user.id, 10, 'Entree de journal', 'journal');
      await evaluateBadges(user.id);
    }

    return ok({ ...entry, tags: parseStringArray(entry.tags), media: parseJson<Media[]>(entry.media, []) });
  },
  { schema: journalSchema },
);
