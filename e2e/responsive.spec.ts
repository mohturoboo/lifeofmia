import { test, expect, type Page } from '@playwright/test';

/**
 * Aucun contenu ne doit deborder de l'ecran sur telephone.
 *
 * Le defaut d'origine venait des grilles responsives : elles ne declaraient
 * leurs colonnes qu'a partir de `sm` ou `lg`. En dessous, la colonne implicite
 * se dimensionne sur son CONTENU et peut donc depasser son conteneur — une
 * carte de 353 px dans une colonne de 336. La page se mettait alors a defiler
 * horizontalement et le contenu semblait coupe au bord droit.
 *
 * La plage 320-428 px couvre la quasi-totalite des telephones en circulation,
 * du petit iPhone SE au Pro Max.
 */

const LARGEURS = [320, 360, 375, 390, 414, 428];

const PAGES = [
  { chemin: '/dashboard', nom: 'tableau de bord' },
  { chemin: '/habits', nom: 'habitudes' },
  { chemin: '/tasks', nom: 'taches' },
  { chemin: '/nutrition', nom: 'alimentation' },
  { chemin: '/finance', nom: 'finances' },
  { chemin: '/stats', nom: 'statistiques' },
];

/**
 * Releve tout ce qui sort du cadre.
 *
 * Un element dont un ancetre rogne le debordement (`overflow: hidden`) est
 * ignore : les halos decoratifs de l'application depassent volontairement, sans
 * jamais etre visibles ni provoquer de defilement.
 */
async function releverDebordements(page: Page) {
  return page.evaluate(() => {
    const largeur = document.documentElement.clientWidth;

    /*
     * Un debordement est « absorbe » si un ancetre le rogne ET que cet ancetre
     * tient lui-meme dans l'ecran : la frise annuelle, large de 780 px, defile
     * dans son propre cadre sans jamais pousser la page.
     *
     * Une premiere version se contentait de chercher un ancetre rogneur, sans
     * verifier qu'il tenait dans l'ecran. Elle declarait donc inoffensif un
     * conteneur qui debordait lui aussi — et le vrai coupable n'apparaissait
     * jamais dans le rapport.
     */
    const absorbeParUnAncetre = (element: Element) => {
      let parent = element.parentElement;
      while (parent && parent !== document.documentElement) {
        const { overflowX } = getComputedStyle(parent);
        /*
         * On ne s'arrete PAS au premier ancetre rogneur : un `<svg>` rogne son
         * contenu tout en debordant lui-meme de sa carte, laquelle rogne a son
         * tour et tient dans l'ecran. Il faut donc remonter jusqu'a trouver un
         * rogneur qui tient — ou le sommet du document.
         */
        if (
          ['hidden', 'clip', 'auto', 'scroll'].includes(overflowX) &&
          parent.getBoundingClientRect().right <= largeur + 1
        ) {
          return true;
        }
        parent = parent.parentElement;
      }
      return false;
    };

    const debordements: Array<{ balise: string; classe: string; texte: string; droite: number; ascendance: string[] }> = [];
    const textesCoupes: Array<{ texte: string; visible: number; reel: number }> = [];

    for (const element of document.querySelectorAll('body *')) {
      const rect = element.getBoundingClientRect();

      if (rect.width > 0 && (rect.right > largeur + 1 || rect.left < -1) && !absorbeParUnAncetre(element)) {
        const ascendance: string[] = [];
        let noeud: Element | null = element.parentElement;
        while (noeud && noeud !== document.body && ascendance.length < 4) {
          ascendance.push(
            `${noeud.tagName}[${getComputedStyle(noeud).overflowX}|${Math.round(noeud.getBoundingClientRect().right)}]` +
              `.${(noeud.className || '').toString().split(' ').slice(0, 2).join('.')}`,
          );
          noeud = noeud.parentElement;
        }
        debordements.push({
          balise: element.tagName,
          classe: (element.className || '').toString().slice(0, 60),
          texte: (element.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40),
          droite: Math.round(rect.right),
          ascendance,
        });
      }

      /*
       * Texte tronque sans ellipse volontaire : le contenu devient illisible.
       *
       * Les elements SVG sont exclus : `clientWidth` et `scrollWidth` n'y ont
       * pas de sens et renvoient la boite de mise en page la plus proche. Le
       * libelle « Spiritualite » du radar y apparaissait comme tronque alors
       * que sa boite reelle (`getBBox`) tient largement dans le viewBox.
       */
      const texte = (element.textContent || '').trim();
      const estSvg = element.namespaceURI === 'http://www.w3.org/2000/svg';
      if (!estSvg && element.children.length === 0 && texte && element.scrollWidth > element.clientWidth + 1) {
        const style = getComputedStyle(element);
        /*
         * Depasser sa boite ne signifie pas etre coupe : avec un debordement
         * visible — le cas des infobulles d'histogramme, larges comme leur
         * barre de 6 px — le texte deborde sur les cotes et reste parfaitement
         * lisible. Seul un element qui ROGNE reellement masque du contenu.
         */
        const rogne = ['hidden', 'clip', 'auto', 'scroll'].includes(style.overflowX);
        const troncatureVoulue = style.textOverflow === 'ellipsis' || element.closest('.lm-sr-only') !== null;
        if (rogne && !troncatureVoulue && !element.classList.contains('lm-sr-only')) {
          textesCoupes.push({ texte: texte.slice(0, 40), visible: element.clientWidth, reel: element.scrollWidth });
        }
      }
    }

    /*
     * Localisation de secours : quand aucun element n'est signale mais que la
     * page defile quand meme, on remonte l'arbre en cherchant les conteneurs
     * dont le contenu est plus large que la boite. Le plus profond d'entre eux
     * porte la cause.
     */
    const suspects = debordements.length
      ? debordements.slice(0, 5)
      : [...document.querySelectorAll('main, main *')]
          .filter((element) => element.scrollWidth > element.clientWidth + 1 && element.clientWidth > 0)
          .filter((element) => !['hidden', 'clip', 'auto', 'scroll'].includes(getComputedStyle(element).overflowX))
          .slice(-5)
          .map((element) => ({
            balise: element.tagName,
            classe: (element.className || '').toString().slice(0, 60),
            texte: (element.textContent || '').replace(/s+/g, ' ').trim().slice(0, 40),
            droite: Math.round(element.getBoundingClientRect().right),
            ascendance: [`boite ${element.clientWidth} < contenu ${element.scrollWidth}`],
          }));

    return {
      largeur,
      scrollWidth: document.documentElement.scrollWidth,
      defilementHorizontal: document.documentElement.scrollWidth > largeur + 1,
      debordements,
      textesCoupes,
      suspects,
    };
  });
}

for (const largeur of LARGEURS) {
  for (const { chemin, nom } of PAGES) {
    test(`${nom} tient dans ${largeur}px de large`, async ({ page }) => {
      await page.setViewportSize({ width: largeur, height: 844 });
      await page.goto(chemin);
      // Les pages chargent leurs donnees apres le rendu : on mesure une fois le
      // contenu reel en place, pas les squelettes.
      await page.waitForLoadState('networkidle');

      const rapport = await releverDebordements(page);

      expect(rapport.debordements, `elements hors cadre en ${largeur}px`).toEqual([]);
      expect(
        rapport.defilementHorizontal,
        `la page defile horizontalement (${rapport.scrollWidth} > ${rapport.largeur})
${JSON.stringify(rapport.suspects, null, 2)}`,
      ).toBe(false);
      expect(rapport.textesCoupes, `textes tronques en ${largeur}px`).toEqual([]);
    });
  }
}

test('l\'en-tete du tableau de bord reste entier en 390px', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');

  // Les trois blocs signales comme coupes : salutation, date/ville, citation.
  const entete = await page.evaluate(() => {
    const mesurer = (element: Element | null | undefined) => {
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return {
        texte: (element.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60),
        droite: Math.round(rect.right),
        dansLEcran: rect.right <= document.documentElement.clientWidth + 1 && rect.left >= -1,
        coupe: element.scrollWidth > element.clientWidth + 1,
      };
    };
    const titre = document.querySelector('h1');
    const citation = [...document.querySelectorAll('p')].find((p) => /«/.test(p.textContent || ''));
    const date = [...document.querySelectorAll('span')].find((s) => /\d{4}/.test(s.textContent || ''));
    return { salutation: mesurer(titre), date: mesurer(date), citation: mesurer(citation) };
  });

  expect(entete.salutation?.dansLEcran, 'la salutation depasse').toBe(true);
  expect(entete.salutation?.coupe, 'la salutation est tronquee').toBe(false);
  expect(entete.date?.dansLEcran, 'la date depasse').toBe(true);
  expect(entete.citation?.dansLEcran, 'la citation depasse').toBe(true);
  expect(entete.citation?.coupe, 'la citation est tronquee').toBe(false);
});
