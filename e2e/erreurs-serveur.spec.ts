import { test, expect } from '@playwright/test';

/**
 * Les erreurs de validation du serveur doivent atteindre l'utilisateur.
 *
 * L'API repondait deja en francais et champ par champ :
 *
 *   422 { "error": { "code": "VALIDATION",
 *                    "message": "Certains champs sont invalides.",
 *                    "fields": { "name": "Le nom ne peut pas depasser 80 caracteres." } } }
 *
 * Le client jetait ce detail : les formulaires affichaient « Une erreur est
 * survenue », ou rien du tout. L'utilisateur voyait sa saisie refusee sans
 * savoir quoi corriger.
 */

test('un nom d\'habitude trop long est explique sous le champ', async ({ page }) => {
  await page.goto('/habits');
  await page.getByRole('button', { name: 'Nouvelle habitude' }).click();

  const champ = page.locator('#habit-name');
  // On neutralise la borne du navigateur pour eprouver la reponse du SERVEUR.
  await champ.evaluate((el) => el.removeAttribute('maxlength'));
  await champ.fill('x'.repeat(81));

  await page.getByRole('dialog').getByRole('button', { name: 'Enregistrer' }).click();

  await expect(page.locator('#habit-name-error')).toHaveText('Le nom ne peut pas depasser 80 caracteres.');
  await expect(champ).toHaveAttribute('aria-invalid', 'true');
  await expect(champ).toHaveAttribute('aria-describedby', 'habit-name-error');

  // La fenetre reste ouverte et la saisie intacte : elle doit rester corrigible.
  await expect(page.getByRole('dialog')).toBeVisible();
  expect((await champ.inputValue()).length).toBe(81);

  // Reprendre le champ efface le message.
  await champ.fill('Habitude corrigee E2E');
  await expect(page.locator('#habit-name-error')).toHaveCount(0);

  await page.getByRole('dialog').getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.getByRole('heading', { name: 'Habitude corrigee E2E' })).toBeVisible();
});

test('une taille hors bornes est expliquee sous le champ', async ({ page }) => {
  await page.goto('/settings');

  const champ = page.locator('#height');
  await champ.evaluate((el) => el.removeAttribute('max'));
  await champ.fill('500');

  await page.getByRole('button', { name: 'Enregistrer' }).first().click();

  await expect(page.locator('#height-error')).toHaveText('La taille doit etre comprise entre 50 et 250 cm.');
  await expect(champ).toHaveAttribute('aria-invalid', 'true');
});

test('le formulaire previent l\'erreur au lieu de la subir', async ({ page }) => {
  await page.goto('/habits');
  await page.getByRole('button', { name: 'Nouvelle habitude' }).click();

  const champ = page.locator('#habit-name');
  await champ.fill('x'.repeat(120));

  // La limite du serveur est appliquee et annoncee des la saisie.
  expect((await champ.inputValue()).length, 'la saisie doit etre bornee a 80').toBe(80);
  await expect(page.getByText('80/80')).toBeVisible();
});

test('les messages du serveur sont en francais, jamais « Invalid input »', async ({ page }) => {
  /*
   * Seuls les champs ecrits a la main portaient un message ; partout ailleurs
   * l'utilisateur recevait le texte par defaut de la bibliotheque de
   * validation, en anglais.
   */
  const reponse = await page.request.post('/api/workouts', {
    data: { date: '2026-08-10', name: '', durationMin: 99999 },
  });

  expect(reponse.status()).toBe(422);
  const { error } = await reponse.json();
  const messages = Object.values(error.fields ?? {}) as string[];

  expect(messages.length, 'le serveur doit detailler les champs fautifs').toBeGreaterThan(0);
  for (const message of messages) {
    expect(message, `message non traduit : « ${message} »`).not.toMatch(/Invalid input|Too big|Too small|expected/i);
  }
});

test('« Annuler » ferme la fenetre au lieu de la soumettre', async ({ page }) => {
  /*
   * En HTML, un bouton sans `type` vaut `submit`. Place dans un formulaire —
   * ce que les fenetres sont devenues pour accepter la touche Entree —
   * « Annuler » aurait enregistre la saisie au lieu de l'abandonner.
   */
  await page.goto('/habits');
  await page.getByRole('button', { name: 'Nouvelle habitude' }).click();

  const fenetre = page.getByRole('dialog');
  await fenetre.locator('#habit-name').fill('Habitude abandonnee E2E');
  await fenetre.getByRole('button', { name: 'Annuler' }).click();

  await expect(fenetre).toBeHidden();
  await expect(page.getByRole('heading', { name: 'Habitude abandonnee E2E' })).toHaveCount(0);
});

test('la touche Entree valide le formulaire', async ({ page }) => {
  await page.goto('/habits');
  await page.getByRole('button', { name: 'Nouvelle habitude' }).click();

  const champ = page.getByRole('dialog').locator('#habit-name');
  await champ.fill('Habitude au clavier E2E');
  await champ.press('Enter');

  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.getByRole('heading', { name: 'Habitude au clavier E2E' })).toBeVisible();
});

test('les champs obligatoires le declarent vraiment', async ({ page }) => {
  // L'asterisque du libelle annoncait une obligation que le champ ne portait
  // pas : ni `required`, ni `aria-required`.
  await page.goto('/habits');
  await page.getByRole('button', { name: 'Nouvelle habitude' }).click();
  await expect(page.locator('#habit-name')).toHaveAttribute('aria-required', 'true');
  await page.getByRole('dialog').getByRole('button', { name: 'Annuler' }).click();

  await page.goto('/goals');
  await page.getByRole('button', { name: 'Nouvel objectif' }).click();
  await expect(page.locator('#goal-title')).toHaveAttribute('aria-required', 'true');
});

test('aucun champ de saisie ne reste anonyme', async ({ page }) => {
  await page.goto('/goals');
  await page.getByRole('button', { name: 'Nouvel objectif' }).click();

  // Un champ sans `id` ni `name` n'est associable ni a un libelle, ni a un
  // message d'erreur, ni au remplissage automatique du navigateur.
  const anonymes = await page.getByRole('dialog').evaluate((fenetre) =>
    [...fenetre.querySelectorAll('input, textarea, select')]
      .filter((champ) => !champ.id && !champ.getAttribute('name'))
      .map((champ) => champ.outerHTML.slice(0, 80)),
  );

  expect(anonymes).toEqual([]);
});
