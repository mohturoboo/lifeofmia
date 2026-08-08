'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState, type ReactNode } from 'react';
import { Icon } from '@/components/ui/icons';
import { cx } from '@/components/ui/primitives';
import { MOBILE_NAV, NAV_SECTIONS } from '@/components/app-shell/navigation';
import { useI18n } from '@/i18n/provider';
import { useTheme } from '@/components/theme-provider';
import { LOCALES, LOCALE_META, type Locale } from '@/i18n/config';
import { levelProgress } from '@/lib/gamification';
import { api } from '@/lib/client/api';

/**
 * Coquille applicative.
 *
 * Trois zones : barre laterale fixe (>= lg), en-tete compact, et barre de
 * navigation basse sur mobile. La barre laterale devient un tiroir sur petit
 * ecran, ferme automatiquement a chaque changement de page.
 */

export interface ShellUser {
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl: string | null;
  xp: number;
  level: number;
  currentStreak: number;
  emailVerified: boolean;
}

export function AppShell({ user, children }: { user: ShellUser; children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { t, locale, setLocale } = useI18n();
  const { resolved, setTheme } = useTheme();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // Toute navigation referme les surcouches ouvertes.
  useEffect(() => {
    setDrawerOpen(false);
    setMenuOpen(false);
  }, [pathname]);

  const progress = levelProgress(user.xp);
  const initials = `${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}`.toUpperCase();

  async function logout() {
    await api.post('/api/auth/logout').catch(() => undefined);
    router.refresh();
    router.push('/login');
  }

  const sidebar = (
    <div className="flex h-full flex-col">
      <Link href="/dashboard" className="flex items-center gap-2.5 px-4 py-5">
        <span className="grid size-9 place-items-center rounded-xl lm-gradient-bg text-[var(--on-glow)]">
          <Icon name="zap" size={19} />
        </span>
        <span className="text-[17px] font-semibold tracking-tight text-[var(--text)]">LifeofM</span>
      </Link>

      <nav className="min-h-0 flex-1 overflow-y-auto px-3 pb-4" aria-label="Navigation principale">
        {NAV_SECTIONS.map((section) => (
          <div key={section.titleKey} className="mb-5">
            <h2 className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-faint)]">
              {t(section.titleKey)}
            </h2>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      className={cx(
                        'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] transition-colors',
                        active
                          ? 'bg-[var(--surface-2)] font-medium text-[var(--text)]'
                          : 'text-[var(--text-muted)] hover:bg-[var(--surface-2)]/60 hover:text-[var(--text)]',
                      )}
                    >
                      {active && (
                        <motion.span
                          layoutId="nav-active"
                          className="absolute inset-y-1.5 start-0 w-[3px] rounded-full"
                          style={{ background: item.color }}
                        />
                      )}
                      <span style={{ color: active ? item.color : undefined }}>
                        <Icon name={item.icon} size={17} />
                      </span>
                      {t(item.labelKey)}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Progression de niveau, toujours visible en bas de la barre. */}
      <div className="border-t border-[var(--border)] p-3">
        <Link href="/settings" className="block rounded-xl p-3 transition-colors hover:bg-[var(--surface-2)]">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-[var(--text)]">
              {t('dash.level')} {progress.level}
            </span>
            <span className="text-[var(--text-faint)]">
              {progress.intoLevel}/{progress.nextLevelXp - progress.currentLevelXp} XP
            </span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--surface-2)]">
            <div className="h-full rounded-full lm-gradient-bg transition-[width] duration-700" style={{ width: `${progress.percent}%` }} />
          </div>
        </Link>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-dvh bg-[var(--bg)]">
      {/* --- Barre laterale (bureau) --- */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 border-e border-[var(--border)] bg-[var(--bg-subtle)] lg:block">
        {sidebar}
      </aside>

      {/* --- Tiroir (mobile) --- */}
      <AnimatePresence>
        {drawerOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDrawerOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 320 }}
              className="absolute inset-y-0 start-0 w-72 border-e border-[var(--border)] bg-[var(--bg-subtle)] rtl:end-0 rtl:start-auto"
            >
              {sidebar}
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* --- En-tete --- */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-[var(--border)] bg-[var(--bg)]/85 px-4 backdrop-blur-xl sm:px-6">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Ouvrir le menu"
            className="grid size-9 place-items-center rounded-xl text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-2)] lg:hidden"
          >
            <Icon name="menu" size={19} />
          </button>

          <div className="flex-1" />

          {user.currentStreak > 0 && (
            <span className="hidden items-center gap-1.5 rounded-full bg-[#d99a63]/12 px-3 py-1.5 text-xs font-medium text-[#d99a63] sm:inline-flex">
              <Icon name="flame" size={14} />
              {user.currentStreak} {t('common.days')}
            </span>
          )}

          {/* Selecteur de langue */}
          <label className="relative">
            <span className="lm-sr-only">{t('auth.language')}</span>
            <select
              value={locale}
              onChange={(event) => setLocale(event.target.value as Locale)}
              className="h-9 cursor-pointer appearance-none rounded-xl border border-[var(--border)] bg-[var(--surface)] ps-3 pe-7 text-xs text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
            >
              {LOCALES.map((code) => (
                <option key={code} value={code}>
                  {LOCALE_META[code].flag} {code.toUpperCase()}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={() => setTheme(resolved === 'dark' ? 'light' : 'dark')}
            aria-label={t('settings.theme')}
            className="grid size-9 place-items-center rounded-xl text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
          >
            <Icon name={resolved === 'dark' ? 'sun' : 'moon'} size={18} />
          </button>

          {/* Menu utilisateur */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((value) => !value)}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              className="grid size-9 place-items-center rounded-full lm-gradient-bg text-[13px] font-semibold"
            >
              {initials || <Icon name="user" size={17} />}
            </button>

            <AnimatePresence>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} aria-hidden="true" />
                  <motion.div
                    role="menu"
                    initial={{ opacity: 0, y: -8, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.97 }}
                    transition={{ duration: 0.14 }}
                    className="absolute end-0 z-20 mt-2 w-60 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl"
                  >
                    <div className="border-b border-[var(--border)] px-4 py-3">
                      <p className="truncate text-sm font-medium text-[var(--text)]">
                        {user.firstName} {user.lastName}
                      </p>
                      <p className="truncate text-xs text-[var(--text-faint)]">{user.email}</p>
                    </div>

                    {!user.emailVerified && (
                      <div className="border-b border-[var(--border)] bg-[#d99a63]/8 px-4 py-2.5">
                        <p className="text-[11px] leading-relaxed text-[#d99a63]">{t('auth.verifyPending')}</p>
                      </div>
                    )}

                    <Link
                      href="/settings"
                      role="menuitem"
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
                    >
                      <Icon name="settings" size={16} />
                      {t('nav.settings')}
                    </Link>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={logout}
                      className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-red-500 transition-colors hover:bg-red-500/8"
                    >
                      <Icon name="logout" size={16} />
                      {t('nav.logout')}
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </header>

        <main id="main" className="min-w-0 flex-1 px-4 pb-24 pt-6 sm:px-6 lg:pb-10">
          {children}
        </main>
      </div>

      {/* --- Navigation basse (mobile) --- */}
      <nav
        aria-label="Navigation rapide"
        className="fixed inset-x-0 bottom-0 z-30 flex border-t border-[var(--border)] bg-[var(--bg)]/92 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
      >
        {MOBILE_NAV.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className="flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] transition-colors"
              style={{ color: active ? item.color : 'var(--text-faint)' }}
            >
              <Icon name={item.icon} size={20} />
              {t(item.labelKey)}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
