// @vitest-environment jsdom
import { describe, expect, it, beforeAll, afterEach } from 'vitest';
import { useState } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Modal } from '@/components/ui/modal';

/**
 * Non-regression : perte du focus a chaque caractere saisi.
 *
 * L'effet de montage du Modal dependait de `onClose`. Les appelants passant
 * naturellement une fonction en ligne, son identite changeait a chaque rendu :
 * la moindre frappe relancait l'effet, qui reposait le focus sur le PREMIER
 * champ. Ecrire dans le second champ devenait impossible sans recliquer entre
 * chaque lettre.
 *
 * Ces tests reproduisent exactement ce scenario et verrouillent le correctif.
 */

beforeAll(() => {
  // Framer Motion interroge ces API, absentes de jsdom.
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

  window.requestAnimationFrame ??= ((callback: FrameRequestCallback) =>
    setTimeout(() => callback(performance.now()), 0) as unknown as number) as typeof window.requestAnimationFrame;
  window.cancelAnimationFrame ??= ((handle: number) =>
    clearTimeout(handle)) as typeof window.cancelAnimationFrame;
});

afterEach(cleanup);

/** Formulaire representatif : deux champs, `onClose` en ligne comme partout dans l'app. */
function Formulaire({ onCloseCalled }: { onCloseCalled?: () => void } = {}) {
  const [open, setOpen] = useState(true);
  const [nom, setNom] = useState('');
  const [description, setDescription] = useState('');

  return (
    <Modal
      open={open}
      // Fonction en ligne : nouvelle identite a chaque rendu. C'est l'usage
      // normal de React, le composant doit y resister.
      onClose={() => {
        setOpen(false);
        onCloseCalled?.();
      }}
      title="Formulaire"
    >
      <input aria-label="nom" value={nom} onChange={(event) => setNom(event.target.value)} />
      <textarea
        aria-label="description"
        value={description}
        onChange={(event) => setDescription(event.target.value)}
      />
    </Modal>
  );
}

/**
 * Attend qu'une vraie frame d'animation soit passee.
 *
 * Un simple `setTimeout(10)` ne suffit pas : jsdom cadence
 * `requestAnimationFrame` sur ~16 ms, si bien que le `focus()` d'ouverture du
 * modal pouvait se declencher APRES l'assertion et rendre le test instable.
 * On attend donc deux frames reelles, puis une macrotache pour laisser React
 * appliquer ses effets.
 */
async function frame() {
  await act(async () => {
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve(null))));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe('Modal — conservation du focus pendant la saisie', () => {
  it('garde le focus dans le second champ apres UN caractere', async () => {
    render(<Formulaire />);
    await frame();

    const description = screen.getByLabelText('description');
    description.focus();
    expect(document.activeElement).toBe(description);

    fireEvent.change(description, { target: { value: 'B' } });
    await frame();

    expect(document.activeElement).toBe(description);
  });

  it('permet d\'ecrire une phrase entiere sans recliquer', async () => {
    render(<Formulaire />);
    await frame();

    const description = screen.getByLabelText('description') as HTMLTextAreaElement;
    description.focus();

    const phrase = 'Bonjour Mohamed';
    for (let index = 0; index < phrase.length; index += 1) {
      fireEvent.change(description, { target: { value: phrase.slice(0, index + 1) } });
      await frame();
      // Le focus doit tenir a CHAQUE caractere, pas seulement a la fin.
      expect(document.activeElement, `focus perdu au caractere "${phrase[index]}"`).toBe(description);
    }

    expect(description.value).toBe(phrase);
  });

  it('n\'interfere pas avec la saisie dans le premier champ', async () => {
    render(<Formulaire />);
    await frame();

    const nom = screen.getByLabelText('nom') as HTMLInputElement;
    nom.focus();

    for (const value of ['S', 'Sp', 'Spo', 'Spor', 'Sport']) {
      fireEvent.change(nom, { target: { value } });
      await frame();
      expect(document.activeElement).toBe(nom);
    }
    expect(nom.value).toBe('Sport');
  });

  it('place le focus sur le premier champ a l\'ouverture', async () => {
    render(<Formulaire />);
    await frame();

    // Comportement d'accessibilite attendu, a ne pas perdre en corrigeant le bug.
    expect(document.activeElement).toBe(screen.getByLabelText('nom'));
  });

  it('ferme toujours sur Echap, malgre le passage par une ref', async () => {
    let closed = false;
    render(<Formulaire onCloseCalled={() => (closed = true)} />);
    await frame();

    fireEvent.keyDown(document, { key: 'Escape' });
    await frame();

    expect(closed).toBe(true);
  });

  it('conserve le focus meme apres de nombreux rendus successifs', async () => {
    render(<Formulaire />);
    await frame();

    const description = screen.getByLabelText('description');
    description.focus();

    // 40 rendus : si l'effet se relancait, le focus aurait saute depuis longtemps.
    for (let index = 0; index < 40; index += 1) {
      fireEvent.change(description, { target: { value: 'x'.repeat(index + 1) } });
    }
    await frame();

    expect(document.activeElement).toBe(description);
  });
});
