import { test, expect, type Page } from '@playwright/test';
import { motifExact } from './texte';

/**
 * Les filtres de la liste de taches.
 *
 * Trois defauts signales, dont deux confirmes :
 *
 * - `?scope=done` — un filtre qui n'existe pas — retombait sur « aucune borne
 *   de date » et renvoyait donc TOUTES les taches. Une faute de frappe
 *   produisait le resultat le plus large possible ;
 * - les taches sans echeance apparaissaient dans « aujourd'hui », « semaine »
 *   ET « mois » a la fois : trois filtres censes decouper le temps renvoyaient
 *   la meme chose.
 *
 * Le troisieme — « les onglets ne changent rien » — ne s'est pas reproduit :
 * le clic bascule bien l'onglet et declenche la requete correspondante. Ce test
 * le verrouille aussi, puisque c'est ce qui etait mis en doute.
 */

const JOUR = new Date().toISOString().slice(0, 10);

/*
 * Tous les tests partagent un compte : un marqueur unique par test evite qu'ils
 * lisent les taches des precedents. Sans lui, les jeux d'essai s'accumulent et
 * les assertions exactes deviennent impossibles a tenir.
 */
let marqueur = '';

async function preparer(page: Page) {
  marqueur = `F${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
  // Une tache de chaque nature, pour que les filtres aient de quoi trancher.
  await page.request.post('/api/tasks', { data: { title: `${marqueur} sans echeance` } });
  await page.request.post('/api/tasks', { data: { title: `${marqueur} echue`, dueDate: '2026-01-05T12:00:00' } });
  await page.request.post('/api/tasks', { data: { title: `${marqueur} du jour`, dueDate: `${JOUR}T12:00:00` } });
}

async function titres(page: Page, scope: string) {
  const reponse = await page.request.get(`/api/tasks?scope=${scope}`);
  const { data } = (await reponse.json()) as { data?: Array<{ title: string }> };
  return (data ?? []).map((tache) => tache.title).filter((titre) => titre.startsWith(marqueur));
}

test.beforeEach(async ({ page }) => {
  await preparer(page);
});

test('un filtre inconnu est refuse, jamais elargi', async ({ page }) => {
  const reponse = await page.request.get('/api/tasks?scope=done');

  expect(reponse.status(), 'un filtre inconnu doit etre signale').toBe(422);
  const { error } = await reponse.json();
  expect(error.fields?.scope, 'la reponse doit rappeler les valeurs acceptees').toContain('today');
});

test('chaque filtre de periode renvoie ce qu\'il annonce', async ({ page }) => {
  expect(await titres(page, 'today'), '« aujourd\'hui » ne contient que la tache du jour').toEqual([
    `${marqueur} du jour`,
  ]);
  expect(await titres(page, 'overdue'), '« en retard » ne contient que la tache echue').toEqual([`${marqueur} echue`]);
  expect(await titres(page, 'undated'), '« sans echeance » ne contient que la tache sans date').toEqual([
    `${marqueur} sans echeance`,
  ]);

  const toutes = await titres(page, 'all');
  expect(toutes.sort(), '« tout » les contient toutes').toEqual(
    [`${marqueur} du jour`, `${marqueur} echue`, `${marqueur} sans echeance`].sort(),
  );
});

test('une tache sans echeance n\'apparait plus dans les trois periodes a la fois', async ({ page }) => {
  for (const periode of ['today', 'week', 'month']) {
    expect(await titres(page, periode), `« ${periode} » ne doit pas melanger les taches sans date`).not.toContain(
      `${marqueur} sans echeance`,
    );
  }
});

test('« terminees » exige une date d\'achevement', async ({ page }) => {
  const reponse = await page.request.get('/api/tasks?scope=all&status=done');
  const { data } = (await reponse.json()) as { data?: Array<{ completedAt: string | null }> };

  for (const tache of data ?? []) {
    expect(tache.completedAt, 'une tache terminee sans date d\'achevement est une incoherence').not.toBeNull();
  }
});

test('cliquer un onglet change la vue et la requete', async ({ page }) => {
  const requetes: string[] = [];
  page.on('request', (requete) => {
    if (requete.url().includes('/api/tasks?')) requetes.push(new URL(requete.url()).searchParams.get('scope') ?? '');
  });

  await page.goto('/tasks');
  await expect(page.getByRole('tab', { name: 'Aujourd\'hui' })).toHaveAttribute('aria-selected', 'true');

  await page.getByRole('tab', { name: 'En retard' }).click();

  await expect(page.getByRole('tab', { name: 'En retard' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tab', { name: 'Aujourd\'hui' })).toHaveAttribute('aria-selected', 'false');
  expect(requetes, 'le changement d\'onglet doit declencher la requete correspondante').toContain('overdue');

  // La liste suit : la tache echue apparait, celle du jour disparait.
  await expect(page.getByText(`${marqueur} echue`)).toBeVisible();
  await expect(page.getByText(`${marqueur} du jour`)).toBeHidden();
});

test('les taches sans echeance restent visibles sous les vues datees', async ({ page }) => {
  await page.goto('/tasks');

  /*
   * Elles ne se melent plus au filtre « aujourd'hui », mais elles ne doivent
   * pas disparaitre pour autant : une tache creee sans date resterait invisible
   * tant qu'on ne pense pas a changer d'onglet.
   */
  const section = page.locator('section', { hasText: 'Sans echeance' });
  await expect(section).toBeVisible();
  await expect(section.getByText(`${marqueur} sans echeance`)).toBeVisible();
});

test('les onglets forment un vrai groupe accessible', async ({ page }) => {
  await page.goto('/tasks');

  const groupe = page.getByRole('tablist');
  await expect(groupe).toBeVisible();
  await expect(groupe.getByRole('tab')).toHaveCount(6);

  // Le panneau est relie a l'onglet actif, dans les deux sens.
  const actif = page.getByRole('tab', { selected: true });
  const cible = await actif.getAttribute('aria-controls');
  expect(cible).toBe('liste-taches');

  // « Terminees » est un interrupteur, pas une septieme vue : il reste hors du
  // groupe d'onglets tout en partageant son cadre.
  const terminees = page.getByRole('button', { name: motifExact('Terminees') });
  await expect(terminees).toHaveAttribute('aria-pressed', 'false');
});
