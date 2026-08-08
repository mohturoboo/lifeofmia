import type { Metadata, Viewport } from 'next';
import { Cormorant_Garamond, Jost } from 'next/font/google';
import { ThemeScript } from '@/components/theme-provider';
import { getCurrentUser } from '@/lib/auth/session';
import { resolveLocale } from '@/i18n/config';
import { directionOf } from '@/i18n/config';
import type { Theme } from '@/components/theme-provider';
import './globals.css';

/**
 * Typographie de la marque.
 *
 * Cormorant Garamond — serif a fort contraste, heritee de la Garamond : elle
 * porte les titres et donne le registre couture.
 * Jost — geometrique dans la lignee de la Futura, largement utilisee par les
 * maisons de luxe ; elle assure toute l'interface.
 *
 * `next/font` auto-heberge les fichiers : aucune requete vers Google au
 * chargement, aucun decalage de mise en page.
 */
const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  variable: '--font-cormorant',
  display: 'swap',
});

const jost = Jost({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  variable: '--font-jost',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'LifeofM — Le systeme d\'exploitation de votre vie',
    template: '%s · LifeofM',
  },
  description:
    'Habitudes, objectifs, nutrition, sport, prieres et finances reunis dans un seul espace personnel, guides par une IA.',
  applicationName: 'LifeofM',
  authors: [{ name: 'LifeofM' }],
  keywords: ['habitudes', 'productivite', 'discipline', 'objectifs', 'sante', 'prieres', 'IA'],
  robots: { index: true, follow: true },
  openGraph: {
    title: 'LifeofM',
    description: 'Reprenez le controle de votre vie.',
    type: 'website',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#0b1418' },
    { media: '(prefers-color-scheme: light)', color: '#f2f6f7' },
  ],
};

/**
 * Racine de l'application.
 *
 * La langue et le theme sont lus depuis la session cote serveur : le premier
 * rendu HTML porte deja les bons attributs `lang` / `dir`, ce qui evite un
 * changement visible apres l'hydratation et permet le rendu RTL de l'arabe.
 */
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser().catch(() => null);
  const locale = resolveLocale(user?.locale);
  const theme = (user?.theme ?? 'dark') as Theme;

  return (
    <html
      lang={locale}
      dir={directionOf(locale)}
      className={`${cormorant.variable} ${jost.variable}`}
      suppressHydrationWarning
    >
      <head>
        <ThemeScript serverTheme={theme} />
      </head>
      <body className="min-h-dvh antialiased">
        {/* Lien d'evitement : premier element focusable de la page (WCAG 2.4.1). */}
        <a
          href="#main"
          className="lm-sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-[var(--surface)] focus:px-4 focus:py-2 focus:text-sm focus:shadow-lg"
        >
          Aller au contenu principal
        </a>
        {children}
      </body>
    </html>
  );
}
