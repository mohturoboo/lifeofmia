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

/*
 * La session vient du projet « compte » (voir playwright.config.ts) : un compte
 * neuf par execution, partage par tous les tests, supprime a la fin.
 */
test.beforeEach(async ({ page }) => {
  // Toute reponse d'erreur du serveur est remontee dans le rapport : sans ca,
  // un 400 silencieux ressemblerait a un simple probleme d'affichage.
  page.on('response', (r) => {
    if (r.status() >= 400 && r.url().includes('/api/')) {
      console.error(`  reponse ${r.status()} sur ${new URL(r.url()).pathname}`);
    }
  });
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

/**
 * Remet l'hydratation du jour a zero.
 *
 * Tous les tests partagent un meme compte : sans cette remise a plat, le total
 * depend de l'ordre d'execution des fichiers, et un test qui suppose « 0 ml au
 * depart » echoue selon ce qui a tourne avant lui.
 *
 * La date est calculee DANS la page : l'application utilise le fuseau du
 * navigateur, qui ne coincide pas forcement avec celui de la machine de test.
 */
async function remettreAZero(page: Page) {
  await page.goto('/nutrition');
  const jour = await page.evaluate(() => new Date().toLocaleDateString('sv'));
  const journee = await page.request.get(`/api/meals?date=${jour}`);
  const { data } = (await journee.json()) as { data?: { waterMl?: number } };
  const restant = data?.waterMl ?? 0;
  if (restant === 0) return;

  await page.request.post('/api/water', { data: { date: jour, amountMl: -restant } });

  /*
   * On confirme que la remise a zero a bien atterri avant de continuer.
   * Sans cette verification, le test enchaine parfois sur une page qui lit
   * encore l'ancien total, et echoue une fois sur plusieurs sans rien dire
   * du code teste.
   */
  await expect
    .poll(async () => {
      const controle = await page.request.get(`/api/meals?date=${jour}`);
      const { data: apres } = (await controle.json()) as { data?: { waterMl?: number } };
      return apres?.waterMl ?? 0;
    }, { timeout: 10_000 })
    .toBe(0);
}

test('un verre d\'eau ajoute survit au rechargement', async ({ page }) => {
  await page.goto('/nutrition');

  await remettreAZero(page);

  const total = page.getByTestId('hydratation-total');
  await expect(total).toHaveText('0 ml');

  await page.getByRole('button', { name: 'Ajouter un verre' }).click();
  await expect(total).toHaveText('250 ml');

  await page.reload();
  await expect(total).toHaveText('250 ml');
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
