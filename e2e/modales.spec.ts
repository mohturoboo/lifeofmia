import { test, expect } from '@playwright/test';

/**
 * Les fenetres modales doivent etre PEINTES, pas seulement presentes.
 *
 * Le defaut d'origine : le formulaire existait dans le DOM, focusable au
 * clavier, mais invisible a l'ecran — le panneau restait a `opacity: 0` parce
 * que son affichage dependait du bon deroulement d'une animation.
 *
 * `toBeVisible()` de Playwright ne suffit donc pas : il considere visible un
 * element transparent des lors qu'il occupe une surface. Chaque test controle
 * explicitement l'opacite calculee, seule mesure qui aurait attrape le bug.
 */

const VIEWPORTS = [
  { nom: 'mobile', largeur: 375, hauteur: 812 },
  { nom: 'tablette', largeur: 768, hauteur: 1024 },
  { nom: 'desktop', largeur: 1280, hauteur: 800 },
  // Taille exacte du rapport de test.
  { nom: 'desktop etroit', largeur: 930, hauteur: 920 },
];

const FORMULAIRES = [
  { page: '/habits', bouton: 'Nouvelle habitude', titre: 'Nouvelle habitude' },
  { page: '/goals', bouton: 'Nouvel objectif', titre: 'Nouvel objectif' },
];

for (const { nom, largeur, hauteur } of VIEWPORTS) {
  for (const { page: chemin, bouton, titre } of FORMULAIRES) {
    test(`${titre} est visible en ${nom} (${largeur}x${hauteur})`, async ({ page }) => {
      await page.setViewportSize({ width: largeur, height: hauteur });
      await page.goto(chemin);

      await page.getByRole('button', { name: bouton }).first().click();

      const fenetre = page.getByRole('dialog');
      await expect(fenetre).toBeVisible();
      await expect(fenetre.getByRole('heading', { name: titre })).toBeVisible();

      // Le panneau est reellement peint, et devant le voile assombri.
      await expect
        .poll(() => fenetre.evaluate((el) => getComputedStyle(el).opacity), { timeout: 5_000 })
        .toBe('1');
      expect(await fenetre.evaluate((el) => getComputedStyle(el).visibility)).toBe('visible');

      await fenetre.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));

      const geometrie = await fenetre.evaluate((el) => {
        const r = el.getBoundingClientRect();
        const corps = el.querySelector('.overflow-y-auto') as HTMLElement;
        const pied = el.querySelector('footer')!.getBoundingClientRect();
        return {
          tient:
            r.top >= -1 && r.bottom <= window.innerHeight + 1 && r.left >= -1 && r.right <= window.innerWidth + 1,
          piedVisible: pied.bottom <= window.innerHeight + 1,
          defilable: getComputedStyle(corps).overflowY,
          contenuPlusHautQueLeCadre: corps.scrollHeight > corps.clientHeight,
          // Un champ sans surface signalerait un panneau replie a zero.
          sansDimension: [...el.querySelectorAll('input, select, textarea, button')].filter((c) => {
            const b = c.getBoundingClientRect();
            return b.width === 0 || b.height === 0;
          }).length,
        };
      });

      expect(geometrie.tient, 'le panneau depasse de l\'ecran').toBe(true);
      expect(geometrie.piedVisible, 'le bouton Enregistrer est hors de l\'ecran').toBe(true);
      expect(geometrie.defilable, 'le contenu doit pouvoir defiler').toBe('auto');
      expect(geometrie.sansDimension, 'des champs n\'ont aucune surface').toBe(0);

      // Le bouton d'enregistrement reste atteignable quelle que soit la hauteur.
      await expect(fenetre.getByRole('button', { name: 'Enregistrer' })).toBeVisible();
    });
  }
}

test('le formulaire d\'habitude montre icone, couleur et categorie ensemble', async ({ page }) => {
  await page.setViewportSize({ width: 930, height: 920 });
  await page.goto('/habits');
  await page.getByRole('button', { name: 'Nouvelle habitude' }).click();

  const fenetre = page.getByRole('dialog');
  await expect(fenetre).toBeVisible();
  await fenetre.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));

  // Les trois selecteurs qui allongent ce formulaire, tous rendus en meme temps.
  const ensemble = await fenetre.evaluate((el) => {
    const corps = el.querySelector('.overflow-y-auto')!.getBoundingClientRect();
    const dansLeCadre = (cible: Element | null) => {
      if (!cible) return false;
      const b = cible.getBoundingClientRect();
      return b.height > 0 && b.bottom > corps.top && b.top < corps.bottom;
    };
    return {
      icone: dansLeCadre(el.querySelector('#check, [aria-label="check"]')),
      couleur: dansLeCadre(el.querySelector('button[style*="background"]')),
      categorie: dansLeCadre(el.querySelector('select')),
    };
  });

  expect(ensemble).toEqual({ icone: true, couleur: true, categorie: true });
});
