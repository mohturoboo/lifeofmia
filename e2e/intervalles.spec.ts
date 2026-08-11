import { test, expect, type Page } from '@playwright/test';

/**
 * Coherence temporelle, de bout en bout.
 *
 * `POST /api/events {"startAt":"...T10:00Z","endAt":"...T08:00Z"}` repondait
 * 201. Le serveur remplacait la fin par « debut + 1 h » sans rien dire : la
 * reponse etait un succes, la donnee n'etait pas celle envoyee, et rien dans
 * la base ne permettait ensuite de reperer les evenements ainsi reecrits.
 *
 * L'audit couvre les autres endpoints a dimension temporelle.
 */

async function aujourdhui(page: Page): Promise<string> {
  const reponse = await page.request.get('/api/dashboard');
  const { data } = (await reponse.json()) as { data?: { today?: string } };
  expect(data?.today).toBeTruthy();
  return data!.today!;
}

function ajouterJours(cle: string, jours: number): string {
  const date = new Date(`${cle}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + jours);
  return date.toISOString().slice(0, 10);
}

test('un evenement dont la fin precede le debut est refuse, pas corrige', async ({ page }) => {
  const reponse = await page.request.post('/api/events', {
    data: {
      title: 'QA Evt',
      startAt: '2026-08-20T10:00:00Z',
      endAt: '2026-08-20T08:00:00Z',
    },
  });

  expect(reponse.status()).toBe(422);
  const corps = (await reponse.json()) as { error?: { message?: string; fields?: Record<string, string> } };
  expect(corps.error?.fields?.endAt ?? corps.error?.message).toMatch(/posterieure au debut/i);
});

test('un evenement de duree nulle est refuse', async ({ page }) => {
  const reponse = await page.request.post('/api/events', {
    data: { title: 'QA Duree nulle', startAt: '2026-08-20T10:00:00Z', endAt: '2026-08-20T10:00:00Z' },
  });
  expect(reponse.status()).toBe(422);
});

test('un evenement valide est enregistre tel quel', async ({ page }) => {
  const reponse = await page.request.post('/api/events', {
    data: { title: 'QA Evt valide', startAt: '2026-08-20T10:00:00Z', endAt: '2026-08-20T12:30:00Z' },
  });

  expect(reponse.ok()).toBe(true);
  const { data } = (await reponse.json()) as { data?: { startAt: string; endAt: string } };

  /*
   * Verification du fond, pas seulement du code HTTP : la route imposait
   * auparavant une duree d'une heure. Les 2 h 30 demandees doivent se
   * retrouver a l'identique.
   */
  const duree = new Date(data!.endAt).getTime() - new Date(data!.startAt).getTime();
  expect(duree).toBe(2.5 * 3_600_000);
});

test('une modification partielle ne peut pas creer une duree negative', async ({ page }) => {
  const creation = await page.request.post('/api/events', {
    data: { title: 'QA Patch', startAt: '2026-08-21T10:00:00Z', endAt: '2026-08-21T11:00:00Z' },
  });
  expect(creation.ok()).toBe(true);
  const { data: cree } = (await creation.json()) as { data?: { id: string } };

  /*
   * La faille jumelle : le PATCH n'appliquait aucune regle. Reculer la seule
   * heure de fin suffisait a obtenir ce que la creation refuse.
   */
  const patch = await page.request.patch(`/api/events/${cree!.id}`, {
    data: { endAt: '2026-08-21T09:00:00Z' },
  });
  expect(patch.status()).toBe(422);

  // Et l'evenement n'a pas bouge.
  const relecture = await page.request.get('/api/events?from=2026-08-01T00:00:00Z&to=2026-08-31T00:00:00Z');
  const { data } = (await relecture.json()) as { data?: { events?: Array<{ id: string; endAt: string }> } };
  const evenement = data?.events?.find((entree) => entree.id === cree!.id);
  expect(evenement?.endAt).toContain('11:00');
});

test('un objectif ouvert ne nait pas avec une echeance depassee', async ({ page }) => {
  const jour = await aujourdhui(page);

  const passe = await page.request.post('/api/goals', {
    data: { title: 'QA Objectif en retard', deadline: ajouterJours(jour, -10), status: 'active' },
  });
  expect(passe.status()).toBe(422);

  const futur = await page.request.post('/api/goals', {
    data: { title: 'QA Objectif a venir', deadline: ajouterJours(jour, 30), status: 'active' },
  });
  expect(futur.ok()).toBe(true);

  /*
   * Nuance volontaire : enregistrer apres coup un objectif DEJA termine avec
   * sa vraie date reste legitime. Interdire toute date passee empecherait de
   * consigner ce qui a ete accompli.
   */
  const termine = await page.request.post('/api/goals', {
    data: { title: 'QA Objectif termine', deadline: ajouterJours(jour, -10), status: 'done' },
  });
  expect(termine.ok()).toBe(true);
});

test('une seance de sport ne se date pas dans le futur', async ({ page }) => {
  const jour = await aujourdhui(page);

  const futur = await page.request.post('/api/workouts', {
    data: { date: ajouterJours(jour, 7), name: 'QA Seance future', durationMin: 45 },
  });
  expect(futur.status()).toBe(422);

  const valide = await page.request.post('/api/workouts', {
    data: { date: jour, name: 'QA Seance du jour', durationMin: 45 },
  });
  expect(valide.ok()).toBe(true);
});

test('une session de concentration ne se date pas dans le futur', async ({ page }) => {
  const jour = await aujourdhui(page);

  const futur = await page.request.post('/api/focus', {
    data: { date: ajouterJours(jour, 3), minutes: 60 },
  });
  expect(futur.status()).toBe(422);
});

test('une entree de journal ne se date pas dans le futur', async ({ page }) => {
  const jour = await aujourdhui(page);

  const futur = await page.request.put('/api/journal', {
    data: { date: ajouterJours(jour, 1), mood: 3, energy: 3, content: 'QA' },
  });
  expect(futur.status()).toBe(422);

  const valide = await page.request.put('/api/journal', {
    data: { date: jour, mood: 3, energy: 3, content: 'QA journal du jour' },
  });
  expect(valide.ok()).toBe(true);
});

test('le formulaire d\'evenement borne l\'heure de fin sur l\'heure de debut', async ({ page }) => {
  await page.goto('/calendar');

  await page.getByRole('button', { name: /nouvel evenement|new event/i }).click();
  const debut = page.locator('#event-start');
  const fin = page.locator('#event-end');
  await expect(fin).toBeVisible();

  // Le `min` suit le champ de debut, quelle que soit sa valeur.
  expect(await fin.getAttribute('min')).toBe(await debut.inputValue());

  await debut.fill('14:00');
  expect(await fin.getAttribute('min')).toBe('14:00');

  // Une fin anterieure est signalee avant toute soumission.
  await fin.fill('09:00');
  await expect(page.getByText(/posterieure au debut/i).first()).toBeVisible();
  expect(await fin.getAttribute('aria-invalid')).toBe('true');
});
