import { test, expect } from '@playwright/test';

/**
 * Coherence des chiffres affiches.
 *
 * Plusieurs indicateurs se contredisaient a l'ecran sans qu'aucun ne soit
 * identifie :
 *
 *  - le tableau de bord affichait 50 %, 48 % et 2/5 (40 %) cote a cote, dont un
 *    anneau sans le moindre libelle ;
 *  - l'histogramme « Vue de la semaine » ne dessinait aucune barre alors que
 *    les valeurs etaient bien presentes ;
 *  - la page Comparaison presentait une periode de reference anterieure a la
 *    creation du compte, et en tirait un ecart chiffre.
 */

test('l\'anneau du tableau de bord annonce ce qu\'il mesure', async ({ page }) => {
  await page.goto('/dashboard');

  const anneau = page.getByRole('img', { name: /progression|progress|ilerleme|تقدم/i }).first();
  await expect(anneau).toBeVisible();

  /*
   * Le libelle accessible porte le nom de la metrique ET sa valeur : c'est
   * l'anneau qui etait muet, les deux autres pourcentages de la page etant
   * deja nommes.
   */
  const etiquette = await anneau.getAttribute('aria-label');
  expect(etiquette).toBeTruthy();
  expect(etiquette).toMatch(/\d+\s*%/);

  // Et le rapport brut est affiché sous l'anneau : le pourcentage est verifiable.
  const legende = page.locator('section').first().getByText(/\d+\/\d+/).first();
  await expect(legende).toBeVisible();
});

test('le pourcentage de l\'anneau correspond au rapport affiche', async ({ page }) => {
  const reponse = await page.request.get('/api/dashboard');
  const { data } = (await reponse.json()) as {
    data?: { stats?: { habitsDone: number; habitsTotal: number; tasksDone: number; tasksTotal: number; completionRate: number } };
  };
  const stats = data?.stats;
  expect(stats).toBeTruthy();

  const total = stats!.habitsTotal + stats!.tasksTotal;
  const fait = stats!.habitsDone + stats!.tasksDone;
  const attendu = total > 0 ? Math.round((fait / total) * 100) : 0;

  expect(stats!.completionRate, 'l\'anneau doit valoir exactement le rapport annonce').toBe(attendu);
});

test('une semaine sans aucune donnee affiche un etat vide, pas un graphique muet', async ({ page }) => {
  const reponse = await page.request.get('/api/dashboard');
  const { data } = (await reponse.json()) as { data?: { week?: Array<{ disciplineScore: number }> } };

  if ((data?.week ?? []).every((jour) => jour.disciplineScore <= 0)) {
    await page.goto('/dashboard');
    // Un histogramme de barres invisibles se lit comme une panne. La phrase
    // dit que la semaine est vide.
    await expect(page.getByText(/rien a afficher/i).first()).toBeVisible();
  }
});

test('l\'histogramme de la semaine dessine des barres reellement hautes', async ({ page }) => {
  // Le compte de test naît vide : on lui donne de quoi produire un score non
  // nul, sans quoi c'est l'etat vide qui s'affiche — a juste titre.
  const avant = await page.request.get('/api/dashboard');
  const { data } = (await avant.json()) as { data?: { today?: string } };
  const aujourdhui = data?.today;
  expect(aujourdhui).toBeTruthy();

  const creation = await page.request.post('/api/focus', {
    data: { date: aujourdhui, minutes: 45, label: 'e2e histogramme' },
  });
  expect(creation.ok()).toBe(true);

  await page.goto('/dashboard');

  const graphique = page.getByRole('img', { name: /histogramme/i }).first();
  await expect(graphique).toBeVisible();

  const hauteurs = await graphique.evaluate((element) =>
    Array.from(element.querySelectorAll<HTMLElement>('div[style*="height"]')).map(
      (barre) => barre.getBoundingClientRect().height,
    ),
  );

  /*
   * Le defaut d'origine : les colonnes n'etaient pas etirees a la hauteur du
   * graphique, la zone de barre mesurait 0 px, et les hauteurs en pourcentage
   * de cette zone valaient donc 0 px. Le graphique paraissait vide alors que
   * les valeurs etaient dans le DOM. Seule une mesure dans un vrai moteur de
   * rendu peut le constater — jsdom ne calcule aucune mise en page.
   */
  expect(hauteurs.length).toBeGreaterThan(0);
  expect(Math.min(...hauteurs), 'aucune barre ne doit avoir une hauteur nulle').toBeGreaterThan(0);
});

test('l\'axe du score de discipline reste dans [0, 100]', async ({ page }) => {
  await page.goto('/stats');

  const courbe = page.locator('svg[role="img"]').filter({ hasText: /%|\d/ }).first();
  await expect(courbe).toBeVisible();

  const graduations = await page.evaluate(() =>
    Array.from(document.querySelectorAll('svg text[text-anchor="end"]'))
      .map((node) => Number(node.textContent))
      .filter((value) => Number.isFinite(value)),
  );

  expect(graduations.length).toBeGreaterThan(0);
  // Un score de discipline negatif n'existe pas : l'axe allait pourtant
  // jusqu'a -4,1 a cause de la marge automatique de 15 %.
  expect(Math.min(...graduations), 'aucune graduation negative').toBeGreaterThanOrEqual(0);
});

test('la comparaison n\'invente pas de periode anterieure au compte', async ({ page }) => {
  const reponse = await page.request.get('/api/compare?period=30d');
  const { data } = (await reponse.json()) as {
    data?: {
      accountStart?: string;
      hasPrevious?: boolean;
      current?: { from: string };
      previous?: { from: string } | null;
      metrics?: unknown[];
    };
  };

  expect(data?.accountStart).toBeTruthy();

  // La periode courante ne commence jamais avant la creation du compte.
  expect(data!.current!.from >= data!.accountStart!).toBe(true);

  if (data!.hasPrevious) {
    expect(data!.previous).not.toBeNull();
    expect(data!.previous!.from >= data!.accountStart!).toBe(true);
  } else {
    // Compte trop jeune : pas de periode de reference, donc pas d'ecart chiffre.
    expect(data!.previous).toBeNull();
    expect(data!.metrics).toEqual([]);
  }
});

test('la page Comparaison explique l\'absence de reference au lieu d\'afficher un ecart', async ({ page }) => {
  await page.goto('/compare');

  const reponse = await page.request.get('/api/compare?period=30d');
  const { data } = (await reponse.json()) as { data?: { hasPrevious?: boolean } };

  if (data?.hasPrevious === false) {
    await expect(page.getByText(/deux periodes completes/i).first()).toBeVisible();
  }

  // Les dates affichees portent une annee sur quatre chiffres : « 12 juin 26 »
  // se lisait comme un jour de juin.
  await expect(page.getByText(/periode/i).first()).toBeVisible();

  const corps = await page.locator('main').innerText();
  expect(corps.length, 'lire avant le rendu rendrait l\'assertion vide').toBeGreaterThan(0);
  expect(corps).not.toMatch(/\b\d{1,2} [a-zéû.]+ \d{2}\b(?!\d)/i);
});
