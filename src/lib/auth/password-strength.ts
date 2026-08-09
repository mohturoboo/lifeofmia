/**
 * Evaluation de la robustesse d'un mot de passe.
 *
 * Module sans dependance : la jauge est rendue pendant la saisie, cote client.
 * Tant que ce calcul cohabitait avec le hachage, les pages d'inscription et de
 * reinitialisation embarquaient bcrypt dans le bundle du navigateur.
 */

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
