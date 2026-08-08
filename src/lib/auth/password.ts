import bcrypt from 'bcryptjs';

/** Cout bcrypt : 12 tours, compromis reconnu securite / latence en 2026. */
const SALT_ROUNDS = 12;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export interface PasswordStrength {
  score: 0 | 1 | 2 | 3 | 4;
  issues: string[];
}

/**
 * Evaluation simple mais utile de la robustesse d'un mot de passe.
 * Utilisee cote client (barre de progression) et cote serveur (refus < 2).
 */
export function evaluatePassword(password: string): PasswordStrength {
  const issues: string[] = [];
  if (password.length < 8) issues.push('minLength');
  if (!/[a-z]/.test(password)) issues.push('lowercase');
  if (!/[A-Z]/.test(password)) issues.push('uppercase');
  if (!/\d/.test(password)) issues.push('digit');
  if (!/[^A-Za-z0-9]/.test(password)) issues.push('symbol');

  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password) && /\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  return { score: Math.min(score, 4) as PasswordStrength['score'], issues };
}
