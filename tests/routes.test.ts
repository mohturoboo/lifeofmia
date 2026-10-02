import { describe, expect, it } from 'vitest';
import { ALL_NAV_ITEMS } from '@/components/app-shell/navigation';
import { GUEST_ONLY_PAGES, INDEXABLE_PAGES, PROTECTED_PREFIXES } from '@/config/routes';

describe('liste des routes', () => {
  it('protege chaque page de la navigation', () => {
    for (const item of ALL_NAV_ITEMS) {
      expect(PROTECTED_PREFIXES, item.href).toContain(item.href);
    }
  });

  it("n'indexe aucune page protegee ni de reinitialisation", () => {
    for (const { path } of INDEXABLE_PAGES) {
      expect(PROTECTED_PREFIXES).not.toContain(path);
      expect(path).not.toBe('/reset-password');
    }
  });

  it('ne melange pas pages invitees et pages protegees', () => {
    for (const page of GUEST_ONLY_PAGES) expect(PROTECTED_PREFIXES).not.toContain(page);
  });
});
