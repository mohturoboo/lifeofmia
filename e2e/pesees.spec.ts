import { test, expect, type Page } from '@playwright/test';
import { motif } from './texte';

/**
 * Regles de saisie d'une pesee.
 *
 * Le formulaire posait deja `max` sur son champ date, mais un attribut HTML ne
 * protege rien : `POST /api/weight {"date":"2027-12-31"}` repondait 201, la
 * mesure de 2027 devenait le « poids actuel », et l'historique l'affichait
 * « 31 dec. » — sans annee — au milieu de mesures du mois en cours.
 */

async function aujourdhui(page: Page): Promise<string> {
  const reponse = await page.request.get('/api/weight');
  const { data } = (await reponse.json()) as { data?: { today?: string } };
  expect(data?.today).toBeTruthy();
  return data!.today!;
}

test('une pesee datee dans le futur est refusee', async ({ page }) => {
  const reponse = await page.request.post('/api/weight', {
    data: { date: '2027-12-31', weightKg: 74 },
  });

  expect(reponse.status()).toBe(422);

  const corps = (await reponse.json()) as { error?: { message?: string; fields?: Record<string, string> } };
  expect(corps.error?.message).toMatch(/futur/i);
  // L'erreur designe le champ fautif, pour que le formulaire puisse la poser
  // sous la bonne saisie.
  expect(corps.error?.fields?.date).toBeTruthy();
});

test('la pesee du jour reste acceptee', async ({ page }) => {
  const jour = await aujourdhui(page);
  const reponse = await page.request.post('/api/weight', { data: { date: jour, weightKg: 72.4 } });
  expect(reponse.ok()).toBe(true);
});

test('un champ inconnu est refuse et nomme, jamais ignore', async ({ page }) => {
  const jour = await aujourdhui(page);
  const reponse = await page.request.post('/api/weight', {
    data: { date: jour, weightKg: 74, bodyFatPct: 999 },
  });

  expect(reponse.status()).toBe(422);
  const corps = (await reponse.json()) as { error?: { message?: string; fields?: Record<string, string> } };
  const texte = JSON.stringify(corps.error);
  expect(texte).toContain('bodyFatPct');
});

test('un taux de masse grasse hors bornes est refuse', async ({ page }) => {
  const jour = await aujourdhui(page);

  const trop = await page.request.post('/api/weight', { data: { date: jour, weightKg: 74, bodyFat: 999 } });
  expect(trop.status()).toBe(422);

  const negatif = await page.request.post('/api/weight', { data: { date: jour, weightKg: 74, bodyFat: -1 } });
  expect(negatif.status()).toBe(422);

  const valide = await page.request.post('/api/weight', { data: { date: jour, weightKg: 74, bodyFat: 18.5 } });
  expect(valide.ok()).toBe(true);

  // Et la valeur acceptee est reellement enregistree, pas ignoree.
  const relecture = await page.request.get('/api/weight');
  const { data } = (await relecture.json()) as { data?: { latest?: { bodyFat: number | null } } };
  expect(data?.latest?.bodyFat).toBe(18.5);
});

test('le champ date du formulaire est borne a aujourd\'hui', async ({ page }) => {
  await page.goto('/weight');
  const jour = await aujourdhui(page);

  await page.getByRole('button', { name: /enregistrer mon poids/i }).click();
  const champ = page.locator('#weight-date');
  await expect(champ).toBeVisible();

  expect(await champ.getAttribute('max')).toBe(jour);
  // La date proposee vient du profil, pas de l'horloge de l'appareil.
  expect(await champ.inputValue()).toBe(jour);
});

test('une seule mesure invite a en ajouter une seconde au lieu de nier son existence', async ({ page }) => {
  await page.goto('/weight');

  const reponse = await page.request.get('/api/weight');
  const { data } = (await reponse.json()) as { data?: { entries?: unknown[] } };
  const nombre = data?.entries?.length ?? 0;

  if (nombre === 1) {
    /*
     * Le defaut : « Aucune mesure enregistree » s'affichait au-dessus d'un
     * historique qui listait justement cette mesure. La page se contredisait
     * a un centimetre d'intervalle.
     */
    await expect(page.getByText(motif('deuxieme mesure')).first()).toBeVisible();
    /*
         * Motif tolerant aux accents ici AUSSI, et pas seulement par confort :
         * l'assertion porte sur une ABSENCE. Ecrite sans accents, elle ne
         * trouvait plus rien apres la reaccentuation et passait donc pour une
         * bonne raison apparente — alors que la phrase interdite pouvait tres
         * bien s'afficher. Une assertion qui ne peut plus echouer ne mesure
         * plus rien.
         */
        await expect(page.getByText(motif('aucune mesure enregistree'))).toHaveCount(0);
  }
});

test('l\'historique affiche l\'annee des qu\'elle sort de l\'annee en cours', async ({ page }) => {
  const jour = await aujourdhui(page);
  const anneeCourante = jour.slice(0, 4);
  const anneePassee = `${Number(anneeCourante) - 1}-12-31`;

  const creation = await page.request.post('/api/weight', { data: { date: anneePassee, weightKg: 80 } });
  expect(creation.ok()).toBe(true);

  await page.goto('/weight');
  const historique = page.locator('li', { hasText: /kg/ });
  await expect(historique.first()).toBeVisible();

  const textes = await historique.allInnerTexts();
  const ligneAncienne = textes.find((texte) => texte.includes('80'));
  expect(ligneAncienne, 'la mesure de l\'an dernier doit etre listee').toBeTruthy();
  expect(ligneAncienne).toContain(String(Number(anneeCourante) - 1));
});

test('poids et unite sont ecrits pareil dans les cartes et dans l\'historique', async ({ page }) => {
  const jour = await aujourdhui(page);
  await page.request.post('/api/weight', { data: { date: jour, weightKg: 75 } });

  await page.goto('/weight');
  // La page monte d'abord un squelette sans texte : lire trop tot renvoie une
  // chaine vide, et l'assertion passerait sans rien avoir verifie.
  await expect(page.getByText(/75 kg/).first()).toBeVisible();

  const corps = await page.locator('main').innerText();
  expect(corps.length).toBeGreaterThan(0);

  /*
   * « 75kg » etait la forme des cartes — l'unite y etait separee par une simple
   * marge CSS — contre « 75 kg » dans l'historique. Plus aucun chiffre ne doit
   * toucher son unite.
   */
  expect(corps).not.toMatch(/\dkg/);
  expect(corps).toMatch(/75 kg/);
});
