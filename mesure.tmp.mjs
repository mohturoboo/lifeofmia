import { chromium } from '@playwright/test';
const BASE = process.env.CIBLE ?? 'https://lifeofmia-j1np.vercel.app';
const nav = await chromium.launch();
const ctx = await nav.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();

const email = `perf-${Date.now()}@lifeofm.test`;
const r = await page.request.post(BASE + '/api/auth/register', { data: { email, password: 'MotDePasse1', firstName: 'P', lastName: 'T', country: 'France', city: 'Paris', timezone: 'Europe/Paris', locale: 'fr', acceptTerms: true } });
if (r.status() !== 201) { console.log('inscription', r.status(), await r.text()); await nav.close(); process.exit(1); }

console.log(`  cible : ${BASE}\n`);
console.log('  page        anim.  transitions  backdrop-filter  cartes a opacite 0  delai avant visibilite');
console.log('  --------------------------------------------------------------------------------------------');

for (const chemin of ['/habits', '/dashboard']) {
  await page.goto(BASE + chemin, { waitUntil: 'commit' });

  // Delai avant que la premiere carte soit reellement opaque.
  const delai = await page.evaluate(() => new Promise((resolve) => {
    const depart = performance.now();
    const tic = () => {
      const carte = document.querySelector('main .lm-card');
      if (carte && getComputedStyle(carte).opacity === '1') return resolve(Math.round(performance.now() - depart));
      if (performance.now() - depart > 20000) return resolve(-1);
      setTimeout(tic, 30);
    };
    tic();
  }));

  await page.waitForLoadState('networkidle');
  const compte = await page.evaluate(() => {
    let animations = 0, transitions = 0, flous = 0, opaciteZero = 0;
    for (const el of document.querySelectorAll('body *')) {
      const s = getComputedStyle(el);
      if (s.animationName !== 'none') animations += 1;
      if (s.transitionProperty !== 'all' && s.transitionProperty !== 'none') transitions += 1;
      if (s.backdropFilter !== 'none') flous += 1;
      if (Number(s.opacity) === 0) opaciteZero += 1;
    }
    return { animations, transitions, flous, opaciteZero, total: document.querySelectorAll('body *').length };
  });

  console.log(`  ${chemin.padEnd(11)} ${String(compte.animations).padStart(4)}  ${String(compte.transitions).padStart(10)}  ${String(compte.flous).padStart(14)}  ${String(compte.opaciteZero).padStart(17)}  ${delai === -1 ? 'jamais' : delai + ' ms'}`);
  console.log(`              (${compte.total} elements au total, dont ${compte.animations + compte.transitions} anime ou en transition)`);
}

await page.request.delete(BASE + '/api/profile').catch(() => {});
await nav.close();
