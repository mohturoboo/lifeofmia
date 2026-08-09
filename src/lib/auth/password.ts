import bcrypt from 'bcryptjs';

/** Cout bcrypt : 12 tours, compromis reconnu securite / latence en 2026. */
const SALT_ROUNDS = 12;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export { evaluatePassword } from '@/lib/auth/password-strength';
export type { PasswordStrength } from '@/lib/auth/password-strength';
