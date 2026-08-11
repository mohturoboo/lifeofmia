import { test, expect, type Page } from '@playwright/test';

/**
 * Le bouton de soumission doit etre reellement cliquable.
 *
 * La barre de navigation basse (`z-index: 30`, visible sous 1024 px) recouvrait
 * le bas des fenetres modales. Le panneau declarait pourtant un rang superieur,
 * mais il etait rendu DANS la colonne de contenu, laquelle forme un contexte
 * d'empilement a `z-index: 10` : un rang eleve n'y ordonne que les elements
 * freres. Face a la nav, restee dehors, toute la colonne passait dessous.
 *
 * `document.elementFromPoint()` au centre du bouton « Enregistrer » renvoyait
 * alors un lien de la navigation. Le formulaire etait remplissable mais
 * impossible a valider a la souris.
 *
 * Ce test verifie le seul critere qui compte pour l'utilisateur : au point ou
 * il clique, c'est bien le bouton qui repond.
 */

const VIEWPORT = { width: 390, height: 800 };

const FENETRES = [
  { chemin: '/habits', ouvrir: 'Nouvelle habitude' },
  { chemin: '/goals', ouvrir: 'Nouvel objectif' },
  { chemin: '/tasks', ouvrir: 'Nouvelle tâche' },
  { chemin: '/finance', ouvrir: 'Nouvelle opération' },
  { chemin: '/weight', ouvrir: 'Enregistrer mon poids' },
  { chemin: '/sport', ouvrir: 'Nouvelle séance' },
  { chemin: '/notes', ouvrir: 'Nouvelle note' },
  { chemin: '/calendar', ouvrir: 'Nouvel événement' },
  { chemin: '/nutrition', ouvrir: 'Ajouter un repas' },
];

/**
 * Renseigne les champs vides du formulaire.
 *
 * Sans cela, le bouton de soumission reste desactive — donc transparent aux
 * evenements de pointeur — et `elementFromPoint` renvoie le pied de la fenetre.
 * On reproduit le geste decrit dans le rapport : saisir un nom, puis cliquer.
 */
async function remplirFormulaire(page: Page) {
  await page.evaluate(() => {
    const fenetre = document.querySelector('[role="dialog"]');
    if (!fenetre) return;
    const poserValeur = (champ: HTMLInputElement | HTMLTextAreaElement, valeur: string) => {
      const prototype = champ instanceof HTMLTextAreaElement ? HTMLTextAreaElement : HTMLInputElement;
      Object.getOwnPropertyDescriptor(prototype.prototype, 'value')!.set!.call(champ, valeur);
      champ.dispatchEvent(new Event('input', { bubbles: true }));
    };

    for (const champ of fenetre.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea')) {
      if (champ.type === 'checkbox' || champ.type === 'radio' || champ.value) continue;
      poserValeur(champ, champ.type === 'number' ? '42' : 'Controle E2E');
    }
  });
}

/** Qui repond au centre du bouton ? Le bouton lui-meme, ou autre chose ? */
async function elementAuCentreDu(page: Page, bouton: ReturnType<Page['getByRole']>) {
  return bouton.evaluate((cible) => {
    const rect = cible.getBoundingClientRect();
    const dessus = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
    return {
      estLeBouton: dessus === cible || cible.contains(dessus),
      trouve: dessus ? `${dessus.tagName}.${(dessus.className || '').toString().split(' ').slice(0, 2).join('.')}` : 'rien',
      dansUneNav: Boolean(dessus?.closest('nav')),
    };
  });
}

for (const { chemin, ouvrir } of FENETRES) {
  test(`${chemin} — le bouton de soumission repond au clic sous 1024px`, async ({ page }) => {
    await page.setViewportSize(VIEWPORT);
    await page.goto(chemin);

    await page.getByRole('button', { name: ouvrir }).first().click();

    const fenetre = page.getByRole('dialog');
    await expect(fenetre).toBeVisible();
    await fenetre.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));

    await remplirFormulaire(page);

    const soumettre = fenetre.getByRole('button', { name: 'Enregistrer' });
    await expect(soumettre).toBeVisible();
    await expect(soumettre).toBeEnabled();

    const dessus = await elementAuCentreDu(page, soumettre);
    expect(dessus.dansUneNav, `la navigation recouvre le bouton (${dessus.trouve})`).toBe(false);
    expect(dessus.estLeBouton, `au centre du bouton on trouve ${dessus.trouve}`).toBe(true);

    /*
     * Second controle, qui isole l'ordre de PEINTURE.
     *
     * La regle `pointer-events: none` posee sur la navigation suffit a rendre
     * le bouton cliquable : `elementFromPoint` ignore les elements transparents
     * aux evenements. Elle ne dit donc rien de ce que l'utilisateur VOIT. En
     * lui rendant ses evenements le temps de la mesure, on verifie que le
     * panneau est reellement peint au-dessus.
     */
    const dessusSansGardeFou = await page.evaluate((selecteur) => {
      const nav = document.querySelector<HTMLElement>('nav[aria-label="Navigation rapide"]');
      const ancien = nav?.style.pointerEvents ?? '';
      if (nav) nav.style.pointerEvents = 'auto';

      const bouton = [...document.querySelectorAll<HTMLElement>('[role="dialog"] button')].find(
        (b) => b.textContent?.trim() === selecteur,
      )!;
      const rect = bouton.getBoundingClientRect();
      const trouve = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);

      if (nav) nav.style.pointerEvents = ancien;
      return { estLeBouton: trouve === bouton || bouton.contains(trouve), dansUneNav: Boolean(trouve?.closest('nav')) };
    }, 'Enregistrer');

    expect(dessusSansGardeFou.dansUneNav, 'la navigation est peinte au-dessus du panneau').toBe(false);
    expect(dessusSansGardeFou.estLeBouton, "le panneau n'est pas au premier plan").toBe(true);
  });
}

test('la fenetre sort de la colonne de contenu et neutralise la navigation', async ({ page }) => {
  await page.setViewportSize(VIEWPORT);
  await page.goto('/habits');
  await page.getByRole('button', { name: 'Nouvelle habitude' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();

  const etat = await page.evaluate(() => {
    const fenetre = document.querySelector('[role="dialog"]')!;
    const nav = document.querySelector('nav[aria-label="Navigation rapide"]');

    /*
     * Contexte d'empilement qui enferme la fenetre, en partant de son PROPRE
     * conteneur : celui-ci porte legitimement le rang du voile. Ce qu'on
     * cherche, c'est un contexte au-dessus de lui — celui de la colonne de
     * contenu, qui plafonnait tout le sous-arbre a 10.
     */
    const conteneur = fenetre.parentElement!;
    const contexteEnglobant = (element: Element) => {
      let parent = element.parentElement;
      while (parent && parent !== document.documentElement) {
        const style = getComputedStyle(parent);
        if (style.zIndex !== 'auto' && style.position !== 'static') return Number(style.zIndex);
        parent = parent.parentElement;
      }
      return null;
    };

    return {
      renduDansLeBody: conteneur.parentElement === document.body,
      contexteEnglobant: contexteEnglobant(conteneur),
      rangVoile: getComputedStyle(conteneur).zIndex,
      rangPanneau: getComputedStyle(fenetre).zIndex,
      rangNav: nav ? getComputedStyle(nav).zIndex : null,
      navSansPointeur: nav ? getComputedStyle(nav).pointerEvents : null,
      marqueurBody: document.body.dataset.dialogOpen ?? null,
    };
  });

  expect(etat.renduDansLeBody, 'la fenetre doit etre montee hors de la colonne de contenu').toBe(true);
  expect(etat.contexteEnglobant, 'aucun contexte d\'empilement ne doit enfermer la fenetre').toBeNull();
  expect(Number(etat.rangPanneau)).toBeGreaterThan(Number(etat.rangNav));
  expect(etat.navSansPointeur, 'la navigation doit cesser de recevoir les clics').toBe('none');
  expect(etat.marqueurBody).toBe('true');
});
