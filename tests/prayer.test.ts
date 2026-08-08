import { describe, expect, it } from 'vitest';
import { computePrayerTimes, currentAndNext, methodById, PRAYER_METHODS } from '@/lib/prayer';

/**
 * Le calcul local doit rester correct : c'est le mode de repli quand l'API
 * AlAdhan est inaccessible, et le seul disponible hors ligne.
 */
describe('calcul local des horaires', () => {
  const paris = { latitude: 48.8566, longitude: 2.3522, timezoneOffsetHours: 2 }; // heure d'ete

  it('produit six horaires au format HH:mm', () => {
    const times = computePrayerTimes({ date: '2026-08-07', ...paris });
    for (const value of Object.values(times)) {
      expect(value).toMatch(/^([01]\d|2[0-3]):[0-5]\d$/);
    }
  });

  it('respecte l\'ordre chronologique de la journee', () => {
    const times = computePrayerTimes({ date: '2026-08-07', ...paris });
    const minutes = (value: string) => {
      const [h, m] = value.split(':').map(Number);
      return h * 60 + m;
    };

    expect(minutes(times.Fajr)).toBeLessThan(minutes(times.Sunrise));
    expect(minutes(times.Sunrise)).toBeLessThan(minutes(times.Dhuhr));
    expect(minutes(times.Dhuhr)).toBeLessThan(minutes(times.Asr));
    expect(minutes(times.Asr)).toBeLessThan(minutes(times.Maghrib));
    expect(minutes(times.Maghrib)).toBeLessThan(minutes(times.Isha));
  });

  it('donne un midi solaire plausible pour Paris en aout', () => {
    const times = computePrayerTimes({ date: '2026-08-07', ...paris });
    const [hour] = times.Dhuhr.split(':').map(Number);
    expect(hour).toBeGreaterThanOrEqual(13);
    expect(hour).toBeLessThanOrEqual(14);
  });

  it('avance le Asr avec le madhhab hanafite', () => {
    const shafi = computePrayerTimes({ date: '2026-08-07', ...paris, school: 0 });
    const hanafi = computePrayerTimes({ date: '2026-08-07', ...paris, school: 1 });
    // L'ombre doublee repousse le Asr plus tard dans la journee.
    expect(hanafi.Asr > shafi.Asr).toBe(true);
  });

  it('decale les horaires avec le fuseau', () => {
    const utc = computePrayerTimes({ date: '2026-08-07', ...paris, timezoneOffsetHours: 0 });
    const local = computePrayerTimes({ date: '2026-08-07', ...paris, timezoneOffsetHours: 2 });
    expect(utc.Dhuhr).not.toBe(local.Dhuhr);
  });

  it('reste defini aux hautes latitudes (regle du septieme de nuit)', () => {
    // Tromso en juin : le soleil ne se couche pas.
    const times = computePrayerTimes({
      date: '2026-06-21',
      latitude: 69.65,
      longitude: 18.96,
      timezoneOffsetHours: 2,
    });
    expect(times.Fajr).not.toBe('--:--');
    expect(times.Isha).not.toBe('--:--');
  });

  it('expose une methode par defaut pour un identifiant inconnu', () => {
    expect(methodById(999)).toBe(PRAYER_METHODS[0]);
    expect(methodById(2).name).toContain('ISNA');
  });
});

describe('priere courante et suivante', () => {
  const times = {
    Fajr: '05:00',
    Sunrise: '06:30',
    Dhuhr: '13:45',
    Asr: '17:30',
    Maghrib: '21:15',
    Isha: '22:45',
  };

  it('identifie la priere suivante en journee', () => {
    const result = currentAndNext(times, '14:00');
    expect(result.current).toBe('Dhuhr');
    expect(result.next).toBe('Asr');
    expect(result.minutesToNext).toBe(210);
  });

  it('bascule sur le Fajr du lendemain apres Isha', () => {
    const result = currentAndNext(times, '23:30');
    expect(result.current).toBe('Isha');
    expect(result.next).toBe('Fajr');
    // 30 minutes jusqu'a minuit + 5 heures jusqu'au Fajr.
    expect(result.minutesToNext).toBe(330);
  });

  it('annonce le Fajr avant l\'aube', () => {
    const result = currentAndNext(times, '03:00');
    expect(result.current).toBeNull();
    expect(result.next).toBe('Fajr');
    expect(result.minutesToNext).toBe(120);
  });

  it('ne casse pas sur des horaires indisponibles', () => {
    const result = currentAndNext(
      { Fajr: '--:--', Sunrise: '--:--', Dhuhr: '--:--', Asr: '--:--', Maghrib: '--:--', Isha: '--:--' },
      '12:00',
    );
    expect(result.current).toBeNull();
    expect(result.next).toBeNull();
  });
});
