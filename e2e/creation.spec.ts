import { test, expect, type Page } from '@playwright/test';

/**
 * Les cinq flux de creation signales comme « non persistants ».
 *
 * Chaque test suit le meme protocole que le rapport de test :
 *   remplir → enregistrer → RECHARGER LA PAGE → verifier que la donnee est la.
 *
 * Le rechargement est le coeur du test : il elimine tout ce qui n'est
 * qu'affichage optimiste en memoire et ne prouve la persistance qu'a partir de
 * ce qui revient reellement du serveur.
 */

const MOT_DE_PASSE = 'MotDePasse1';

/** Cree un compte neuf et ouvre la session, par l'API pour aller au fait. */
async function connecterCompteNeuf(page: Page): Promise<string> {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@lifeofm.test`;

  const reponse = await page.request.post('/api/auth/register', {
    data: {
      email,
      password: MOT_DE_PASSE,
      firstName: 'Test',
      lastName: 'E2E',
      country: 'France',
      city: 'Paris',
      timezone: 'Europe/Paris',
      locale: 'fr',
      acceptTerms: true,
    },
  });
  expect(reponse.status(), await reponse.text()).toBe(201);
  return email;
}

/** Supprime le compte de test et tout ce qui en depend. */
async function supprimerCompte(page: Page) {
  await page.request.delete('/api/profile').catch(() => undefined);
}

test.beforeEach(async ({ page }) => {
  await connecterCompteNeuf(page);
  // Toute reponse d'erreur du serveur est remontee dans le rapport : sans ca,
  // un 400 silencieux ressemblerait a un simple probleme d'affichage.
  page.on('response', (r) => {
    if (r.status() >= 400 && r.url().includes('/api/')) {
      console.error(`  reponse ${r.status()} sur ${new URL(r.url()).pathname}`);
    }
  });
});

test.afterEach(async ({ page }) => {
  await supprimerCompte(page);
});

test('une tache creee survit au rechargement', async ({ page }) => {
  await page.goto('/tasks');

  await page.getByRole('button', { name: 'Nouvelle tache' }).click();
  const fenetre = page.getByRole('dialog');
  await expect(fenetre).toBeVisible();

  await fenetre.getByLabel('Titre').fill('Tache E2E');
  await fenetre.getByRole('button', { name: 'Enregistrer' }).click();

  await expect(fenetre).toBeHidden();
  await expect(page.getByText('Tache E2E')).toBeVisible();

  await page.reload();
  await expect(page.getByText('Tache E2E')).toBeVisible();
});

test('une operation financiere creee survit au rechargement', async ({ page }) => {
  await page.goto('/finance');

  // La page propose ce bouton deux fois : dans l'en-tete et dans l'etat vide.
  await page.getByRole('button', { name: /Nouvelle op/ }).first().click();
  const fenetre = page.getByRole('dialog');
  await expect(fenetre).toBeVisible();

  await fenetre.getByLabel('Libelle').fill('Courses E2E');
  await fenetre.getByLabel('Montant').fill('42');
  await fenetre.getByRole('button', { name: 'Enregistrer' }).click();

  await expect(fenetre).toBeHidden();

  await page.reload();
  await expect(page.getByText('Courses E2E')).toBeVisible();
  // Le total doit avoir suivi : une ligne affichee sans total mis a jour
  // signalerait un recalcul serveur manquant.
  await expect(page.getByText('42', { exact: false }).first()).toBeVisible();
});

test('un repas ajoute survit au rechargement', async ({ page }) => {
  await page.goto('/nutrition');

  await page.getByRole('button', { name: 'Ajouter un repas' }).first().click();
  const fenetre = page.getByRole('dialog');
  await expect(fenetre).toBeVisible();

  await fenetre.getByLabel('Nom').fill('Omelette E2E');
  await fenetre.getByLabel(/Calories/).fill('420');
  await fenetre.getByRole('button', { name: 'Enregistrer' }).click();

  await expect(fenetre).toBeHidden();

  await page.reload();
  await expect(page.getByText('Omelette E2E')).toBeVisible();
  await expect(page.getByText('420 kcal').first()).toBeVisible();
});

test('un verre d\'eau ajoute survit au rechargement', async ({ page }) => {
  await page.goto('/nutrition');

  const total = page.locator('p').filter({ hasText: /^[\d.,]+\s*L$/ }).first();
  await expect(total).toHaveText(/0[.,]0\s*L/);

  await page.getByRole('button', { name: 'Ajouter un verre' }).click();
  await expect(total).toHaveText(/0[.,]3\s*L/);

  await page.reload();
  await expect(total).toHaveText(/0[.,]3\s*L/);
});

test('une priere marquee accomplie survit au rechargement', async ({ page }) => {
  await page.goto('/prayers');

  const compteur = page.getByText(/\d\s*\/\s*5/).first();
  await expect(compteur).toHaveText(/0\s*\/\s*5/);

  await page.getByRole('button', { name: 'Accomplie — Fajr' }).click();
  await expect(compteur).toHaveText(/1\s*\/\s*5/);

  await page.reload();
  await expect(compteur).toHaveText(/1\s*\/\s*5/);
});
