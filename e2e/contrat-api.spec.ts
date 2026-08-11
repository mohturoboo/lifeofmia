import { test, expect, type APIResponse } from '@playwright/test';

/**
 * Contrat de reponse de l'API.
 *
 * Sous `/api`, une reponse HTML est toujours un bug : le prefixe promet du
 * JSON, et tout client appelle `response.json()`. Il recevait « Unexpected
 * token '<' » — un message qui parle de parsing la ou le vrai probleme est
 * « ce chemin n'existe pas » ou « cette methode n'est pas acceptee ».
 */

/** Chemins plausibles, tous nommes d'apres des pages reelles de l'application. */
const CHEMINS_INEXISTANTS = [
  '/api/calendar',
  '/api/nutrition',
  '/api/sport',
  '/api/finance',
  '/api/ai',
  '/api/settings',
  '/api/badges',
  '/api/xp',
  '/api/streak',
  '/api/export',
  '/api/sessions',
];

async function corpsJson(reponse: APIResponse): Promise<{ error?: { code?: string; message?: string } }> {
  const texte = await reponse.text();
  expect(texte.trimStart().startsWith('<'), `reponse HTML inattendue : ${texte.slice(0, 60)}`).toBe(false);
  return JSON.parse(texte);
}

test('toute route /api inexistante repond en JSON, jamais en HTML', async ({ page }) => {
  for (const chemin of CHEMINS_INEXISTANTS) {
    const reponse = await page.request.get(chemin);

    expect(reponse.status(), chemin).toBe(404);
    expect(reponse.headers()['content-type'], chemin).toContain('application/json');

    const corps = await corpsJson(reponse);
    expect(corps.error?.code, chemin).toBe('NOT_FOUND');
    // Le message nomme le chemin fautif : l'erreur se diagnostique seule.
    expect(corps.error?.message, chemin).toContain(chemin);
  }
});

test('un chemin inexistant repond en JSON quelle que soit la methode', async ({ page }) => {
  const cible = '/api/nexiste/vraiment/pas';

  for (const appel of [
    () => page.request.post(cible, { data: {} }),
    () => page.request.put(cible, { data: {} }),
    () => page.request.patch(cible, { data: {} }),
    () => page.request.delete(cible),
  ]) {
    const reponse = await appel();
    expect(reponse.status()).toBe(404);
    const corps = await corpsJson(reponse);
    expect(corps.error?.code).toBe('NOT_FOUND');
  }
});

test('les routes reelles gardent la priorite sur l attrape-tout', async ({ page }) => {
  /*
   * Verification indispensable : un attrape-tout mal place masquerait toute
   * l'API. Next.js resout un segment litteral avant un segment dynamique, et
   * ce test le prouve plutot que de le supposer.
   */
  const dashboard = await page.request.get('/api/dashboard');
  expect(dashboard.ok()).toBe(true);

  const sante = await page.request.get('/api/health');
  expect(sante.ok()).toBe(true);

  const imbriquee = await page.request.get('/api/goals');
  expect(imbriquee.ok()).toBe(true);
});

test('une methode non autorisee repond 405 en JSON avec un en-tete Allow', async ({ page }) => {
  // Le cas cite dans le rapport : GET sur une route qui n'accepte que POST.
  const reponse = await page.request.get('/api/water');

  expect(reponse.status()).toBe(405);
  expect(reponse.headers()['content-type']).toContain('application/json');

  const allow = reponse.headers()['allow'];
  expect(allow, "l'en-tete Allow est exige par la norme sur un 405").toBeTruthy();
  expect(allow).toContain('POST');

  const corps = await corpsJson(reponse);
  expect(corps.error?.code).toBe('METHOD_NOT_ALLOWED');
  // Le message dit quoi faire a la place.
  expect(corps.error?.message).toContain('POST');
});

test('le 405 couvre les autres routes et les autres methodes', async ({ page }) => {
  const cas = [
    { chemin: '/api/dashboard', methode: 'delete' as const, attendu: 'GET' },
    { chemin: '/api/stats', methode: 'post' as const, attendu: 'GET' },
    { chemin: '/api/focus', methode: 'get' as const, attendu: 'POST' },
  ];

  for (const { chemin, methode, attendu } of cas) {
    const reponse =
      methode === 'get'
        ? await page.request.get(chemin)
        : methode === 'post'
          ? await page.request.post(chemin, { data: {} })
          : await page.request.delete(chemin);

    expect(reponse.status(), chemin).toBe(405);
    expect(reponse.headers()['allow'], chemin).toContain(attendu);

    const corps = await corpsJson(reponse);
    expect(corps.error?.code, chemin).toBe('METHOD_NOT_ALLOWED');
  }
});

test('OPTIONS annonce les methodes acceptees', async ({ page }) => {
  const reponse = await page.request.fetch('/api/water', { method: 'OPTIONS' });

  expect(reponse.status()).toBe(204);
  expect(reponse.headers()['allow']).toContain('POST');
  expect(reponse.headers()['allow']).toContain('OPTIONS');
});

test('toutes les erreurs partagent la meme forme { error: { code, message } }', async ({ page }) => {
  /*
   * Point 3 du rapport : une seule forme, quel que soit le type d'echec. Un
   * client n'a alors qu'un seul chemin de lecture a ecrire.
   */
  const cas: Array<{ libelle: string; obtenir: () => Promise<APIResponse> }> = [
    { libelle: '404', obtenir: () => page.request.get('/api/inconnu') },
    { libelle: '405', obtenir: () => page.request.get('/api/water') },
    { libelle: '422', obtenir: () => page.request.post('/api/water', { data: { amountMl: 'beaucoup' } }) },
    { libelle: '404 metier', obtenir: () => page.request.delete('/api/habits/inexistant-xyz') },
  ];

  for (const { libelle, obtenir } of cas) {
    const corps = await corpsJson(await obtenir());
    expect(typeof corps.error, libelle).toBe('object');
    expect(typeof corps.error?.code, libelle).toBe('string');
    expect(typeof corps.error?.message, libelle).toBe('string');
    expect((corps.error?.message ?? '').length, libelle).toBeGreaterThan(0);
  }
});

test('les reponses n exposent pas l identifiant du proprietaire', async ({ page }) => {
  const pesee = await page.request.get('/api/weight');
  expect(pesee.ok()).toBe(true);
  const corpsPesee = await pesee.text();
  expect(corpsPesee).not.toContain('"userId"');

  const habitudes = await page.request.get('/api/habits');
  expect(habitudes.ok()).toBe(true);
  expect(await habitudes.text()).not.toContain('"userId"');

  // Y compris sur la ligne renvoyee a la creation.
  const jour = ((await (await page.request.get('/api/weight')).json()) as { data?: { today?: string } }).data?.today;
  const creation = await page.request.post('/api/weight', { data: { date: jour, weightKg: 70 } });
  expect(creation.ok()).toBe(true);
  expect(await creation.text()).not.toContain('"userId"');
});

test('robots.txt et sitemap.xml existent et ferment l espace personnel', async ({ page }) => {
  const robots = await page.request.get('/robots.txt');
  expect(robots.status()).toBe(200);
  const texteRobots = await robots.text();
  expect(texteRobots).toContain('User-Agent: *');
  expect(texteRobots).toContain('Disallow: /api/');
  expect(texteRobots).toContain('Disallow: /dashboard');
  expect(texteRobots).toContain('Sitemap:');

  const sitemap = await page.request.get('/sitemap.xml');
  expect(sitemap.status()).toBe(200);
  expect(sitemap.headers()['content-type']).toContain('xml');

  const texteSitemap = await sitemap.text();
  expect(texteSitemap).toContain('<urlset');
  expect(texteSitemap).toContain('/register');
  // Un plan de site n'est pas un inventaire : l'espace connecte n'y figure pas.
  expect(texteSitemap).not.toContain('/dashboard');
});
