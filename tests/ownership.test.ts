import { describe, expect, it, vi, beforeEach } from 'vitest';

/**
 * Non-regression du controle d'acces sur les cles etrangeres.
 *
 * L'audit avait revele qu'un utilisateur B pouvait rattacher une tache au
 * `goalId` de A : le titre de B apparaissait alors dans les objectifs de A.
 * Ces tests verrouillent le comportement attendu de `requireOwned`.
 */

const findFirst = vi.fn();

vi.mock('@/lib/prisma', () => ({
  prisma: {
    goal: { findFirst: (...args: unknown[]) => findFirst('goal', ...args) },
    task: { findFirst: (...args: unknown[]) => findFirst('task', ...args) },
    project: { findFirst: (...args: unknown[]) => findFirst('project', ...args) },
  },
}));

const { requireOwned, rejectSelfReference } = await import('@/lib/api/ownership');
const { ApiError } = await import('@/lib/api/response');

describe('requireOwned', () => {
  beforeEach(() => findFirst.mockReset());

  it('laisse passer une reference appartenant a l\'utilisateur', async () => {
    findFirst.mockResolvedValue({ id: 'goal_1' });
    await expect(requireOwned('goal', 'goal_1', 'user_a')).resolves.toBe('goal_1');
  });

  it('filtre bien sur userId, pas seulement sur l\'identifiant', async () => {
    findFirst.mockResolvedValue({ id: 'goal_1' });
    await requireOwned('goal', 'goal_1', 'user_a');

    const [, args] = findFirst.mock.calls[0] as [string, { where: Record<string, unknown> }];
    expect(args.where).toEqual({ id: 'goal_1', userId: 'user_a' });
  });

  it('rejette la reference d\'un autre utilisateur', async () => {
    findFirst.mockResolvedValue(null); // le filtre userId ne renvoie rien
    await expect(requireOwned('goal', 'goal_de_A', 'user_b')).rejects.toThrow(ApiError);
  });

  it('renvoie NOT_FOUND et non FORBIDDEN, pour ne pas confirmer l\'existence', async () => {
    findFirst.mockResolvedValue(null);
    await expect(requireOwned('task', 'task_de_A', 'user_b')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('distingue « non fourni » de « detacher »', async () => {
    // undefined : le champ est absent du corps, on ne touche a rien.
    await expect(requireOwned('goal', undefined, 'user_a')).resolves.toBeUndefined();
    // null ou chaine vide : detachement explicite.
    await expect(requireOwned('goal', null, 'user_a')).resolves.toBeNull();
    await expect(requireOwned('goal', '', 'user_a')).resolves.toBeNull();
    expect(findFirst).not.toHaveBeenCalled();
  });

  it('couvre les trois types de ressources referencables', async () => {
    findFirst.mockResolvedValue(null);
    for (const kind of ['goal', 'task', 'project'] as const) {
      await expect(requireOwned(kind, 'x', 'user_b')).rejects.toThrow(ApiError);
    }
    expect(findFirst.mock.calls.map((call) => call[0])).toEqual(['goal', 'task', 'project']);
  });
});

describe('rejectSelfReference', () => {
  it('refuse qu\'une ressource soit son propre parent', () => {
    expect(() => rejectSelfReference('id_1', 'id_1', 'Une tache')).toThrow(ApiError);
  });

  it('accepte un parent different, null ou absent', () => {
    expect(() => rejectSelfReference('id_1', 'id_2', 'Une tache')).not.toThrow();
    expect(() => rejectSelfReference('id_1', null, 'Une tache')).not.toThrow();
    expect(() => rejectSelfReference('id_1', undefined, 'Une tache')).not.toThrow();
  });
});
