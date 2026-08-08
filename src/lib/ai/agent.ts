import Anthropic from '@anthropic-ai/sdk';
import { env, isAiEnabled } from '@/lib/env';
import { buildUserContext, systemPrompt } from '@/lib/ai/context';
import { executeTool, TOOL_DEFINITIONS, type ToolResult } from '@/lib/ai/tools';
import type { SessionUser } from '@/lib/auth/session';

/**
 * Boucle agentique de Life AI.
 *
 * Le modele peut demander l'execution d'outils ; on les execute, on lui renvoie
 * les resultats, et on recommence jusqu'a ce qu'il produise une reponse finale.
 * `MAX_TURNS` borne cette boucle : sans plafond, une erreur d'outil repetee
 * pourrait la faire tourner indefiniment et facturer sans fin.
 */

const MAX_TURNS = 6;
const MAX_TOKENS = 2048;

export interface AgentAction {
  tool: string;
  summary: string;
  ok: boolean;
}

export interface AgentResponse {
  text: string;
  actions: AgentAction[];
  tokensIn: number;
  tokensOut: number;
}

export interface AgentMessage {
  role: 'user' | 'assistant';
  content: string;
}

let client: Anthropic | null = null;
function anthropic(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: env.anthropicApiKey });
  return client;
}

export class AiDisabledError extends Error {
  constructor() {
    super('AI_DISABLED');
    this.name = 'AiDisabledError';
  }
}

/**
 * Traite un message utilisateur.
 * `history` contient les echanges precedents de la conversation (deja tronques
 * par l'appelant) ; le contexte de donnees est reconstruit a chaque appel pour
 * que l'agent voie toujours l'etat reel, y compris ses propres modifications.
 */
export async function runAgent(
  user: SessionUser,
  message: string,
  history: AgentMessage[] = [],
): Promise<AgentResponse> {
  if (!isAiEnabled()) throw new AiDisabledError();

  const context = await buildUserContext(user);
  const system = systemPrompt(context, user.locale);

  const messages: Anthropic.MessageParam[] = [
    ...history.map((entry) => ({ role: entry.role, content: entry.content })),
    { role: 'user' as const, content: message },
  ];

  const actions: AgentAction[] = [];
  let tokensIn = 0;
  let tokensOut = 0;
  let finalText = '';

  for (let turn = 0; turn < MAX_TURNS; turn += 1) {
    const response = await anthropic().messages.create({
      model: env.aiModel,
      max_tokens: MAX_TOKENS,
      system,
      tools: TOOL_DEFINITIONS as unknown as Anthropic.Tool[],
      messages,
    });

    tokensIn += response.usage.input_tokens;
    tokensOut += response.usage.output_tokens;

    const textParts = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text);
    if (textParts.length > 0) finalText = textParts.join('\n\n');

    const toolUses = response.content.filter(
      (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use',
    );

    // Pas d'outil demande : le modele a termine.
    if (toolUses.length === 0) break;

    messages.push({ role: 'assistant', content: response.content });

    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const toolUse of toolUses) {
      const result: ToolResult = await executeTool(
        user,
        toolUse.name,
        (toolUse.input ?? {}) as Record<string, unknown>,
      );

      actions.push({ tool: toolUse.name, summary: result.summary, ok: result.ok });
      results.push({
        type: 'tool_result',
        tool_use_id: toolUse.id,
        is_error: !result.ok,
        content: JSON.stringify({ ok: result.ok, summary: result.summary, data: result.data ?? null }),
      });
    }

    messages.push({ role: 'user', content: results });
  }

  if (!finalText) {
    finalText =
      actions.length > 0
        ? `J'ai effectue ${actions.length} action(s) :\n${actions.map((action) => `- ${action.summary}`).join('\n')}`
        : "Je n'ai pas pu produire de reponse. Reformulez votre demande.";
  }

  return { text: finalText, actions, tokensIn, tokensOut };
}

/** Resume la journee d'un utilisateur a partir de son entree de journal. */
export async function summarizeJournal(
  user: SessionUser,
  entry: { date: string; mood: number; energy: number; content: string },
): Promise<string> {
  if (!isAiEnabled()) throw new AiDisabledError();

  const response = await anthropic().messages.create({
    model: env.aiModel,
    max_tokens: 400,
    system:
      "Tu resumes la journee d'un utilisateur a partir de son journal personnel. Trois a quatre phrases maximum : ce qui s'est passe, l'etat d'esprit, et un point d'attention bienveillant pour demain. Pas de liste a puces, pas de titre.",
    messages: [
      {
        role: 'user',
        content: `Date : ${entry.date}\nHumeur : ${entry.mood}/5\nEnergie : ${entry.energy}/5\n\n${entry.content}`,
      },
    ],
  });

  const text = response.content.find(
    (block): block is Anthropic.TextBlock => block.type === 'text',
  );
  return text?.text ?? '';
}
