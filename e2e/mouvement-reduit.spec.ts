import { test, expect, type Page } from '@playwright/test';

/**
 * En mouvement reduit, le contenu doit rester VISIBLE.
 *
 * C'est le risque le plus grave de toute animation d'entree : si l'etat de
 * depart est `opacity: 0` et que l'animation ne se joue pas, le contenu ne
 * s'affiche jamais. L'utilisateur ne voit pas une page sans effet — il voit une
 * page vide.
 *
 * Trois situations produisent ce blocage : le reglage « animations reduites »
 * du systeme, un onglet passe en arriere-plan pendant le chargement, et le
 * throttling des images par le navigateur. Les trois sont couvertes ici.
 *
 * L'application n'anime donc jamais l'opacite d'un contenu : seule la position
 * bouge. Au pire, un bloc s'affiche decale de huit pixels.
 */

const PAGES = ['/dashboard', '/habits', '/goals', '/tasks', '/notes', '/nutrition', '/finance', '/stats'];

/** Elements visibles dans la page mais rendus totalement transparents. */
async function elementsInvisibles(page: Page) {
  return page.evaluate(() => {
    const fautifs: Array<{ balise: string; classe: string; texte: string }> = [];
    for (const element of document.querySelectorAll('main *')) {
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      const style = getComputedStyle(element);
      // `visibility` et `display` sont des masquages voulus ; l'opacite a zero
      // sur un element qui occupe la place, non.
      if (style.visibility === 'hidden' || Number(style.opacity) !== 0) continue;
      /*
       * Les infobulles des graphiques sont transparentes jusqu'au survol, et
       * inertes au pointeur : ce sont des revelations volontaires, pas du
       * contenu bloque. Un contenu attendu par l'utilisateur reste, lui,
       * toujours interactif.
       */
      if (style.pointerEvents === 'none') continue;
      /*
       * On ne retient que ce que l'utilisateur attend de LIRE ou d'actionner.
       * Les cases de remplissage de la frise annuelle sont volontairement
       * transparentes pour aligner la grille : elles ne portent ni texte ni
       * action, et leur disparition ne prive de rien.
       */
      const porteDuContenu = (element.textContent || '').trim().length > 0;
      const estInteractif = element.matches('a, button, input, select, textarea, [role="button"]');
      if (!porteDuContenu && !estInteractif) continue;
      /*
       * Les actions de ligne se revelent au survol sur grand ecran. C'est un
       * choix d'interface, pas une animation bloquee : elles le declarent
       * desormais par la classe `lm-commande-discrete`, dont la regle CSS est
       * enfermee dans `(hover: hover) and (pointer: fine)`. Sur un ecran
       * tactile elles sont donc toujours opaques — c'est precisement le defaut
       * corrige, et il est verifie dans `accessibilite.spec.ts`.
       */
      const classes = (element.className || '').toString();
      if (/group-hover:opacity-100|hover:opacity-100/.test(classes)) continue;
      if (classes.includes('lm-commande-discrete') || element.closest('.lm-commande-discrete')) continue;
      fautifs.push({
        balise: element.tagName,
        classe: (element.className || '').toString().slice(0, 60),
        texte: (element.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40),
      });
    }
    return fautifs;
  });
}

test.describe('mouvement reduit', () => {
  for (const chemin of PAGES) {
    test(`${chemin} affiche son contenu`, async ({ page }) => {
      // Reglage systeme « animations reduites ».
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto(chemin);
      await page.waitForLoadState('networkidle');

      const invisibles = await elementsInvisibles(page);
      expect(invisibles, `elements bloques a opacity: 0 sur ${chemin}`).toEqual([]);

      // Et le contenu est bien la, pas seulement « non transparent ».
      await expect(page.locator('main')).not.toBeEmpty();
    });
  }
});

test('le contenu s\'affiche meme sans aucune image d\'animation', async ({ page }) => {
  /*
   * Reproduit un onglet en arriere-plan : `requestAnimationFrame` ne rappelle
   * jamais, et les animations CSS restent figees sur leur image de depart.
   */
  await page.addInitScript(() => {
    window.requestAnimationFrame = () => 0;
  });

  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');

  expect(await elementsInvisibles(page)).toEqual([]);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

test('aucune animation d\'entree ne part d\'une opacite nulle', async ({ page }) => {
  await page.goto('/habits');

  /*
   * Verification a la source : une regle `from { opacity: 0 }` sur une
   * animation d'entree reintroduirait le blocage, meme si la page passe les
   * tests ci-dessus le jour ou elle est ecrite.
   */
  const fautives = await page.evaluate(() => {
    const noms = ['lm-entree', 'lm-modal-in', 'lm-toast-in'];
    const problemes: string[] = [];
    for (const feuille of Array.from(document.styleSheets)) {
      let regles: CSSRuleList;
      try {
        regles = feuille.cssRules;
      } catch {
        continue; // feuille d'une autre origine
      }
      for (const regle of Array.from(regles)) {
        if (!(regle instanceof CSSKeyframesRule) || !noms.includes(regle.name)) continue;
        for (const image of Array.from(regle.cssRules) as CSSKeyframeRule[]) {
          if (image.style.opacity === '0') problemes.push(`${regle.name} @ ${image.keyText}`);
        }
      }
    }
    return problemes;
  });

  expect(fautives, 'une animation d\'entree part d\'une opacite nulle').toEqual([]);
});
