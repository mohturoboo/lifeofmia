import Link from 'next/link';
import { Icon } from '@/components/ui/icons';
import { I18nProvider } from '@/i18n/provider';
import { ToastProvider } from '@/components/ui/toast';
import { createTranslator } from '@/i18n';
import { DEFAULT_LOCALE } from '@/i18n/config';

/**
 * Mise en page des ecrans d'authentification.
 * Colonne de formulaire a gauche, panneau de marque a droite (masque sur
 * mobile pour laisser toute la place au formulaire).
 *
 * Pas de `ThemeProvider` ici : celui qui forcait le sombre reecrivait la
 * preference stockee, et un utilisateur en clair repassait en sombre a la
 * visite suivante. Le script du layout racine applique deja le theme choisi.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  // Aucune langue n'est connue avant la connexion : langue par defaut.
  const t = createTranslator(DEFAULT_LOCALE);
  return (
    <I18nProvider initialLocale={DEFAULT_LOCALE}>
      <ToastProvider>
        <div className="grid grid-cols-1 min-h-dvh lg:grid-cols-2">
          <div className="relative flex flex-col px-5 py-8 sm:px-10">
            {/* Reperes `header` / `footer` : tout le contenu visible est dans une region. */}
            <header>
              <Link href="/" className="inline-flex w-fit items-center gap-2.5">
                <span className="grid size-9 place-items-center rounded-xl lm-gradient-bg text-[var(--on-pink)]">
                  <Icon name="zap" size={19} />
                </span>
                <span className="text-lg font-semibold tracking-tight text-[var(--text)]">LifeofM</span>
              </Link>
            </header>

            <main id="main" className="flex flex-1 items-center justify-center py-10">
              <div className="w-full max-w-sm">{children}</div>
            </main>

            <footer className="text-center text-xs text-[var(--text-faint)]">
              © {new Date().getFullYear()} LifeofM
            </footer>
          </div>

          {/* Panneau decoratif — purement visuel, invisible pour les lecteurs d'ecran. */}
          <aside className="relative hidden overflow-hidden bg-[var(--bg-subtle)] lg:block" aria-hidden="true">
            <div className="lm-aura" />
            <div className="relative flex h-full flex-col justify-center px-14">
              <blockquote className="max-w-md">
                <p className="text-balance text-3xl font-semibold leading-tight tracking-tight text-[var(--text)]">
                  {t('auth.panelQuote')}
                </p>
                <footer className="mt-5 text-sm text-[var(--text-muted)]">{t('auth.panelQuoteAuthor')}</footer>
              </blockquote>

              <div className="mt-14 grid grid-cols-2 gap-3">
                {[
                  { icon: 'flame' as const, label: t('nav.habits'), color: '#fbc7da' },
                  { icon: 'target' as const, label: t('nav.goals'), color: '#d9c7f0' },
                  { icon: 'scale' as const, label: t('goals.categoryHealth'), color: '#f6d9e4' },
                  { icon: 'sparkles' as const, label: t('nav.ai'), color: '#ff9fbf' },
                ].map((item) => (
                  <div key={item.label} className="lm-card flex items-center gap-3 p-4">
                    <span
                      className="grid size-9 place-items-center rounded-xl"
                      style={{ background: `${item.color}1f`, color: item.color }}
                    >
                      <Icon name={item.icon} size={18} />
                    </span>
                    <span className="text-sm text-[var(--text)]">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </ToastProvider>
    </I18nProvider>
  );
}
