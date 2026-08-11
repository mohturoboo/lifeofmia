import { prisma } from '@/lib/prisma';
import { route } from '@/lib/api/handler';
import { ok, ApiError } from '@/lib/api/response';
import { noteUpdateSchema } from '@/lib/validation/modules';
import { requireOwned } from '@/lib/api/ownership';
import { parseStringArray, stringifyJson } from '@/lib/json';
import { methodeRefusee, optionsPour, type MethodeHttp } from '@/lib/api/methodes';

export const PATCH = route(
  async ({ user, params, body }) => {
    const existing = await prisma.note.findFirst({
      where: { id: params.id, userId: user.id },
      select: { id: true },
    });
    if (!existing) throw new ApiError('NOT_FOUND', 'Note introuvable.');

    const { tags, projectId: rawProjectId, ...fields } = body;
    const projectId = await requireOwned('project', rawProjectId, user.id);

    const note = await prisma.note.update({
      where: { id: params.id },
      data: {
        ...fields,
        ...(tags !== undefined ? { tags: stringifyJson(tags) } : {}),
        ...(projectId !== undefined ? { projectId } : {}),
      },
    });

    return ok({ ...note, tags: parseStringArray(note.tags) });
  },
  { schema: noteUpdateSchema },
);

export const DELETE = route(async ({ user, params }) => {
  const existing = await prisma.note.findFirst({
    where: { id: params.id, userId: user.id },
    select: { id: true },
  });
  if (!existing) throw new ApiError('NOT_FOUND', 'Note introuvable.');

  await prisma.note.delete({ where: { id: params.id } });
  return ok({ deleted: true });
});

// --- Methodes non prises en charge
//
// Sans handler declare, Next.js repond en HTML sous une URL qui promet du
// JSON : le client echouait sur « Unexpected token '<' ». Le 405 porte
// desormais le meme format que toutes les autres erreurs, et l'en-tete
// `Allow` annonce ce qui est accepte.
const AUTORISEES: MethodeHttp[] = ['PATCH', 'DELETE'];
export const GET = methodeRefusee(AUTORISEES);
export const POST = methodeRefusee(AUTORISEES);
export const PUT = methodeRefusee(AUTORISEES);
export const OPTIONS = optionsPour(AUTORISEES);
