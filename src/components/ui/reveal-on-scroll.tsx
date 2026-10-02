'use client';

import { useEffect } from 'react';

/**
 * Apparition discrete au scroll des elements marques `data-reveal`.
 *
 * - Ne fait rien sous `prefers-reduced-motion` ni sans IntersectionObserver.
 * - Ne decale que les elements encore hors ecran au montage : rien ne bouge
 *   dans la premiere vue, et le contenu reste visible quoi qu'il arrive
 *   (translation seule, jamais d'opacite).
 * - `data-reveal="<n>"` ajoute un decalage de n x 60 ms (cartes d'une meme grille).
 */
export function RevealOnScroll() {
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const elements = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'));
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.remove('lm-reveal-pending');
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: '0px 0px -8% 0px' },
    );

    for (const element of elements) {
      if (element.getBoundingClientRect().top < window.innerHeight) continue;
      const rang = Number(element.dataset.reveal) || 0;
      element.style.setProperty('--lm-reveal-delay', `${Math.min(rang, 5) * 60}ms`);
      element.classList.add('lm-reveal-pending');
      observer.observe(element);
    }

    return () => observer.disconnect();
  }, []);

  return null;
}
