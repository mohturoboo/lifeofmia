import { test as teardown } from '@playwright/test';
import fs from 'node:fs';
import { FICHIER_SESSION } from './session';

/** Supprime le compte de test et tout ce qui en depend. */
teardown('supprime le compte de test', async ({ page }) => {
  await page.request.delete('/api/profile').catch(() => undefined);
  fs.rmSync(FICHIER_SESSION, { force: true });
});
