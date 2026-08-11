import { test, expect, type APIResponse } from '@playwright/test';
import { PrismaClient } from '@prisma/client';

/**
 * Resistance de la connexion au bourrage d'identifiants.
 *
 * Constat d'origine : huit `POST /api/auth/login` consecutifs avec un mauvais
 * mot de passe repondaient huit fois 401 en 4,1 secondes. Aucun 429, aucun
 * delai, aucun verrouillage — sur une application qui conserve des donnees de
 * sante, de poids, de finances, de pratique religieuse et un journal intime.
 *
 * Deux causes, pas une :
 *  - le seuil etait fixe a huit, donc le neuvieme essai seulement aurait
 *    declenche quelque chose ;
 *  - surtout, le compteur vivait dans une `Map` en memoire. Sur un
 *    hebergement sans etat, chaque instance avait la sienne et chaque
 *    demarrage a froid repartait de zero : la protection n'existait pas la ou
 *    elle comptait.
 *
 * Ce fichier ne s'execute que sur un serveur local : il consomme des compteurs
 * reels et les remet a zero ensuite, ce qui n'aurait pas de sens contre une
 * base de production partagee avec de vrais utilisateurs.
 */

const LOCAL = !process.env.E2E_BASE_URL;
test.skip(!LOCAL, 'Ce test consomme et purge des compteurs : reserve au serveur local.');

const prisma = new PrismaClient();
const debutSuite = new Date();

test.afterAll(async () => {
  /*
   * Les compteurs consommes par ce fichier sont effaces, sans quoi la
   * limitation — qui fait exactement son travail — bloquerait l'inscription du
   * compte de test a l'execution suivante.
   */
  await prisma.rateLimitHit.deleteMany({ where: { hitAt: { gte: debutSuite } } });
  await prisma.$disconnect();
});

test('la sixieme tentative sur un meme compte est refusee avec 429 et Retry-After', async ({ page }) => {
  const email = `bf-${Date.now()}@lifeofm.test`;

  const reponses = [];
  for (let essai = 0; essai < 6; essai += 1) {
    reponses.push(
      await page.request.post('/api/auth/login', {
        data: { email, password: `MauvaisMotDePasse${essai}` },
      }),
    );
  }

  const statuts = reponses.map((reponse) => reponse.status());

  // Les cinq premieres sont refusees normalement...
  expect(statuts.slice(0, 5)).toEqual([401, 401, 401, 401, 401]);
  // ...la sixieme est bloquee.
  expect(statuts[5]).toBe(429);

  const bloquee = reponses[5];
  const attente = Number(bloquee.headers()['retry-after']);
  expect(Number.isFinite(attente)).toBe(true);
  expect(attente).toBeGreaterThan(0);

  const corps = (await bloquee.json()) as { error?: { message?: string } };
  expect(corps.error?.message).toMatch(/trop de tentatives/i);
});

test('le compteur ne distingue pas une adresse connue d une adresse inconnue', async ({ page }) => {
  /*
   * Point cle : le blocage doit survenir pour une adresse INEXISTANTE aussi.
   * Un compteur qui ne se declencherait que sur les comptes reels serait
   * lui-meme un oracle d'enumeration — six tentatives suffiraient a savoir si
   * un compte existe.
   */
  const inconnue = `fantome-${Date.now()}@lifeofm.test`;

  let derniere: APIResponse | null = null;
  for (let essai = 0; essai < 6; essai += 1) {
    derniere = await page.request.post('/api/auth/login', {
      data: { email: inconnue, password: 'Peu importe1' },
    });
  }

  expect(derniere!.status()).toBe(429);
});

test('un mauvais mot de passe et un email inconnu donnent exactement la meme reponse', async ({ page }) => {
  const compte = `existe-${Date.now()}@lifeofm.test`;
  const creation = await page.request.post('/api/auth/register', {
    data: {
      email: compte,
      password: 'MotDePasse1',
      firstName: 'Test',
      lastName: 'Enum',
      country: 'France',
      city: 'Paris',
      timezone: 'Europe/Paris',
      locale: 'fr',
      acceptTerms: true,
    },
  });
  expect(creation.status()).toBe(201);

  const existant = await page.request.post('/api/auth/login', {
    data: { email: compte, password: 'MauvaisMotDePasse9' },
  });
  const inconnu = await page.request.post('/api/auth/login', {
    data: { email: `absent-${Date.now()}@lifeofm.test`, password: 'MauvaisMotDePasse9' },
  });

  expect(existant.status()).toBe(inconnu.status());
  expect(existant.status()).toBe(401);
  expect(await existant.text()).toBe(await inconnu.text());

  await prisma.user.deleteMany({ where: { email: compte } });
});

test('une connexion reussie remet les compteurs a zero', async ({ page }) => {
  const compte = `reussite-${Date.now()}@lifeofm.test`;
  const creation = await page.request.post('/api/auth/register', {
    data: {
      email: compte,
      password: 'MotDePasse1',
      firstName: 'Test',
      lastName: 'Reset',
      country: 'France',
      city: 'Paris',
      timezone: 'Europe/Paris',
      locale: 'fr',
      acceptTerms: true,
    },
  });
  expect(creation.status()).toBe(201);

  // Trois erreurs de frappe, puis la bonne saisie.
  for (let essai = 0; essai < 3; essai += 1) {
    const echec = await page.request.post('/api/auth/login', {
      data: { email: compte, password: 'Faux12345' },
    });
    expect(echec.status()).toBe(401);
  }

  const reussite = await page.request.post('/api/auth/login', {
    data: { email: compte, password: 'MotDePasse1' },
  });
  expect(reussite.ok()).toBe(true);

  /*
   * Sans remise a zero, l'utilisateur legitime qui s'est trompe trois fois
   * repartait avec deux tentatives en poche : la prochaine erreur de frappe le
   * bloquait.
   */
  const restant = await prisma.rateLimitHit.count({ where: { bucket: `login:compte:${compte}` } });
  expect(restant).toBe(0);

  const utilisateur = await prisma.user.findUnique({ where: { email: compte } });
  expect(utilisateur?.failedLoginCount).toBe(0);
  expect(utilisateur?.lockedUntil).toBeNull();

  await prisma.user.deleteMany({ where: { email: compte } });
});

test('un compte verrouille repond exactement comme une adresse inconnue', async ({ page }) => {
  const compte = `verrou-${Date.now()}@lifeofm.test`;
  const creation = await page.request.post('/api/auth/register', {
    data: {
      email: compte,
      password: 'MotDePasse1',
      firstName: 'Test',
      lastName: 'Verrou',
      country: 'France',
      city: 'Paris',
      timezone: 'Europe/Paris',
      locale: 'fr',
      acceptTerms: true,
    },
  });
  expect(creation.status()).toBe(201);

  // Cinq echecs : le compte se verrouille en base.
  for (let essai = 0; essai < 5; essai += 1) {
    await page.request.post('/api/auth/login', { data: { email: compte, password: 'Faux12345' } });
  }

  const utilisateur = await prisma.user.findUnique({ where: { email: compte } });
  expect(utilisateur?.lockedUntil).not.toBeNull();

  /*
   * LA fuite d'enumeration corrigee ici.
   *
   * Le verrouillage repondait « Compte temporairement bloque » — un message
   * qu'une adresse INEXISTANTE ne pouvait jamais declencher, puisqu'elle n'a
   * pas de compte a verrouiller. Six tentatives suffisaient donc a savoir si
   * une adresse etait enregistree, malgre tout le soin mis ailleurs a ne rien
   * reveler. Les deux reponses doivent etre indistinguables : meme code, meme
   * corps.
   */
  const inconnue = `absent-${Date.now()}@lifeofm.test`;
  for (let essai = 0; essai < 5; essai += 1) {
    await page.request.post('/api/auth/login', { data: { email: inconnue, password: 'Faux12345' } });
  }

  const verrouille = await page.request.post('/api/auth/login', {
    data: { email: compte, password: 'Faux12345' },
  });
  const fantome = await page.request.post('/api/auth/login', {
    data: { email: inconnue, password: 'Faux12345' },
  });

  expect(verrouille.status()).toBe(429);
  expect(fantome.status()).toBe(429);

  const messageVerrouille = ((await verrouille.json()) as { error?: { message?: string } }).error?.message ?? '';
  const messageFantome = ((await fantome.json()) as { error?: { message?: string } }).error?.message ?? '';

  // Les durees peuvent differer ; la FORME du message, jamais.
  expect(messageVerrouille.replace(/\d+/g, 'N')).toBe(messageFantome.replace(/\d+/g, 'N'));
  expect(messageVerrouille).not.toMatch(/compte/i);

  await prisma.user.deleteMany({ where: { email: compte } });
});

test('les echecs repetes sont journalises', async ({ page }) => {
  const inconnue = `journal-${Date.now()}@lifeofm.test`;

  await page.request.post('/api/auth/login', { data: { email: inconnue, password: 'Faux12345' } });

  const traces = await prisma.auditLog.count({
    where: { action: { in: ['LOGIN_FAILED', 'LOGIN_THROTTLED'] }, createdAt: { gte: debutSuite } },
  });
  expect(traces).toBeGreaterThan(0);
});

/*
 * Session vierge : les autres tests reutilisent le compte partage, et un
 * visiteur deja connecte est renvoye du formulaire de connexion vers son
 * tableau de bord.
 */
test.describe('interface de connexion', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('affiche l\'attente et desactive le bouton', async ({ page }) => {
  const email = `ui-${Date.now()}@lifeofm.test`;

  // On epuise le compteur du compte par l'API, plus rapide que par le clavier.
  for (let essai = 0; essai < 5; essai += 1) {
    await page.request.post('/api/auth/login', { data: { email, password: 'Faux12345' } });
  }

  await page.goto('/login');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill('Faux12345');
  await page.getByRole('button', { name: /connexion|se connecter/i }).click();

  /*
   * `.first()` : Next.js pose lui aussi un `role="alert"` sur son annonceur de
   * navigation, invisible et vide. Le premier de la page est bien celui du
   * formulaire.
   */
  await expect(page.getByRole('alert').first()).toContainText(/trop de tentatives/i);
  await expect(page.getByText(/nouvelle tentative possible dans/i)).toBeVisible();

  const bouton = page.getByRole('button', { name: /connexion|se connecter/i });
  await expect(bouton).toBeDisabled();
  });
});
