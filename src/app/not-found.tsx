import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '@/components/ui/icons';
import { createTranslator } from '@/i18n';
import { resolveLocale } from '@/i18n/config';
import { getCurrentUser } from '@/lib/auth/session';

async function traduction() {
  const user = await getCurrentUser().catch(() => null);
  return createTranslator(resolveLocale(user?.locale));
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await traduction();
  return { title: t('notFound.title'), robots: { index: false } };
}

/**
 * Page 404 : sobre, aux couleurs de la marque, dans la langue du compte.
 * L'accueil redirige un utilisateur connecte vers son tableau de bord.
 */
export default async function NotFound() {
  const t = await traduction();

  return (
    <main id="main" className="relative grid min-h-dvh place-items-center overflow-hidden bg-[var(--bg)] px-5">
      <div className="lm-aura" aria-hidden="true" />
      <div className="relative max-w-md text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-2xl lm-gradient-bg text-[var(--on-pink)]">
          <Icon name="zap" size={22} />
        </span>
        <p className="lm-eyebrow mt-8">404</p>
        <h1 className="mt-3 text-balance text-4xl font-semibold tracking-tight text-[var(--text)]">
          {t('notFound.title')}
        </h1>
        <p className="mt-4 text-pretty text-sm leading-relaxed text-[var(--text-muted)]">{t('notFound.text')}</p>
        <Link
          href="/"
          className="mt-8 inline-flex h-11 items-center gap-2 rounded-full lm-gradient-bg px-6 text-[13.5px] font-medium tracking-[0.03em] text-[var(--on-pink)] transition-[filter] hover:brightness-[1.04]"
        >
          {t('notFound.home')}
        </Link>
      </div>
    </main>
  );
}
