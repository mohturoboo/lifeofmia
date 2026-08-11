'use client';

import { useEffect, useRef, type RefObject } from 'react';

/**
 * Piege a focus pour toute surface modale : fenetre, tiroir de navigation.
 *
 * Le comportement etait deja ecrit dans `Modal`, et nulle part ailleurs. Le
 * tiroir mobile s'ouvrait donc par-dessus la page sans rien confiner : la
 * touche Tab continuait de parcourir le contenu masque derriere le voile, la
 * touche Echap ne fermait rien, et le focus restait sur le bouton d'ouverture
 * — un utilisateur au clavier se retrouvait a naviguer dans une page qu'il ne
 * voyait plus.
 *
 * Le comportement est extrait ici pour que les deux surfaces partagent
 * exactement les memes regles :
 *
 *  - Echap ferme ;
 *  - Tab et Maj+Tab bouclent a l'interieur du panneau ;
 *  - le focus se pose a l'ouverture, SYNCHRONEMENT (attendre une image
 *    d'animation laissait partir vers l'ancien element tout ce qui etait
 *    frappe entre-temps) ;
 *  - il revient a l'element declencheur a la fermeture ;
 *  - le defilement de la page est bloque pendant l'affichage.
 */

const SELECTEUR_FOCUSABLE =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Dernier element focalise EN DEHORS de toute surface modale.
 *
 * La memoire est au niveau du module, et non dans l'etat du composant, parce
 * qu'une fenetre peut se remonter alors qu'elle est deja ouverte — un
 * rafraichissement de donnees suffit a faire repasser la page par son
 * squelette, ce qui detruit puis recree la fenetre. L'effet s'executait alors
 * une seconde fois et prenait pour « element declencheur » le champ deja
 * focalise A L'INTERIEUR de la fenetre. A la fermeture, la restitution visait
 * donc un noeud qui venait d'etre retire du document : le focus retombait sur
 * `<body>` et l'utilisateur au clavier repartait du haut de la page.
 *
 * Un seul ecouteur, pose a la premiere utilisation, en phase de capture.
 */
let dernierFocusHorsDialogue: HTMLElement | null = null;
let ecouteurPose = false;

function suivreLeFocus(): void {
  if (ecouteurPose || typeof document === 'undefined') return;
  ecouteurPose = true;

  document.addEventListener(
    'focusin',
    (evenement) => {
      const cible = evenement.target as HTMLElement | null;
      if (!cible || cible === document.body) return;
      if (cible.closest?.('[role="dialog"]')) return;
      dernierFocusHorsDialogue = cible;
    },
    true,
  );
}

export interface OptionsPiegeFocus {
  /**
   * Placer le focus sur le premier CHAMP de saisie plutot que sur le premier
   * element focusable — qui est le bouton de fermeture, place avant le contenu
   * dans le DOM. Sans cette distinction, le `autoFocus` des formulaires etait
   * systematiquement ecrase.
   */
  prioriteAuxChamps?: boolean;
}

export function usePiegeFocus(
  ouvert: boolean,
  panneauRef: RefObject<HTMLElement | null>,
  onFermer: () => void,
  options: OptionsPiegeFocus = {},
): void {
  const { prioriteAuxChamps = false } = options;

  suivreLeFocus();

  /*
   * `onFermer` passe par une ref plutot que par les dependances de l'effet.
   *
   * Les appelants ecrivent naturellement une fonction en ligne, dont
   * l'identite change a chaque rendu. Si l'effet en dependait, la moindre
   * frappe declencherait son nettoyage puis sa reexecution — donc un `focus()`
   * force sur le premier element. L'utilisateur perdait le curseur apres
   * chaque caractere.
   */
  const fermerRef = useRef(onFermer);
  useEffect(() => {
    fermerRef.current = onFermer;
  }, [onFermer]);

  useEffect(() => {
    if (!ouvert) return;

    const actif = document.activeElement as HTMLElement | null;
    const horsDialogue = actif && actif !== document.body && !actif.closest('[role="dialog"]');
    const precedent = horsDialogue ? actif : dernierFocusHorsDialogue;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    document.body.dataset.dialogOpen = 'true';

    const focusables = () =>
      Array.from(panneauRef.current?.querySelectorAll<HTMLElement>(SELECTEUR_FOCUSABLE) ?? []).filter(
        (element) => !element.hasAttribute('disabled'),
      );

    const elements = focusables();
    const premierChamp = prioriteAuxChamps
      ? elements.find((element) => ['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName))
      : undefined;
    (premierChamp ?? elements[0] ?? panneauRef.current)?.focus();

    const surTouche = (evenement: KeyboardEvent) => {
      if (evenement.key === 'Escape') {
        evenement.preventDefault();
        fermerRef.current();
        return;
      }
      if (evenement.key !== 'Tab') return;

      const courants = focusables();
      if (courants.length === 0) return;
      const premier = courants[0];
      const dernier = courants[courants.length - 1];

      if (evenement.shiftKey && document.activeElement === premier) {
        evenement.preventDefault();
        dernier.focus();
      } else if (!evenement.shiftKey && document.activeElement === dernier) {
        evenement.preventDefault();
        premier.focus();
      }
    };

    document.addEventListener('keydown', surTouche);
    return () => {
      document.removeEventListener('keydown', surTouche);
      document.body.style.overflow = overflow;
      delete document.body.dataset.dialogOpen;

      /*
       * Restitution du focus a l'image SUIVANTE, et non immediatement.
       *
       * Le nettoyage s'execute pendant que React demonte encore le panneau :
       * retirer du document l'element qui portait le focus renvoie celui-ci
       * sur `<body>`, et ce retour ecrasait la restitution faite juste avant.
       * L'utilisateur au clavier se retrouvait en haut de page, ayant perdu
       * l'endroit d'ou il etait parti.
       *
       * `isConnected` protege le cas ou le declencheur a disparu entre-temps
       * — une carte supprimee depuis sa propre fenetre, par exemple.
       */
      requestAnimationFrame(() => {
        if (precedent?.isConnected) precedent.focus();
      });
    };
    // `panneauRef` est stable, `prioriteAuxChamps` ne change pas en cours de vie.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ouvert]);
}
