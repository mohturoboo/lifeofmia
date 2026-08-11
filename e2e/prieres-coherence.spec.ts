import { test, expect, type Page } from '@playwright/test';

/**
 * Les horaires de priere doivent etre les memes partout.
 *
 * Pour un meme profil et un meme jour, les deux points d'entree divergeaient :
 *
 *   Fajr    03:21 au tableau de bord   contre   03:49 sur la page Prieres
 *   Isha    22:20                                22:01
 *
 * Seules ces deux heures differaient — les seules a dependre de l'angle
 * crepusculaire, donc de la methode de calcul. `/api/dashboard` codait
 * `method: 3` en dur alors qu'il chargeait les reglages de l'utilisateur dans
 * la meme requete sans les utiliser.
 */

const PRIERES = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'] as const;

async function horaires(page: Page) {
  const [tableau, prieres] = await Promise.all([
    page.request.get('/api/dashboard'),
    page.request.get('/api/prayers'),
  ]);

  const a = (await tableau.json()) as { data?: { prayers?: { times?: Record<string, string>; method?: number } } };
  const b = (await prieres.json()) as { data?: { times?: Record<string, string>; settings?: { method: number } } };

  return {
    tableau: a.data?.prayers?.times ?? {},
    prieres: b.data?.times ?? {},
    methodeTableau: a.data?.prayers?.method,
    methodePrieres: b.data?.settings?.method,
  };
}

test('les deux points d\'entree donnent exactement les memes horaires', async ({ page }) => {
  const { tableau, prieres } = await horaires(page);

  for (const priere of PRIERES) {
    expect(tableau[priere], `${priere} doit concorder entre les deux endpoints`).toBe(prieres[priere]);
  }
});

test('changer de methode se repercute des deux cotes', async ({ page }) => {
  /*
   * La verification qui compte : c'est en changeant la methode qu'on prouve
   * que les deux lisent bien le meme reglage. Avec la valeur par defaut, un
   * endpoint qui code la methode en dur passerait le test precedent par
   * coincidence.
   */
  const avant = await horaires(page);

  // Methode 12 (UOIF, 12°) : un angle crepusculaire tres different du defaut.
  const patch = await page.request.patch('/api/prayers', { data: { method: 12 } });
  expect(patch.status()).toBe(200);

  const apres = await horaires(page);

  expect(apres.methodeTableau, 'le tableau de bord doit rapporter la methode choisie').toBe(12);
  expect(apres.methodePrieres, 'la page Prieres doit rapporter la methode choisie').toBe(12);

  for (const priere of PRIERES) {
    expect(apres.tableau[priere], `${priere} doit concorder apres changement de methode`).toBe(apres.prieres[priere]);
  }

  // Et le changement a bien un effet : Fajr et Isha dependent de l'angle.
  expect(
    apres.tableau.Fajr !== avant.tableau.Fajr || apres.tableau.Isha !== avant.tableau.Isha,
    'changer de methode doit deplacer Fajr ou Isha',
  ).toBe(true);

  // Les heures solaires, elles, ne bougent pas : c'est ce contraste qui avait
  // mis la puce a l'oreille dans le rapport d'origine.
  expect(apres.tableau.Dhuhr, 'Dhuhr ne depend pas de la methode').toBe(avant.tableau.Dhuhr);
});

test('le fuseau du profil concorde avec sa ville', async ({ page }) => {
  const reponse = await page.request.get('/api/profile');
  const { data } = (await reponse.json()) as { data?: { profile?: { city: string; timezone: string } } };

  /*
   * Le compte de test est cree a Paris. Le fuseau venait auparavant du
   * navigateur : un appareil regle ailleurs produisait un profil parisien a
   * l'heure d'un autre pays, et toutes les bornes de journee glissaient.
   */
  expect(data?.profile?.city).toBe('Paris');
  expect(data?.profile?.timezone, 'le fuseau doit suivre la ville declaree').toBe('Europe/Paris');
});
