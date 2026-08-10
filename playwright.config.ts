import { defineConfig, devices } from '@playwright/test';

/**
 * Tests de bout en bout des flux de creation.
 *
 * Ils s'executent contre une instance reelle : navigateur, serveur et base.
 * C'est la seule facon de verifier ce qui est reproche a ces flux — que la
 * donnee SURVIVE a un rechargement de page. Un test unitaire sur le
 * gestionnaire de clic n'aurait rien vu.
 *
 * Cible par defaut : le serveur de developpement local. `E2E_BASE_URL` permet
 * de viser un deploiement (preproduction, production).
 */
const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  // Une creation par flux, dans un compte neuf : l'ordre n'a pas d'importance,
  // mais l'execution en serie evite de saturer la base de test.
  workers: 1,
  fullyParallel: false,
  reporter: [['list']],
  use: {
    baseURL,
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    // Un seul compte pour toute l'execution : la protection anti-abus sur
    // l'inscription refuse une sixieme tentative dans l'heure, et une suite ne
    // doit pas echouer pour une raison etrangere a ce qu'elle mesure.
    { name: 'compte', testMatch: /compte\.setup\.ts/, teardown: 'nettoyage' },
    { name: 'nettoyage', testMatch: /compte\.teardown\.ts/, use: { storageState: './e2e/.auth/session.json' } },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], storageState: './e2e/.auth/session.json' },
      dependencies: ['compte'],
    },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'npm run start',
        url: 'http://localhost:3000',
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
