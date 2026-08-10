import { test as setup, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { FICHIER_SESSION } from './session';

/**
 * Compte de test unique, cree une fois par execution.
 *
 * Chaque test creait auparavant le sien : la protection anti-abus sur
 * l'inscription — qui fait exactement son travail — refusait la sixieme
 * tentative de l'heure et faisait echouer la suite pour une raison etrangere a
 * ce qu'elle mesure.
 *
 * Le compte reste NEUF a chaque execution : les tests qui verifient un etat de
 * depart (« 0,0 L », « 0/5 ») gardent donc leur sens.
 */

setup('cree le compte de test', async ({ page }) => {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@lifeofm.test`;

  const reponse = await page.request.post('/api/auth/register', {
    data: {
      email,
      password: 'MotDePasse1',
      firstName: 'Test',
      lastName: 'E2E',
      country: 'France',
      city: 'Paris',
      timezone: 'Europe/Paris',
      locale: 'fr',
      acceptTerms: true,
    },
  });

  expect(reponse.status(), await reponse.text()).toBe(201);

  fs.mkdirSync(path.dirname(FICHIER_SESSION), { recursive: true });
  await page.context().storageState({ path: FICHIER_SESSION });
});
