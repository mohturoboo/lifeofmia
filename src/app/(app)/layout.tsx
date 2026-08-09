import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { resolveLocale } from '@/i18n/config';
import { I18nProvider } from '@/i18n/provider';
import { ThemeProvider, type Theme } from '@/components/theme-provider';
import { ToastProvider } from '@/components/ui/toast';
import { AppShell } from '@/components/app-shell/shell';

/**
 * Mise en page de l'espace connecte.
 *
 * Le garde d'authentification est double : le middleware redirige tot (sans
 * toucher a la base), et cette verification serveur confirme que la session
 * n'a pas ete revoquee entre-temps.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  return (
    <ThemeProvider initialTheme={(user.theme ?? 'dark') as Theme}>
      <I18nProvider initialLocale={resolveLocale(user.locale)}>
        <ToastProvider>
          <AppShell
            user={{
              firstName: user.firstName,
              lastName: user.lastName,
              email: user.email,
              avatarUrl: user.avatarUrl,
              xp: user.xp,
              level: user.level,
              currentStreak: user.currentStreak,
            }}
          >
            {children}
          </AppShell>
        </ToastProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}
