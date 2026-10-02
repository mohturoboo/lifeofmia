import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import { createTranslator, resolveLocale } from '@/i18n';
import { Icon, type IconName } from '@/components/ui/icons';
import { RevealOnScroll } from '@/components/ui/reveal-on-scroll';
import { ALL_NAV_ITEMS } from '@/components/app-shell/navigation';
import { LOCALES } from '@/i18n/config';

/**
 * Page d'accueil publique.
 *
 * Rendue cote serveur et statique : aucun JavaScript client n'est necessaire
 * pour l'afficher, ce qui donne un premier chargement quasi instantane.
 * Un visiteur deja connecte est redirige vers son tableau de bord.
 */
export default async function LandingPage() {
  const user = await getCurrentUser().catch(() => null);
  if (user) redirect('/dashboard');

  const t = createTranslator(resolveLocale('fr'));

  const features: Array<{ icon: IconName; title: string; text: string; color: string }> = [
    { icon: 'flame', title: t('landing.f1Title'), text: t('landing.f1Text'), color: '#fbc7da' },
    { icon: 'scale', title: t('landing.f2Title'), text: t('landing.f2Text'), color: '#f6d9e4' },
    { icon: 'target', title: t('landing.f3Title'), text: t('landing.f3Text'), color: '#d9c7f0' },
    { icon: 'moon', title: t('landing.f4Title'), text: t('landing.f4Text'), color: '#dcc7ea' },
    { icon: 'compare', title: t('landing.f5Title'), text: t('landing.f5Text'), color: '#e6e6e6' },
    { icon: 'sparkles', title: t('landing.f6Title'), text: t('landing.f6Text'), color: '#ff9fbf' },
  ];

  return (
    <div className="relative min-h-dvh overflow-hidden bg-[var(--bg)]">
      {/* --- En-tete --- */}
      <header className="relative z-20 mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-xl lm-gradient-bg text-[var(--on-pink)]">
            <Icon name="zap" size={19} />
          </span>
          <span className="text-lg font-semibold tracking-tight text-[var(--text)]">LifeofM</span>
        </Link>

        <nav className="flex items-center gap-2">
          <Link
            href="/login"
            className="rounded-xl px-4 py-2.5 text-sm font-medium text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
          >
            {t('auth.login')}
          </Link>
          <Link
            href="/register"
            className="rounded-full lm-gradient-bg px-5 py-2.5 text-sm font-medium shadow-[0_6px_18px_-10px_rgba(0,0,0,0.6)] lm-transition-ui hover:brightness-110 active:scale-[0.985]"
          >
            {t('landing.cta')}
          </Link>
        </nav>
      </header>

      {/* --- Section heros --- */}
      <main id="main">
        <section className="relative mx-auto max-w-6xl px-5 pb-24 pt-12 sm:px-8 sm:pt-20">
          <div className="lm-aura" aria-hidden="true" />

          <div className="relative grid items-center gap-14 lg:grid-cols-[1.05fr_1fr]">
            <div className="animate-[lm-entree_0.6s_cubic-bezier(0.22,1,0.36,1)_both]">
              <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3.5 py-1.5 text-xs text-[var(--text-muted)]">
                <span className="size-1.5 rounded-full bg-brand-500" />
                {t('app.tagline')}
              </span>

              <h1 className="mt-6 text-balance text-[2.6rem] font-semibold leading-[1.05] tracking-tight text-[var(--text)] sm:text-6xl">
                {t('landing.heroTitle')}
              </h1>

              <p className="mt-5 max-w-xl text-pretty text-[15px] leading-relaxed text-[var(--text-muted)] sm:text-base">
                {t('landing.heroSubtitle')}
              </p>

              <div className="mt-9 flex flex-wrap items-center gap-3">
                <Link
                  href="/register"
                  className="inline-flex h-13 items-center gap-2 rounded-full lm-gradient-bg px-7 text-[15px] font-medium shadow-[0_10px_28px_-12px_rgba(0,0,0,0.55)] lm-transition-ui hover:brightness-110 active:scale-[0.985]"
                >
                  {t('landing.cta')}
                  <Icon name="chevronRight" size={17} className="rtl:rotate-180" />
                </Link>
                <Link
                  href="/login"
                  className="inline-flex h-13 items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-6 text-[15px] font-medium text-[var(--text)] lm-transition-ui hover:border-brand-300/40 hover:bg-[var(--surface-2)] active:scale-[0.985]"
                >
                  {t('landing.ctaSecondary')}
                </Link>
              </div>

              <dl className="mt-12 flex flex-wrap gap-x-10 gap-y-4">
                {/* Chiffres derives du code, jamais saisis a la main. */}
                {[
                  { value: ALL_NAV_ITEMS.length, label: t('landing.statModules', { count: ALL_NAV_ITEMS.length }) },
                  { value: LOCALES.length, label: t('landing.statLanguages', { count: LOCALES.length }) },
                ].map((stat) => (
                  <div key={stat.label}>
                    <dt className="text-2xl font-semibold text-[var(--text)]">{stat.value}</dt>
                    <dd className="text-xs text-[var(--text-faint)]">{stat.label}</dd>
                  </div>
                ))}
              </dl>
            </div>

            {/* Apercu de l'interface — construit en HTML, pas une capture d'ecran :
                il reste net sur tous les ecrans et suit le theme actif. Il
                n'affiche ni nom, ni chiffre, ni reponse d'IA : rien qui puisse
                passer pour une donnee reelle. */}
            <div className="relative animate-[lm-entree_0.8s_cubic-bezier(0.22,1,0.36,1)_both]">
              <div className="lm-card overflow-hidden p-5">
                <div className="flex items-center justify-between">
                  <p className="text-lg font-semibold text-[var(--text)]">{t('landing.previewTitle')}</p>
                  <span className="rounded-full bg-brand-500/12 px-2.5 py-1 text-[11px] font-medium text-[var(--brand-text)]">
                    {t('landing.previewLabel')}
                  </span>
                </div>

                <div className="mt-5 grid grid-cols-3 gap-2.5">
                  {[
                    { label: t('dash.disciplineScore'), color: '#fbc7da' },
                    { label: t('dash.habitsDone'), color: '#e9b8d5' },
                    { label: t('dash.tasksDone'), color: '#f6d9e4' },
                  ].map((tile) => (
                    <div key={tile.label} className="rounded-xl bg-[var(--surface-2)] p-3">
                      <p className="text-[11px] text-[var(--text-muted)]">{tile.label}</p>
                      {/* Valeur neutre : une jauge sans chiffre. */}
                      <span
                        aria-hidden="true"
                        className="mt-2.5 block h-1.5 rounded-full"
                        style={{ background: tile.color }}
                      />
                    </div>
                  ))}
                </div>

                <div className="mt-4 space-y-2">
                  {[
                    { name: t('landing.previewHabitPrayer'), done: true, color: '#dcc7ea' },
                    { name: t('landing.previewHabitReading'), done: true, color: '#d9c7f0' },
                    { name: t('landing.previewHabitSport'), done: false, color: '#ff9fbf' },
                  ].map((habit) => (
                    <div
                      key={habit.name}
                      className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5"
                    >
                      <span
                        className="grid size-6 place-items-center rounded-lg text-[var(--on-pink)]"
                        style={{ background: habit.done ? habit.color : 'var(--border-strong)' }}
                      >
                        {habit.done && <Icon name="check" size={13} />}
                      </span>
                      <span
                        className={`text-[13px] ${habit.done ? 'text-[var(--text-muted)] line-through' : 'text-[var(--text)]'}`}
                      >
                        {habit.name}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3.5">
                  <div className="flex items-center gap-2">
                    <span className="grid size-6 place-items-center rounded-lg lm-gradient-bg text-[var(--on-pink)]">
                      <Icon name="sparkles" size={13} />
                    </span>
                    <span className="text-[11px] font-medium text-[var(--text-muted)]">{t('nav.ai')}</span>
                  </div>
                  <p className="mt-2 text-[13px] leading-relaxed text-[var(--text-muted)]">{t('ai.subtitle')}</p>
                </div>
              </div>

              <div
                className="absolute -inset-6 -z-10 rounded-[2.5rem] opacity-60 blur-3xl"
                style={{
                  background:
                    'radial-gradient(circle at 60% 40%, color-mix(in srgb, var(--color-brand-300) 18%, transparent), transparent 70%)',
                }}
                aria-hidden="true"
              />
            </div>
          </div>
        </section>

        {/* --- Fonctionnalites --- */}
        <section className="mx-auto max-w-6xl px-5 pb-24 sm:px-8">
          <h2 className="font-display text-balance text-center text-3xl font-semibold tracking-tight text-[var(--text)] sm:text-4xl">
            {t('landing.featuresTitle')}
          </h2>

          <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, index) => (
              <article key={feature.title} data-reveal={index % 3} className="lm-card lm-card-hover group p-6">
                <span
                  className="grid size-11 place-items-center rounded-2xl transition-transform duration-300 group-hover:scale-110"
                  style={{ background: `${feature.color}1f`, color: feature.color }}
                >
                  <Icon name={feature.icon} size={21} />
                </span>
                <h3 className="mt-4 text-base font-semibold text-[var(--text)]">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">{feature.text}</p>
              </article>
            ))}
          </div>
        </section>

        {/* --- Confidentialite --- */}
        <section className="mx-auto max-w-6xl px-5 pb-24 sm:px-8">
          <div data-reveal className="lm-card relative overflow-hidden p-8 text-center sm:p-14">
            <div className="lm-aura opacity-70" aria-hidden="true" />
            <div className="relative">
              <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#f6d9e4]/12 text-[#f6d9e4]">
                <Icon name="shield" size={23} />
              </span>
              <h2 className="font-display mt-5 text-2xl font-semibold text-[var(--text)] sm:text-3xl">
                {t('landing.privacyTitle')}
              </h2>
              <p className="mx-auto mt-3 max-w-2xl text-pretty text-sm leading-relaxed text-[var(--text-muted)]">
                {t('landing.privacyText')}
              </p>
              <Link
                href="/register"
                className="mt-8 inline-flex h-12 items-center gap-2 rounded-full lm-gradient-bg px-7 text-sm font-medium lm-transition-ui hover:brightness-110 active:scale-[0.985]"
              >
                {t('landing.cta')}
                <Icon name="chevronRight" size={16} className="rtl:rotate-180" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <RevealOnScroll />
      <footer className="border-t border-[var(--border)]">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-5 py-8 text-xs text-[var(--text-faint)] sm:flex-row sm:px-8">
          <p>
            © {new Date().getFullYear()} LifeofM. {t('landing.footerRights')}
          </p>
          <p>{t('app.tagline')}</p>
        </div>
      </footer>
    </div>
  );
}
