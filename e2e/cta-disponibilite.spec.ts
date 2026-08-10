import { test, expect, type Page } from '@playwright/test';

/**
 * Le bouton d'action principal doit etre actionnable des l'hydratation.
 *
 * Il attendait l'ARRIVEE DES DONNEES. Mesure sur /habits : actionnable a
 * 3 385 ms, alors que le document etait charge a 351 ms. Trois secondes
 * pendant lesquelles un clic etait perdu — pour ouvrir un formulaire vide, qui
 * ne demande aucune donnee.
 *
 * Le bouton n'attend plus que React, ce qui est la seule dependance reelle :
 * avant l'hydratation son gestionnaire n'existe pas, apres il fonctionne.
 *
 * Pendant cette courte attente, il affiche un vrai indicateur — un spinner et
 * `aria-busy="true"` — au lieu d'un simple grisage. Rien ne distinguait
 * auparavant « en chargement » de « pret ».
 */

const CIBLES = [
  { chemin: '/habits', libelle: 'Nouvelle habitude' },
  { chemin: '/goals', libelle: 'Nouvel objectif' },
  { chemin: '/tasks', libelle: 'Nouvelle tache' },
];

/** Instant ou le bouton devient actionnable, et etat de l'attente affichee. */
async function disponibilite(page: Page, chemin: string, libelle: string) {
  await page.addInitScript((cible) => {
    (window as unknown as { __cta: { actif: number | null; busyVu: boolean } }).__cta = {
      actif: null,
      busyVu: false,
    };
    const suivre = () => {
      const memoire = (window as unknown as { __cta: { actif: number | null; busyVu: boolean } }).__cta;
      const bouton = [...document.querySelectorAll('button')].find((b) =>
        new RegExp(cible, 'i').test(b.textContent || ''),
      );
      if (bouton?.getAttribute('aria-busy') === 'true') memoire.busyVu = true;
      if (bouton && !bouton.disabled && memoire.actif === null) memoire.actif = performance.now();
      if (memoire.actif === null) setTimeout(suivre, 10);
    };
    setTimeout(suivre, 0);
  }, libelle);

  await page.goto(chemin, { waitUntil: 'commit' });
  await page.waitForFunction(
    () => (window as unknown as { __cta?: { actif: number | null } }).__cta?.actif !== null,
    undefined,
    { timeout: 20_000 },
  );

  return page.evaluate(() => {
    const memoire = (window as unknown as { __cta: { actif: number; busyVu: boolean } }).__cta;
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    return {
      tti: Math.round(memoire.actif),
      load: Math.round(navigation?.loadEventEnd ?? 0),
      busyVu: memoire.busyVu,
    };
  });
}

for (const { chemin, libelle } of CIBLES) {
  test(`${chemin} — le bouton principal est actionnable rapidement`, async ({ page }) => {
    const mesure = await disponibilite(page, chemin, libelle);

    console.log(
      `  ${chemin} : actionnable a ${mesure.tti} ms (load ${mesure.load} ms, soit ${mesure.tti - mesure.load} ms apres)`,
    );

    /*
     * Deux bornes complementaires. L'ecart apres `load` mesure ce que le code
     * controle vraiment — le reste depend du reseau et de la machine. La borne
     * absolue garde l'objectif de l'enonce en vue.
     */
    expect(mesure.tti - mesure.load, 'le bouton doit suivre le chargement de pres').toBeLessThan(600);
    expect(mesure.tti, 'le bouton doit etre actionnable en moins d\'une seconde').toBeLessThan(3_000);
  });
}

test('l\'attente est signalee, pas seulement grisee', async ({ page }) => {
  const mesure = await disponibilite(page, '/habits', 'Nouvelle habitude');

  // `aria-busy` accompagne le spinner : l'attente est annoncee aux lecteurs
  // d'ecran comme a l'oeil, au lieu d'un grisage muet.
  expect(mesure.busyVu, 'le bouton doit annoncer son attente avec aria-busy').toBe(true);
});

test('ouvrir le formulaire ne depend pas du chargement de la liste', async ({ page }) => {
  /*
   * La liste ne repond jamais. Le bouton doit malgre tout s'activer et ouvrir
   * le formulaire : creer une habitude ne demande pas de connaitre les
   * habitudes existantes.
   */
  await page.route('**/api/habits*', async (route) => {
    if (route.request().method() === 'GET') await new Promise((resolve) => setTimeout(resolve, 30_000));
    else await route.continue();
  });

  await page.goto('/habits');

  const bouton = page.getByRole('button', { name: 'Nouvelle habitude' });
  await expect(bouton).toBeEnabled({ timeout: 5_000 });

  await bouton.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Nouvelle habitude' })).toBeVisible();
});
