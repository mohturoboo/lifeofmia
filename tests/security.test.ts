import { describe, expect, it, beforeEach } from 'vitest';
import { evaluatePassword, hashPassword, verifyPassword } from '@/lib/auth/password';
import { signAccessToken, verifyAccessToken } from '@/lib/auth/jwt';
import { consume, reset, RATE_LIMITS } from '@/lib/auth/rate-limit';
import { parseJson, parseNumberArray, parseStringArray, stringifyJson } from '@/lib/json';
import { registerSchema, loginSchema } from '@/lib/validation/auth';
import { habitCreateSchema, weightSchema } from '@/lib/validation/modules';

describe('mots de passe', () => {
  it('produit un hash different du clair et verifiable', async () => {
    const hash = await hashPassword('Motdepasse1');
    expect(hash).not.toBe('Motdepasse1');
    expect(await verifyPassword('Motdepasse1', hash)).toBe(true);
    expect(await verifyPassword('Motdepasse2', hash)).toBe(false);
  });

  it('sale differemment deux hash du meme mot de passe', async () => {
    const [first, second] = await Promise.all([hashPassword('Identique1'), hashPassword('Identique1')]);
    expect(first).not.toBe(second);
  });

  it('evalue la robustesse', () => {
    expect(evaluatePassword('abc').score).toBe(0);
    expect(evaluatePassword('abcdefgh').score).toBe(1);
    expect(evaluatePassword('Abcdefgh1').score).toBeGreaterThanOrEqual(2);
    expect(evaluatePassword('Abcdefghij1!').score).toBe(4);
  });

  it('liste les criteres manquants', () => {
    const { issues } = evaluatePassword('abcdefgh');
    expect(issues).toContain('uppercase');
    expect(issues).toContain('digit');
    expect(issues).not.toContain('minLength');
  });
});

describe('jetons de session', () => {
  const payload = { sub: 'user_123', sid: 'session_abc', email: 'test@lifeofm.app', locale: 'fr' };

  it('signe et relit un jeton valide', async () => {
    const token = await signAccessToken(payload);
    const decoded = await verifyAccessToken(token);
    expect(decoded).toMatchObject(payload);
  });

  it('rejette un jeton altere', async () => {
    const token = await signAccessToken(payload);
    expect(await verifyAccessToken(`${token}x`)).toBeNull();
  });

  it('rejette une chaine qui n\'est pas un jeton', async () => {
    expect(await verifyAccessToken('pas-un-jwt')).toBeNull();
    expect(await verifyAccessToken('')).toBeNull();
  });

  it('rejette un jeton expire', async () => {
    const token = await signAccessToken(payload, '0s');
    // La verification tient compte de l'expiration meme immediate.
    await new Promise((resolve) => setTimeout(resolve, 1100));
    expect(await verifyAccessToken(token)).toBeNull();
  });
});

describe('limitation de debit', () => {
  beforeEach(() => reset('test-key'));

  it('autorise jusqu\'a la limite puis bloque', () => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      expect(consume('test-key', 3, 60_000).allowed).toBe(true);
    }
    const blocked = consume('test-key', 3, 60_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('decompte les tentatives restantes', () => {
    expect(consume('test-key', 5, 60_000).remaining).toBe(4);
    expect(consume('test-key', 5, 60_000).remaining).toBe(3);
  });

  it('isole les cles entre elles', () => {
    consume('test-key', 1, 60_000);
    expect(consume('autre-cle', 1, 60_000).allowed).toBe(true);
    reset('autre-cle');
  });

  it('definit des limites strictes sur les routes sensibles', () => {
    expect(RATE_LIMITS.login.limit).toBeLessThanOrEqual(10);
    expect(RATE_LIMITS.register.limit).toBeLessThanOrEqual(10);
  });
});

describe('serialisation JSON tolerante', () => {
  it('renvoie la valeur de repli sur une donnee invalide', () => {
    expect(parseJson('{ casse', { ok: true })).toEqual({ ok: true });
    expect(parseJson(null, [])).toEqual([]);
    expect(parseJson(undefined, 'defaut')).toBe('defaut');
  });

  it('filtre les elements du mauvais type', () => {
    expect(parseStringArray('["a", 1, "b", null]')).toEqual(['a', 'b']);
    expect(parseNumberArray('[0, "x", 3]')).toEqual([0, 3]);
  });

  it('ne jette jamais a la serialisation', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(stringifyJson(circular)).toBe('null');
  });
});

describe('validation des entrees', () => {
  it('refuse un email invalide a l\'inscription', () => {
    const result = registerSchema.safeParse({
      firstName: 'Test',
      lastName: 'User',
      email: 'pas-un-email',
      password: 'Motdepasse1',
      acceptTerms: true,
    });
    expect(result.success).toBe(false);
  });

  it('refuse un mot de passe trop faible', () => {
    const result = registerSchema.safeParse({
      firstName: 'Test',
      lastName: 'User',
      email: 'test@lifeofm.app',
      password: 'faible',
      acceptTerms: true,
    });
    expect(result.success).toBe(false);
  });

  it('exige l\'acceptation des conditions', () => {
    const result = registerSchema.safeParse({
      firstName: 'Test',
      lastName: 'User',
      email: 'test@lifeofm.app',
      password: 'Motdepasse1',
      acceptTerms: false,
    });
    expect(result.success).toBe(false);
  });

  it('normalise l\'email en minuscules', () => {
    const result = loginSchema.safeParse({ email: '  TEST@LifeofM.App  ', password: 'x' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBe('test@lifeofm.app');
  });

  it('refuse un poids hors des bornes physiologiques', () => {
    expect(weightSchema.safeParse({ date: '2026-08-07', weightKg: 500 }).success).toBe(false);
    expect(weightSchema.safeParse({ date: '2026-08-07', weightKg: 5 }).success).toBe(false);
    expect(weightSchema.safeParse({ date: '2026-08-07', weightKg: 78.4 }).success).toBe(true);
  });

  it('applique les valeurs par defaut d\'une habitude', () => {
    const result = habitCreateSchema.safeParse({ name: 'Lire' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.targetPerDay).toBe(1);
      expect(result.data.category).toBe('other');
      expect(result.data.weekDays).toEqual([0, 1, 2, 3, 4, 5, 6]);
    }
  });

  it('refuse une couleur qui n\'est pas hexadecimale', () => {
    expect(habitCreateSchema.safeParse({ name: 'Lire', color: 'rouge' }).success).toBe(false);
  });

  it('refuse une date au mauvais format', () => {
    expect(weightSchema.safeParse({ date: '07/08/2026', weightKg: 78 }).success).toBe(false);
  });
});
