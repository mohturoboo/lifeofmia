import { test, expect, type Page } from '@playwright/test';

/**
 * Accessibilite mesuree dans un vrai moteur de rendu.
 *
 * Rien de ce qui suit n'est verifiable en jsdom : la taille effective d'une
 * cible, la visibilite d'une commande sans survol, le parcours du focus au
 * clavier — tout depend d'une mise en page reelle.
 */

const PAGES = ['/dashboard', '/habits', '/tasks', '/nutrition', '/notes', '/weight'];
/** Commande sans texte : sa surface est sa seule prise. */
const CIBLE_ICONE = 44;
/** Bouton porteur d'un libelle : minimum normatif WCAG 2.5.8. */
const CIBLE_TEXTE = 24;

/**
 * Cibles trop petites.
 *
 * Deux exigences distinctes, parce que deux situations distinctes :
 *
 *  - une commande SANS TEXTE — un pictogramme seul — n'offre aucune autre
 *    prise que sa surface. C'est le cas signale : 28 px pour « modifier /
 *    archiver / supprimer », 36 px pour l'en-tete. Elle doit atteindre 44 px
 *    sur les deux axes ;
 *  - un bouton PORTANT UN LIBELLE offre une surface large ; sa hauteur reste
 *    tenue au minimum normatif de 24 px (WCAG 2.5.8), avec une marge
 *    confortable. Exiger 44 px de haut pour tous les boutons de texte
 *    reviendrait a redessiner l'application entiere, ce qui n'est pas
 *    l'objet ici.
 */
async function ciblesTropPetites(
  page: Page,
): Promise<Array<{ description: string; largeur: number; hauteur: number; classe: string }>> {
  return page.evaluate(
    ({ minimumIcone, minimumTexte }) => {
      const resultats: Array<{ description: string; largeur: number; hauteur: number; classe: string }> = [];
      const elements = document.querySelectorAll<HTMLElement>('button, a[href], [role="tab"]');

      for (const element of elements) {
        const rect = element.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;

        const style = getComputedStyle(element);
        if (style.visibility === 'hidden' || style.display === 'none') continue;

        /*
         * Le lien d'evitement est masque jusqu'au focus, ou il reprend une
         * taille normale : c'est le motif attendu, pas une cible minuscule.
         */
        if (element.className.includes('lm-sr-only')) continue;

        const texte = (element.textContent ?? '').trim();

        /*
         * Exception « inline » de la regle WCAG 2.5.8 : un lien pose dans une
         * phrase a la hauteur de sa ligne de texte, et l'agrandir romprait le
         * paragraphe. L'exemption ne vaut que s'il PORTE du texte — un
         * pictogramme seul reste soumis a la regle complete.
         */
        if (element.tagName === 'A' && texte.length > 0 && style.display.startsWith('inline')) continue;

        const minimum = texte.length === 0 ? minimumIcone : minimumTexte;

        // Une demi-unite de tolerance : les navigateurs arrondissent.
        if (rect.width + 0.5 < minimum || rect.height + 0.5 < minimum) {
          resultats.push({
            description: `${element.tagName} « ${(element.getAttribute('aria-label') ?? texte).slice(0, 40)} »`,
            largeur: Math.round(rect.width),
            hauteur: Math.round(rect.height),
            classe: String(element.className).slice(0, 80),
          });
        }
      }
      return resultats;
    },
    { minimumIcone: CIBLE_ICONE, minimumTexte: CIBLE_TEXTE },
  );
}

for (const chemin of PAGES) {
  test(`les cibles tactiles de ${chemin} sont assez grandes`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(chemin);
    await page.waitForLoadState('networkidle');

    const tropPetites = await ciblesTropPetites(page);
    expect(
      tropPetites,
      `cibles trop petites : ${JSON.stringify(tropPetites, null, 2)}`,
    ).toEqual([]);
  });
}

test('les commandes de carte sont atteignables sans survol', async ({ page }) => {
  /*
   * Sur un ecran tactile le survol n'existe pas : les commandes « modifier /
   * archiver / supprimer » n'apparaissaient jamais. La seule facon de modifier
   * une carte depuis un telephone etait donc d'ignorer qu'elle existait.
   */
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/habits');

  const nom = `Habitude A11y ${Date.now()}`;
  const creation = await page.request.post('/api/habits', { data: { name: nom } });
  expect(creation.ok()).toBe(true);
  await page.reload();

  const carte = page.locator('div', { hasText: nom }).filter({ has: page.getByRole('button', { name: /archiver/i }) }).last();
  await expect(carte).toBeVisible();

  for (const libelle of [/modifier/i, /archiver/i, /supprimer/i]) {
    const commande = carte.getByRole('button', { name: libelle });
    await expect(commande).toBeVisible();
    // Reellement opaque, pas seulement presente dans le DOM.
    expect(Number(await commande.evaluate((element) => getComputedStyle(element).opacity))).toBe(1);
  }
});

test('Echap ferme le tiroir de navigation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/dashboard');

  const ouvrir = page.getByRole('button', { name: /ouvrir le menu/i });
  await ouvrir.click();

  const tiroir = page.getByRole('dialog');
  await expect(tiroir).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(tiroir).toBeHidden();
});

test('le tiroir confine le focus et le rend a son declencheur', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/dashboard');

  const ouvrir = page.getByRole('button', { name: /ouvrir le menu/i });
  await ouvrir.click();
  await expect(page.getByRole('dialog')).toBeVisible();

  // Le focus entre dans le tiroir des l'ouverture.
  const dansLeTiroir = () =>
    page.evaluate(() => {
      const dialogue = document.querySelector('[role="dialog"]');
      return Boolean(dialogue && document.activeElement && dialogue.contains(document.activeElement));
    });
  expect(await dansLeTiroir()).toBe(true);

  /*
   * Tab boucle a l'interieur : sans piege, la tabulation continuait de
   * parcourir la page masquee derriere le voile, et l'utilisateur au clavier
   * naviguait dans un contenu qu'il ne voyait plus.
   */
  for (let pas = 0; pas < 40; pas += 1) {
    await page.keyboard.press('Tab');
    expect(await dansLeTiroir(), `sorti du tiroir apres ${pas + 1} tabulations`).toBe(true);
  }

  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();

  // Le focus revient sur le bouton qui avait ouvert le tiroir.
  await expect(ouvrir).toBeFocused();
});

test('une fenetre modale confine le focus et le rend a son declencheur', async ({ page }) => {
  await page.goto('/habits');

  const ouvrir = page.getByRole('button', { name: /nouvelle habitude/i }).first();
  await ouvrir.click();

  const fenetre = page.getByRole('dialog');
  await expect(fenetre).toBeVisible();

  const dansLaFenetre = () =>
    page.evaluate(() => {
      const dialogue = document.querySelector('[role="dialog"]');
      return Boolean(dialogue && document.activeElement && dialogue.contains(document.activeElement));
    });
  expect(await dansLaFenetre()).toBe(true);

  for (let pas = 0; pas < 30; pas += 1) {
    await page.keyboard.press('Tab');
    expect(await dansLaFenetre(), `sorti de la fenetre apres ${pas + 1} tabulations`).toBe(true);
  }

  await page.keyboard.press('Escape');
  await expect(fenetre).toBeHidden();
  await expect(ouvrir).toBeFocused();
});

test('les liens du tiroir portent un nom accessible', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/dashboard');
  await page.getByRole('button', { name: /ouvrir le menu/i }).click();
  await expect(page.getByRole('dialog')).toBeVisible();

  const anonymes = await page.evaluate(() => {
    const dialogue = document.querySelector('[role="dialog"]');
    const liens = Array.from(dialogue?.querySelectorAll('a[href]') ?? []);
    return liens
      .filter((lien) => {
        const etiquette = lien.getAttribute('aria-label') ?? '';
        return etiquette.trim().length === 0 && (lien.textContent ?? '').trim().length === 0;
      })
      .map((lien) => lien.getAttribute('href') ?? '?');
  });

  expect(anonymes, 'liens sans nom accessible').toEqual([]);
});

test('les filtres de taches forment un vrai groupe d onglets', async ({ page }) => {
  await page.goto('/tasks');

  const groupe = page.getByRole('tablist');
  await expect(groupe).toBeVisible();

  const onglets = page.getByRole('tab');
  expect(await onglets.count()).toBeGreaterThan(1);

  // Une seule vue a la fois : c'est ce que `aria-selected` dit, la ou
  // `aria-pressed` decrivait six interrupteurs independants.
  const selectionnes = await page.locator('[role="tab"][aria-selected="true"]').count();
  expect(selectionnes).toBe(1);
});
