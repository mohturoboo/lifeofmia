import { test, expect } from '@playwright/test';
import { motifExact } from './texte';

/**
 * Le premier clic doit agir.
 *
 * Mesure a l'origine de ce test, sur une page chargee a froid, en neutralisant
 * l'attribut `disabled` pour retrouver le comportement d'avant correction :
 *
 *   page        bouton visible   clic efficace   fenetre morte
 *   /habits         297 ms          801 ms          504 ms
 *   /goals          226 ms          569 ms          343 ms
 *   /tasks          226 ms          543 ms          316 ms
 *
 * Pendant ces 300 a 500 ms, le bouton etait peint et paraissait actionnable
 * alors que React n'avait pas encore attache son gestionnaire : le clic etait
 * perdu, et il fallait recliquer. Ces trois pages etaient les seules a rendre
 * leur en-tete des le rendu serveur ; ailleurs, un squelette occupe l'ecran
 * jusqu'a l'arrivee des donnees, donc apres l'hydratation.
 *
 * Le correctif desactive ces boutons tant que les donnees ne sont pas la —
 * un etat qui ne peut basculer qu'apres hydratation. Le test le verifie de la
 * seule facon qui compte : il clique UNE fois, des le premier instant ou
 * l'interface presente le bouton comme actionnable.
 */

const PARCOURS = [
  { chemin: '/habits', bouton: 'Nouvelle habitude', titre: 'Nouvelle habitude' },
  { chemin: '/goals', bouton: 'Nouvel objectif', titre: 'Nouvel objectif' },
  { chemin: '/tasks', bouton: 'Nouvelle tâche', titre: 'Nouvelle tâche' },
  { chemin: '/finance', bouton: 'Nouvelle opération', titre: 'Nouvelle opération' },
  { chemin: '/nutrition', bouton: 'Ajouter un repas', titre: 'Ajouter un repas' },
];

for (const { chemin, bouton, titre } of PARCOURS) {
  test(`${bouton} agit des le premier clic`, async ({ page }) => {
    // `commit` : on rend la main des la reponse du serveur, sans attendre le
    // chargement des ressources. C'est le pire moment, celui du bug.
    await page.goto(chemin, { waitUntil: 'commit' });

    const cible = page.getByRole('button', { name: bouton }).first();

    /*
     * `click()` attend que le bouton soit visible, actif et stable, puis clique
     * UNE seule fois. Si l'interface le presentait comme actionnable trop tot,
     * ce clic unique serait perdu et l'assertion qui suit echouerait.
     */
    await cible.click();

    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('heading', { name: titre })).toBeVisible();
  });
}

test('les onglets des reglages agissent des le premier clic', async ({ page }) => {
  await page.goto('/settings', { waitUntil: 'commit' });

  await page.getByRole('button', { name: motifExact('Securite') }).click();

  // Le panneau a bien change : c'est la preuve que le clic a ete pris en compte.
  await expect(page.getByRole('button', { name: motifExact('Securite') })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByLabel(/Mot de passe actuel/)).toBeVisible();
});

test('le bouton reste inactif tant que la page n\'est pas prete', async ({ page }) => {
  await page.goto('/habits', { waitUntil: 'commit' });

  /*
   * Le coeur du correctif : entre le premier rendu et l'arrivee des donnees, le
   * bouton existe mais se presente comme desactive. Un bouton grise est
   * honnete ; un bouton actif qui n'agit pas ne l'est pas.
   */
  const etats = await page.evaluate(async () => {
    const chercher = () =>
      [...document.querySelectorAll('button')].find((b) => /Nouvelle habitude/i.test(b.textContent || ''));

    const releves: boolean[] = [];
    for (let i = 0; i < 60; i += 1) {
      const bouton = chercher();
      if (bouton) releves.push(bouton.disabled);
      if (bouton && !bouton.disabled) break;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    return releves;
  });

  expect(etats.length, 'le bouton n\'est jamais apparu').toBeGreaterThan(0);
  expect(etats[0], 'le bouton est actif des le premier rendu, avant l\'hydratation').toBe(true);
  expect(etats[etats.length - 1], 'le bouton ne devient jamais actionnable').toBe(false);
});
