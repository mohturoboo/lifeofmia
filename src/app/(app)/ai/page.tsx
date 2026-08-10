'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { api, ApiClientError, useResource } from '@/lib/client/api';
import { Button, Card, Skeleton, cx } from '@/components/ui/primitives';
import { Icon } from '@/components/ui/icons';
import { PageHeader } from '@/components/page-header';
import { useI18n } from '@/i18n/provider';

interface AiMessage {
  id: string;
  role: string;
  content: string;
  toolCalls: string | null;
  createdAt: string;
}

interface ChatData {
  enabled: boolean;
  conversations: Array<{ id: string; title: string; updatedAt: string }>;
  conversation: { id: string; title: string; messages: AiMessage[] } | null;
}

interface Action {
  tool: string;
  summary: string;
  ok: boolean;
}

interface LocalMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  actions?: Action[];
}

export default function AiPage() {
  const { t } = useI18n();

  const [conversationId, setConversationId] = useState<string | null>(null);
  const { data, loading, refresh } = useResource<ChatData>(
    `/api/ai/chat${conversationId ? `?conversationId=${conversationId}` : ''}`,
    [conversationId],
  );

  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // Les messages persistes deviennent l'etat local a chaque changement de fil.
  useEffect(() => {
    if (!data?.conversation) {
      setMessages([]);
      return;
    }
    setMessages(
      data.conversation.messages.map((message) => ({
        id: message.id,
        role: message.role as 'user' | 'assistant',
        content: message.content,
        actions: message.toolCalls ? (JSON.parse(message.toolCalls) as Action[]) : undefined,
      })),
    );
  }, [data]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, thinking]);

  async function send(text: string) {
    const content = text.trim();
    if (content.length === 0 || thinking) return;

    setInput('');
    setError(null);
    setThinking(true);
    setMessages((current) => [...current, { id: `local-${Date.now()}`, role: 'user', content }]);

    try {
      const result = await api.post<{
        conversationId: string;
        message: { id: string; content: string };
        actions: Action[];
      }>('/api/ai/chat', { message: content, conversationId });

      setMessages((current) => [
        ...current,
        { id: result.message.id, role: 'assistant', content: result.message.content, actions: result.actions },
      ]);

      // La premiere reponse cree la conversation : on la memorise pour la suite.
      if (!conversationId) setConversationId(result.conversationId);
      else void refresh();
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : t('common.error'));
    } finally {
      setThinking(false);
    }
  }

  const suggestions = [t('ai.suggestion1'), t('ai.suggestion2'), t('ai.suggestion3'), t('ai.suggestion4')];

  if (loading && !data) {
    return (
      <div className="mx-auto max-w-4xl">
        <Skeleton className="h-[70vh] rounded-2xl" />
      </div>
    );
  }

  if (data && !data.enabled) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader title={t('ai.title')} subtitle={t('ai.subtitle')} icon="sparkles" color="#fbc7da" />
        <Card>
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <span className="grid size-14 place-items-center rounded-2xl bg-[#ff9fbf]/12 text-[#ff9fbf]">
              <Icon name="lock" size={24} />
            </span>
            {/*
              Aucun detail d'infrastructure ici. Le nom de la variable
              d'environnement et le format de la cle etaient affiches en clair a
              tout utilisateur connecte : c'est une consigne d'administration,
              qui n'a rien a faire dans l'interface. Elle reste dans le README
              et dans `.env.example`, a destination de qui deploie.
            */}
            <p className="text-sm font-medium text-[var(--text)]">{t('ai.disabled')}</p>
            <p className="max-w-md text-xs leading-relaxed text-[var(--text-faint)]">{t('ai.disabledHint')}</p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-[calc(100dvh-9rem)] max-w-4xl flex-col lg:h-[calc(100dvh-6.5rem)]">
      <PageHeader
        title={t('ai.title')}
        subtitle={t('ai.subtitle')}
        icon="sparkles"
        color="#fbc7da"
        actions={
          <Button
            variant="secondary"
            size="sm"
            icon="plus"
            onClick={() => {
              setConversationId(null);
              setMessages([]);
            }}
          >
            {t('ai.newChat')}
          </Button>
        }
      />

      <Card className="flex min-h-0 flex-1 flex-col" padded={false}>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-5 text-center">
              <span className="grid size-16 place-items-center rounded-3xl lm-gradient-bg text-[var(--on-pink)]">
                <Icon name="sparkles" size={28} />
              </span>
              <div>
                <p className="text-lg font-semibold text-[var(--text)]">{t('ai.title')}</p>
                <p className="mt-1 max-w-md text-sm text-[var(--text-muted)]">{t('ai.privacyNote')}</p>
              </div>

              <div className="grid grid-cols-1 w-full max-w-lg gap-2 sm:grid-cols-2">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => send(suggestion)}
                    className="rounded-xl border border-[var(--border)] px-4 py-3 text-start text-[13px] text-[var(--text-muted)] transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <AnimatePresence initial={false}>
                {messages.map((message) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cx('flex gap-3', message.role === 'user' && 'flex-row-reverse')}
                  >
                    <span
                      className={cx(
                        'grid size-8 shrink-0 place-items-center rounded-xl',
                        message.role === 'user'
                          ? 'bg-[var(--surface-2)] text-[var(--text-muted)]'
                          : 'lm-gradient-bg text-[var(--on-pink)]',
                      )}
                    >
                      <Icon name={message.role === 'user' ? 'user' : 'sparkles'} size={15} />
                    </span>

                    <div className={cx('min-w-0 max-w-[85%]', message.role === 'user' && 'text-end')}>
                      <div
                        className={cx(
                          'inline-block whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-start text-sm leading-relaxed',
                          message.role === 'user'
                            ? 'bg-[var(--surface-2)] text-[var(--text)]'
                            : 'border border-[var(--border)] text-[var(--text-muted)]',
                        )}
                      >
                        {message.content}
                      </div>

                      {message.actions && message.actions.length > 0 && (
                        <div className="mt-2 space-y-1">
                          <p className="text-[10px] uppercase tracking-wide text-[var(--text-faint)]">
                            {t('ai.actionsPerformed')}
                          </p>
                          {message.actions.map((action, index) => (
                            <div
                              key={index}
                              className="flex items-center gap-2 rounded-lg bg-[var(--surface-2)] px-2.5 py-1.5 text-[11px]"
                            >
                              <Icon
                                name={action.ok ? 'checkCircle' : 'close'}
                                size={12}
                                className={action.ok ? 'text-[#f6d9e4]' : 'text-red-500'}
                              />
                              <span className="text-[var(--text-muted)]">{action.summary}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {thinking && (
                <div className="flex gap-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-xl lm-gradient-bg text-[var(--on-pink)]">
                    <Icon name="sparkles" size={15} />
                  </span>
                  <div className="flex items-center gap-1.5 rounded-2xl border border-[var(--border)] px-4 py-3">
                    {[0, 1, 2].map((index) => (
                      <span
                        key={index}
                        className="size-1.5 animate-bounce rounded-full bg-[var(--text-faint)]"
                        style={{ animationDelay: `${index * 0.15}s` }}
                      />
                    ))}
                    <span className="ms-1 text-xs text-[var(--text-faint)]">{t('ai.thinking')}</span>
                  </div>
                </div>
              )}

              <div ref={endRef} />
            </div>
          )}
        </div>

        {error && (
          <div role="alert" className="border-t border-red-500/20 bg-red-500/8 px-5 py-2.5 text-xs text-red-500">
            {error}
          </div>
        )}

        <form
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            void send(input);
          }}
          className="flex items-end gap-2 border-t border-[var(--border)] p-3"
        >
          <label htmlFor="ai-input" className="lm-sr-only">
            {t('ai.placeholder')}
          </label>
          <textarea
            id="ai-input"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              // Entree envoie, Maj+Entree passe a la ligne.
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                void send(input);
              }
            }}
            rows={1}
            placeholder={t('ai.placeholder')}
            className="max-h-32 min-h-11 flex-1 resize-none rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3.5 py-3 text-sm text-[var(--text)] placeholder:text-[var(--text-faint)] focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
          />
          <Button type="submit" loading={thinking} disabled={input.trim().length === 0} aria-label="Envoyer">
            <Icon name="send" size={16} className="rtl:-scale-x-100" />
          </Button>
        </form>
      </Card>

      {data && data.conversations.length > 0 && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {data.conversations.slice(0, 8).map((conversation) => (
            <button
              key={conversation.id}
              type="button"
              onClick={() => setConversationId(conversation.id)}
              className={cx(
                'shrink-0 rounded-lg border px-3 py-1.5 text-[12px] transition-colors',
                conversationId === conversation.id
                  ? 'border-brand-500/40 bg-brand-500/10 text-[var(--text)]'
                  : 'border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)]',
              )}
            >
              {conversation.title}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
