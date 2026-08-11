import { z } from 'zod';
import { headers } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { route } from '@/lib/api/handler';
import { ok, fail } from '@/lib/api/response';
import { RATE_LIMITS } from '@/lib/auth/rate-limit';
import { isAiEnabled } from '@/lib/env';
import { runAgent, AiDisabledError, type AgentMessage } from '@/lib/ai/agent';
import { stringifyJson } from '@/lib/json';
import { audit } from '@/lib/audit';
import { methodeRefusee, optionsPour, type MethodeHttp } from '@/lib/api/methodes';

const chatSchema = z.object({
  message: z.string().trim().min(1, 'Message vide.').max(4000),
  conversationId: z.string().nullable().optional(),
});

/** Nombre d'echanges precedents transmis au modele (12 messages = 6 tours). */
const HISTORY_WINDOW = 12;

/** GET /api/ai/chat — conversations et messages de la conversation courante. */
export const GET = route(async ({ user, searchParams }) => {
  const conversationId = searchParams.get('conversationId');

  const conversations = await prisma.aiConversation.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: 'desc' },
    take: 30,
    select: { id: true, title: true, updatedAt: true },
  });

  const target = conversationId
    ? await prisma.aiConversation.findFirst({
        where: { id: conversationId, userId: user.id },
        include: { messages: { orderBy: { createdAt: 'asc' } } },
      })
    : null;

  return ok({
    enabled: isAiEnabled(),
    conversations,
    conversation: target,
  });
});

/**
 * POST /api/ai/chat
 *
 * Un message utilisateur, une reponse d'agent. La conversation est persistee
 * afin que l'historique survive au rechargement de la page, et la limitation de
 * debit protege le budget d'API.
 */
export const POST = route(
  async ({ user, body }) => {
    if (!isAiEnabled()) {
      // Message rendu tel quel a l'utilisateur : pas de nom de variable ni de
      // detail de configuration serveur. La marche a suivre est dans le README.
      return fail('AI_DISABLED', "Life AI n'est pas encore disponible.");
    }

    // Conversation existante (verifiee comme appartenant a l'utilisateur) ou nouvelle.
    let conversation = body.conversationId
      ? await prisma.aiConversation.findFirst({
          where: { id: body.conversationId, userId: user.id },
        })
      : null;

    if (!conversation) {
      conversation = await prisma.aiConversation.create({
        data: {
          userId: user.id,
          title: body.message.slice(0, 60) + (body.message.length > 60 ? '…' : ''),
        },
      });
    }

    const previous = await prisma.aiMessage.findMany({
      where: { conversationId: conversation.id, role: { in: ['user', 'assistant'] } },
      orderBy: { createdAt: 'desc' },
      take: HISTORY_WINDOW,
      select: { role: true, content: true },
    });

    const history: AgentMessage[] = previous
      .reverse()
      .map((entry) => ({ role: entry.role as 'user' | 'assistant', content: entry.content }));

    await prisma.aiMessage.create({
      data: { conversationId: conversation.id, role: 'user', content: body.message },
    });

    try {
      const result = await runAgent(user, body.message, history);

      const assistantMessage = await prisma.aiMessage.create({
        data: {
          conversationId: conversation.id,
          role: 'assistant',
          content: result.text,
          toolCalls: result.actions.length > 0 ? stringifyJson(result.actions) : null,
          tokensIn: result.tokensIn,
          tokensOut: result.tokensOut,
        },
      });

      await prisma.aiConversation.update({
        where: { id: conversation.id },
        data: { updatedAt: new Date() },
      });

      if (result.actions.length > 0) {
        await audit({
          action: 'AI_ACTION',
          userId: user.id,
          headers: await headers(),
          meta: { actions: result.actions },
        });
      }

      return ok({
        conversationId: conversation.id,
        message: {
          id: assistantMessage.id,
          role: 'assistant',
          content: result.text,
          createdAt: assistantMessage.createdAt,
        },
        actions: result.actions,
      });
    } catch (error) {
      if (error instanceof AiDisabledError) {
        return fail('AI_DISABLED', "L'agent IA n'est pas active.");
      }
      console.error('[ai] echec de la generation', error);
      return fail('SERVER_ERROR', "L'agent n'a pas pu repondre. Reessayez dans un instant.");
    }
  },
  { schema: chatSchema, rateLimit: { key: 'ai', ...RATE_LIMITS.ai } },
);

/** DELETE /api/ai/chat?conversationId=... */
export const DELETE = route(async ({ user, searchParams }) => {
  const conversationId = searchParams.get('conversationId');
  if (!conversationId) return fail('BAD_REQUEST', 'Identifiant de conversation requis.');

  const conversation = await prisma.aiConversation.findFirst({
    where: { id: conversationId, userId: user.id },
    select: { id: true },
  });
  if (!conversation) return fail('NOT_FOUND', 'Conversation introuvable.');

  await prisma.aiConversation.delete({ where: { id: conversation.id } });
  return ok({ deleted: true });
});

// --- Methodes non prises en charge
//
// Sans handler declare, Next.js repond en HTML sous une URL qui promet du
// JSON : le client echouait sur « Unexpected token '<' ». Le 405 porte
// desormais le meme format que toutes les autres erreurs, et l'en-tete
// `Allow` annonce ce qui est accepte.
const AUTORISEES: MethodeHttp[] = ['GET', 'POST', 'DELETE'];
export const PUT = methodeRefusee(AUTORISEES);
export const PATCH = methodeRefusee(AUTORISEES);
export const OPTIONS = optionsPour(AUTORISEES);
