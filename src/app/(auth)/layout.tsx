import Link from 'next/link';
import { Icon } from '@/components/ui/icons';
import { I18nProvider } from '@/i18n/provider';
import { ToastProvider } from '@/components/ui/toast';
import { ThemeProvider } from '@/components/theme-provider';

/**
 * Mise en page des ecrans d'authentification.
 * Colonne de formulaire a gauche, panneau de marque a droite (masque sur
 * mobile pour laisser toute la place au formulaire).
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider initialTheme="dark">
      <I18nProvider initialLocale="fr">
        <ToastProvider>
          <div className="grid min-h-dvh lg:grid-cols-2">
            <div className="relative flex flex-col px-5 py-8 sm:px-10">
              <Link href="/" className="inline-flex w-fit items-center gap-2.5">
                <span className="grid size-9 place-items-center rounded-xl lm-gradient-bg text-[var(--on-pink)]">
                  <Icon name="zap" size={19} />
                </span>
                <span className="text-lg font-semibold tracking-tight text-[var(--text)]">LifeofM</span>
              </Link>

              <main id="main" className="flex flex-1 items-center justify-center py-10">
                <div className="w-full max-w-sm">{children}</div>
              </main>

              <p className="text-center text-xs text-[var(--text-faint)]">
                © {new Date().getFullYear()} LifeofM
              </p>
            </div>

            {/* Panneau decoratif — purement visuel, invisible pour les lecteurs d'ecran. */}
            <aside
              className="relative hidden overflow-hidden bg-[var(--bg-subtle)] lg:block"
              aria-hidden="true"
            >
              <div className="lm-aura" />
              <div className="relative flex h-full flex-col justify-center px-14">
                <blockquote className="max-w-md">
                  <p className="text-balance text-3xl font-semibold leading-tight tracking-tight text-[var(--text)]">
                    « Nous sommes ce que nous faisons de maniere repetee. »
                  </p>
                  <footer className="mt-5 text-sm text-[var(--text-muted)]">Aristote</footer>
                </blockquote>

                <div className="mt-14 grid grid-cols-2 gap-3">
                  {[
                    { icon: 'flame' as const, label: 'Habitudes', color: '#fbc7da' },
                    { icon: 'target' as const, label: 'Objectifs', color: '#d9c7f0' },
                    { icon: 'scale' as const, label: 'Sante', color: '#f6d9e4' },
                    { icon: 'sparkles' as const, label: 'Life AI', color: '#ff9fbf' },
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
    </ThemeProvider>
  );
}
