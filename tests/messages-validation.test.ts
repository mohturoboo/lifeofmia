import { describe, expect, it } from 'vitest';
import { habitCreateSchema, mealCreateSchema, weightSchema, taskCreateSchema } from '@/lib/validation/modules';
import { updateProfileSchema } from '@/lib/validation/auth';

/**
 * Les messages de validation s'adressent a un utilisateur, pas a un
 * developpeur.
 *
 * La locale fournie par la bibliotheque produisait des traductions mot a mot :
 *
 *   « Entrée invalide : chaîne attendu, indéfini reçu »   — accord faux
 *   « Option invalide : une valeur parmi "breakfast"|… »  — jargon anglais
 *   « Trop grand : … »                                    — sans la limite
 *
 * Ces tests verrouillent l'inverse : une phrase francaise, qui dit quoi
 * corriger et rappelle la limite en cause.
 */
function messages(resultat: { success: boolean; error?: { issues: Array<{ message: string }> } }) {
  return resultat.success ? [] : (resultat.error?.issues ?? []).map((issue) => issue.message);
}

describe('messages de validation', () => {
  it('dit qu\'un champ est obligatoire, sans parler de type interne', () => {
    expect(messages(habitCreateSchema.safeParse({}))).toContain('Ce champ est obligatoire.');
  });

  it('rappelle la limite quand une valeur est trop grande', () => {
    expect(messages(habitCreateSchema.safeParse({ name: 'x'.repeat(81) }))).toContain(
      'Le nom ne peut pas depasser 80 caracteres.',
    );
    expect(messages(taskCreateSchema.safeParse({ title: 'x'.repeat(200) }))).toContain(
      'Ce champ ne peut pas depasser 160 caracteres.',
    );
    expect(messages(habitCreateSchema.safeParse({ name: 'X', xpReward: 999 }))).toContain(
      'La valeur ne peut pas depasser 100.',
    );
  });

  it('donne les bornes attendues pour les mesures', () => {
    expect(messages(weightSchema.safeParse({ date: '2026-08-11', weightKg: 5 }))).toContain(
      'Le poids doit etre compris entre 20 et 400 kg.',
    );
    expect(messages(updateProfileSchema.safeParse({ heightCm: 500 }))).toContain(
      'La taille doit etre comprise entre 50 et 250 cm.',
    );
  });

  it('n\'expose jamais les identifiants techniques d\'une liste de choix', () => {
    const sortie = messages(mealCreateSchema.safeParse({ date: '2026-08-11', type: 'brunch', name: 'X' }));
    expect(sortie).toContain('Choix invalide.');
    for (const message of sortie) {
      expect(message).not.toMatch(/breakfast|lunch|dinner|snack/);
    }
  });

  it('ne laisse passer aucun message en anglais ni aucune traduction fautive', () => {
    const echantillons = [
      habitCreateSchema.safeParse({}),
      habitCreateSchema.safeParse({ name: 'x'.repeat(81) }),
      mealCreateSchema.safeParse({ date: '2026-08-11', type: 'brunch', name: 'X' }),
      weightSchema.safeParse({ date: '2026-08-11', weightKg: 5 }),
      taskCreateSchema.safeParse({ title: '' }),
      updateProfileSchema.safeParse({ heightCm: 500 }),
    ];

    for (const message of echantillons.flatMap(messages)) {
      // Bornes de mots : « invalide » contient « invalid », et c'est du francais.
      expect(message, `message suspect : « ${message} »`).not.toMatch(
        /Invalid input|Too big|Too small|expected|received/i,
      );
      // Les accords fautifs de la traduction automatique.
      expect(message, `traduction fautive : « ${message} »`).not.toMatch(/chaîne attendu|indéfini reçu/);
      // Une phrase, pas un fragment de journal technique.
      expect(message.endsWith('.'), `phrase incomplete : « ${message} »`).toBe(true);
    }
  });
});
