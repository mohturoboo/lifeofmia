import { test, expect, type Page } from '@playwright/test';

/**
 * Un bouton actionnable ne doit jamais avoir l'air desactive.
 *
 * Le bouton principal restait gris (`opacity: 0.5`) alors que `disabled` valait
 * `false` et qu'il repondait au clic. La cause : `transition-all` incluait
 * l'opacite, et l'opacite de ce bouton change avec son etat `disabled`. Le
 * passage de desactive a actif devenait une transition — qui, restee orpheline,
 * figeait l'element sur sa valeur de DEPART.
 *
 * Rien n'est plus dissuasif qu'un bouton qui a l'air mort : l'utilisateur
 * n'essaie meme pas de cliquer.
 */

const PAGES = [
  '/dashboard',
  '/habits',
  '/tasks',
  '/goals',
  '/nutrition',
  '/finance',
  '/weight',
  '/sport',
  '/notes',
  '/calendar',
  '/journal',
  '/stats',
  '/settings',
];

/** Boutons actionnables rendus a une opacite qui les fait paraitre inertes. */
async function boutonsGrises(page: Page) {
  return page.evaluate(() => {
    const fautifs: Array<{ libelle: string; opacite: string; animations: string[] }> = [];

    for (const bouton of document.querySelectorAll('button, a[role="button"]')) {
      if ((bouton as HTMLButtonElement).disabled) continue;
      const rect = bouton.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;

      const style = getComputedStyle(bouton);
      const classes = (bouton.className || '').toString();
      // Les actions de ligne se revelent au survol : c'est un choix d'interface.
      if (/group-hover:opacity-100|hover:opacity-100/.test(classes)) continue;
      if (style.opacity === '1') continue;
      /*
       * On cible la signature exacte du defaut : un element porteur de la regle
       * « grise quand desactive », rendu grise alors qu'il ne l'est PAS. Les
       * attenuations voulues — les jours hors du mois dans le calendrier —
       * viennent d'une classe d'opacite explicite et ne sont pas concernees.
       */
      if (!classes.includes('disabled:opacity-50')) continue;

      fautifs.push({
        libelle: (bouton.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40) ||
          bouton.getAttribute('aria-label') ||
          '(sans libelle)',
        opacite: style.opacity,
        animations: bouton
          .getAnimations()
          .map((a) => `${a.constructor.name}/${a.playState}/${a.effect?.getComputedTiming().fill ?? '?'}`),
      });
    }

    return fautifs;
  });
}

for (const chemin of PAGES) {
  test(`${chemin} — aucun bouton actionnable n'a l'air desactive`, async ({ page }) => {
    await page.goto(chemin);
    await page.waitForLoadState('networkidle');
    // Au-dela de toute animation d'entree : c'est l'etat au repos qui compte.
    await page.waitForTimeout(600);

    expect(await boutonsGrises(page), `boutons grises sur ${chemin}`).toEqual([]);
  });
}

test('le bouton principal redevient net des qu\'il est actionnable', async ({ page }) => {
  await page.goto('/habits', { waitUntil: 'commit' });

  /*
   * Le scenario exact du rapport : le bouton nait desactive le temps du
   * chargement des donnees, puis redevient actif. On suit les deux etats.
   */
  const parcours = await page.evaluate(async () => {
    const chercher = () =>
      [...document.querySelectorAll('button')].find((b) => /Nouvelle habitude/i.test(b.textContent || ''));

    const releves: Array<{ disabled: boolean; opacite: string }> = [];
    for (let i = 0; i < 100; i += 1) {
      const bouton = chercher();
      if (bouton) {
        releves.push({ disabled: bouton.disabled, opacite: getComputedStyle(bouton).opacity });
        if (!bouton.disabled) break;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return releves;
  });

  const premier = parcours[0];
  const dernier = parcours[parcours.length - 1];

  expect(premier?.disabled, 'le bouton doit naitre desactive, le temps du chargement').toBe(true);
  expect(dernier?.disabled, 'le bouton doit finir actionnable').toBe(false);
  expect(dernier?.opacite, 'un bouton actionnable doit etre pleinement opaque').toBe('1');
});

test('aucune transition ne porte sur l\'opacite d\'un element a etat desactive', async ({ page }) => {
  await page.goto('/habits');

  /*
   * Verification a la source. Un `transition-all` reintroduirait exactement le
   * meme piege, meme si la page passe les tests ci-dessus le jour ou il est
   * ecrit : l'opacite serait de nouveau animee lors d'un changement d'etat.
   */
  const fautifs = await page.evaluate(() => {
    const problemes: string[] = [];
    for (const element of document.querySelectorAll('button, input, select, textarea')) {
      const style = getComputedStyle(element);
      const proprietes = style.transitionProperty.split(',').map((p) => p.trim());
      if (!proprietes.includes('all') && !proprietes.includes('opacity')) continue;
      problemes.push(
        `${element.tagName} « ${(element.textContent || '').trim().slice(0, 25)} » : ${style.transitionProperty}`,
      );
    }
    return [...new Set(problemes)];
  });

  expect(fautifs, 'l\'opacite ne doit jamais etre animee sur un controle desactivable').toEqual([]);
});
