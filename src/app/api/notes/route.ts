import { prisma } from '@/lib/prisma';
import { route } from '@/lib/api/handler';
import { created, ok } from '@/lib/api/response';
import { noteSchema } from '@/lib/validation/modules';
import { requireOwned } from '@/lib/api/ownership';
import { parseStringArray, stringifyJson } from '@/lib/json';
import { methodeRefusee, optionsPour, type MethodeHttp } from '@/lib/api/methodes';

/** GET /api/notes?q=... — liste, epinglees en premier. */
export const GET = route(async ({ user, searchParams }) => {
  const query = searchParams.get('q')?.trim().toLocaleLowerCase();

  const notes = await prisma.note.findMany({
    where: { userId: user.id },
    orderBy: [{ pinned: 'desc' }, { updatedAt: 'desc' }],
    take: 200,
  });

  /*
   * Le filtrage se fait en memoire plutot qu'avec `contains` en base.
   *
   * `contains` est insensible a la casse sur SQLite mais SENSIBLE sur
   * PostgreSQL : la recherche aurait donc silencieusement change de
   * comportement entre developpement et production. `mode: 'insensitive'`
   * corrigerait Postgres mais n'existe pas sur SQLite.
   *
   * Le jeu est deja borne a 200 notes par utilisateur : le cout est negligeable
   * et le resultat identique sur les deux moteurs.
   */
  const filtered = query
    ? notes.filter(
        (note) =>
          note.title.toLocaleLowerCase().includes(query) ||
          note.content.toLocaleLowerCase().includes(query),
      )
    : notes;

  return ok(filtered.map((note) => ({ ...note, tags: parseStringArray(note.tags) })));
});

export const POST = route(
  async ({ user, body }) => {
    const projectId = await requireOwned('project', body.projectId, user.id);

    const note = await prisma.note.create({
      data: {
        userId: user.id,
        title: body.title,
        content: body.content,
        tags: stringifyJson(body.tags),
        pinned: body.pinned,
        color: body.color,
        projectId: projectId ?? null,
      },
    });
    return created({ ...note, tags: parseStringArray(note.tags) });
  },
  { schema: noteSchema },
);

// --- Methodes non prises en charge
//
// Sans handler declare, Next.js repond en HTML sous une URL qui promet du
// JSON : le client echouait sur « Unexpected token '<' ». Le 405 porte
// desormais le meme format que toutes les autres erreurs, et l'en-tete
// `Allow` annonce ce qui est accepte.
const AUTORISEES: MethodeHttp[] = ['GET', 'POST'];
export const PUT = methodeRefusee(AUTORISEES);
export const PATCH = methodeRefusee(AUTORISEES);
export const DELETE = methodeRefusee(AUTORISEES);
export const OPTIONS = optionsPour(AUTORISEES);
