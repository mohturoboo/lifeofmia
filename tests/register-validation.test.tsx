// @vitest-environment jsdom
import { describe, expect, it, afterEach, beforeAll, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import RegisterPage from '@/app/(auth)/register/page';
import { I18nProvider } from '@/i18n/provider';

// Le routeur d'App Router n'existe pas hors d'une navigation Next : seule la
// bascule d'etape nous interesse ici, pas la redirection finale.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
}));

/**
 * Non-regression : premiere etape de l'inscription silencieuse.
 *
 * Le bouton « Suivant » etait desactive tant que la saisie n'etait pas valide,
 * et le formulaire porte `noValidate` — donc pas de bulle du navigateur non
 * plus. L'utilisateur cliquait sur un bouton inerte sans qu'aucun texte ne lui
 * dise ce qui n'allait pas : rien ne distinguait « formulaire refuse » de
 * « application cassee ».
 */

beforeAll(() => {
  window.matchMedia ??= ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
});

afterEach(cleanup);

function afficher() {
  return render(
    <I18nProvider initialLocale="fr">
      <RegisterPage />
    </I18nProvider>,
  );
}

const suivant = () => screen.getByRole('button', { name: /Suivant/i });
const saisir = (label: RegExp, valeur: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value: valeur } });

describe('Inscription — etape 1', () => {
  it('propose un bouton actionnable des le depart', () => {
    afficher();
    expect((suivant() as HTMLButtonElement).disabled).toBe(false);
  });

  it('explique chaque champ vide au lieu de rester muette', async () => {
    afficher();
    await act(async () => { fireEvent.click(suivant()); });

    expect(screen.getAllByText('Ce champ est obligatoire.').length).toBe(4);
    // La page ne progresse pas tant que l'etape 1 n'est pas valide.
    expect(screen.getByText(/Étape 1\/2/)).toBeTruthy();
  });

  it('signale une adresse email mal formee', async () => {
    afficher();
    saisir(/Prénom/i, 'Moha');
    saisir(/^Nom/i, 'Test');
    saisir(/Adresse email/i, 'pas-un-email');
    saisir(/Mot de passe/i, 'MotDePasse1');
    await act(async () => { fireEvent.click(suivant()); });

    expect(screen.getByText(/Adresse email invalide/)).toBeTruthy();
  });

  it('distingue un mot de passe trop court d\'un mot de passe trop simple', async () => {
    afficher();
    saisir(/Prénom/i, 'Moha');
    saisir(/^Nom/i, 'Test');
    saisir(/Adresse email/i, 'moha@exemple.fr');

    saisir(/Mot de passe/i, 'abc');
    await act(async () => { fireEvent.click(suivant()); });
    expect(screen.getByText('8 caractères minimum.')).toBeTruthy();

    saisir(/Mot de passe/i, 'motdepasse');
    await act(async () => { fireEvent.click(suivant()); });
    expect(screen.getByText(/Ajoutez une majuscule/)).toBeTruthy();
  });

  it('efface le message des que le champ fautif est repris', async () => {
    afficher();
    await act(async () => { fireEvent.click(suivant()); });
    expect(screen.getAllByText('Ce champ est obligatoire.').length).toBe(4);

    saisir(/Prénom/i, 'M');
    expect(screen.getAllByText('Ce champ est obligatoire.').length).toBe(3);
  });

  it('passe a l\'etape 2 quand tout est valide', async () => {
    afficher();
    saisir(/Prénom/i, 'Moha');
    saisir(/^Nom/i, 'Test');
    saisir(/Adresse email/i, 'moha@exemple.fr');
    saisir(/Mot de passe/i, 'MotDePasse1');
    await act(async () => { fireEvent.click(suivant()); });

    expect(screen.getByText(/Étape 2\/2/)).toBeTruthy();
  });
});
