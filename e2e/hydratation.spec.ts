import { test, expect, type Page } from '@playwright/test';

/**
 * Le suivi d'hydratation, de bout en bout.
 *
 * Le bouton a ete signale comme inerte. Verification faite, il emet bien sa
 * requete — mais l'affichage rendait le resultat incomprehensible : 250 ml
 * s'affichait « 0.3 L », a cause d'un arrondi au dixieme de litre. Un verre bu
 * annoncait un tiers de litre, et aucune addition ne tombait juste.
 */

/**
 * Remet l'hydratation du jour a zero.
 *
 * Tous les tests partagent un meme compte : sans cette remise a plat, le total
 * depend de l'ordre d'execution des fichiers, et un test qui suppose « 0 ml au
 * depart » echoue selon ce qui a tourne avant lui.
 */
async function remettreAZero(page: Page) {
  /*
   * La date est calculee DANS la page : l'application utilise le fuseau du
   * navigateur, qui ne coincide pas forcement avec celui de la machine qui
   * execute les tests. Une remise a zero sur la mauvaise journee laissait le
   * total intact, et les tests recevaient le double de la valeur attendue.
   */
  await page.goto('/nutrition');
  const jour = await page.evaluate(() => new Date().toLocaleDateString('sv'));
  const journee = await page.request.get(`/api/meals?date=${jour}`);
  const { data } = (await journee.json()) as { data?: { waterMl?: number } };
  const restant = data?.waterMl ?? 0;
  if (restant !== 0) {
    await page.request.post('/api/water', { data: { date: jour, amountMl: -restant } });
  }
}

test.beforeEach(async ({ page }) => {
  await remettreAZero(page);
});

test('un clic emet exactement un POST et incremente le total', async ({ page }) => {
  const envois: string[] = [];
  page.on('request', (requete) => {
    if (requete.url().includes('/api/water') && requete.method() === 'POST') {
      envois.push(requete.postData() ?? '');
    }
  });

  await page.goto('/nutrition');
  const total = page.getByTestId('hydratation-total');
  await expect(total).toHaveText('0 ml');

  await page.getByRole('button', { name: 'Ajouter un verre' }).click();

  await expect(total).toHaveText('250 ml');
  expect(envois, 'un clic doit produire un envoi, et un seul').toHaveLength(1);
  expect(envois[0]).toContain('"amountMl":250');

  // La valeur vient bien du serveur, pas d'un affichage optimiste en memoire.
  await page.reload();
  await expect(total).toHaveText('250 ml');
});

test('le bouton de retrait est symetrique', async ({ page }) => {
  await page.goto('/nutrition');
  const total = page.getByTestId('hydratation-total');

  await page.getByRole('button', { name: 'Ajouter un verre' }).click();
  await expect(total).toHaveText('250 ml');

  await page.getByRole('button', { name: 'Retirer un verre' }).click();
  await expect(total).toHaveText('0 ml');

  // Le total ne descend jamais sous zero.
  await page.getByRole('button', { name: 'Retirer un verre' }).click();
  await expect(total).toHaveText('0 ml');
});

test('le total passe au litre au-dela de 1000 ml, sans arrondi trompeur', async ({ page }) => {
  await page.goto('/nutrition');
  const total = page.getByTestId('hydratation-total');

  // Cinq verres de 250 ml : 1250 ml, soit 1,25 L — surtout pas « 1.3 L ».
  for (let i = 0; i < 5; i += 1) {
    await page.getByRole('button', { name: 'Ajouter un verre' }).click();
  }

  await expect(total).toHaveText('1,25 L');
});

test('la contenance du verre est reglable', async ({ page }) => {
  await page.goto('/settings');
  // Le reglage vit dans l'onglet « Langue et region », avec les unites.
  await page.getByRole('button', { name: 'Langue et region' }).click();

  const champ = page.locator('#glass-size');
  await expect(champ).toHaveValue('250');
  await champ.fill('330');
  await page.getByRole('button', { name: 'Enregistrer' }).first().click();

  await page.goto('/nutrition');
  const total = page.getByTestId('hydratation-total');

  await page.getByRole('button', { name: 'Ajouter un verre' }).click();
  await expect(total, 'le verre regle a 330 ml doit ajouter 330 ml').toHaveText('330 ml');
});

test('un champ inconnu est refuse au lieu d\'etre ignore', async ({ page }) => {
  /*
   * Le rapport d'origine envoyait `{ amount: 250 }`. Le serveur repondait 200
   * en appliquant la valeur par defaut de `amountMl` : l'appel semblait
   * correct alors qu'il enregistrait autre chose que ce qui etait demande.
   */
  const reponse = await page.request.post('/api/water', {
    data: { amount: 250, date: new Date().toISOString().slice(0, 10) },
  });

  expect(reponse.status(), 'un nom de champ errone doit etre signale').toBe(422);
});
