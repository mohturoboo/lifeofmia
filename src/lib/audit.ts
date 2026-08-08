import { prisma } from '@/lib/prisma';
import { stringifyJson } from '@/lib/json';

/**
 * Journalisation des actions sensibles.
 *
 * Utile pour la tracabilite RGPD et pour l'analyse d'incident : connexions,
 * changements de mot de passe, exports, suppressions et actions ecrites par
 * l'agent IA y sont consignes.
 *
 * L'ecriture ne doit jamais faire echouer l'action metier : toute erreur est
 * avalee volontairement.
 */

export type AuditAction =
  | 'REGISTER'
  | 'LOGIN'
  | 'LOGIN_FAILED'
  | 'LOGOUT'
  | 'PASSWORD_RESET_REQUEST'
  | 'PASSWORD_RESET'
  | 'PASSWORD_CHANGE'
  | 'EMAIL_VERIFIED'
  | 'PROFILE_UPDATE'
  | 'DATA_EXPORT'
  | 'DELETE_ACCOUNT'
  | 'AI_ACTION';

export async function audit(options: {
  action: AuditAction;
  userId?: string | null;
  entity?: string;
  entityId?: string;
  headers?: Headers;
  meta?: Record<string, unknown>;
}): Promise<void> {
  try {
    const ip =
      options.headers?.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      options.headers?.get('x-real-ip') ??
      null;

    await prisma.auditLog.create({
      data: {
        userId: options.userId ?? null,
        action: options.action,
        entity: options.entity ?? null,
        entityId: options.entityId ?? null,
        ip,
        userAgent: options.headers?.get('user-agent')?.slice(0, 255) ?? null,
        meta: options.meta ? stringifyJson(options.meta) : null,
      },
    });
  } catch {
    // La journalisation est un service auxiliaire : son echec est silencieux.
  }
}
