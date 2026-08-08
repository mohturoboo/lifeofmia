import { describe, expect, it } from 'vitest';
import {
  addDaysToKey,
  ageFrom,
  dateKeyIn,
  dateKeyRange,
  daysBetween,
  fromDateKey,
  isDateKey,
  lastNDays,
  startOfMonthKey,
  startOfWeekKey,
  weekDayOf,
} from '@/lib/date';

/**
 * La logique de date est le socle de tous les modules journaliers : une erreur
 * ici decale silencieusement les habitudes, les statistiques et les prieres.
 */
describe('cles de date', () => {
  it('produit la meme journee dans le fuseau de l\'utilisateur', () => {
    // 22 h a Paris le 7 aout = deja le 8 a Tokyo.
    const instant = new Date('2026-08-07T22:00:00Z');
    expect(dateKeyIn('Europe/Paris', instant)).toBe('2026-08-08');
    expect(dateKeyIn('Asia/Tokyo', instant)).toBe('2026-08-08');
    expect(dateKeyIn('America/New_York', instant)).toBe('2026-08-07');
  });

  it('retombe sur UTC pour un fuseau invalide', () => {
    const instant = new Date('2026-08-07T10:00:00Z');
    expect(dateKeyIn('Fuseau/Inexistant', instant)).toBe('2026-08-07');
  });

  it('valide le format des cles', () => {
    expect(isDateKey('2026-08-07')).toBe(true);
    expect(isDateKey('2026-8-7')).toBe(false);
    expect(isDateKey('2026-02-30')).toBe(false); // date inexistante
    expect(isDateKey('hier')).toBe(false);
    expect(isDateKey(20260807)).toBe(false);
  });

  it('decale les jours en franchissant les mois et les annees', () => {
    expect(addDaysToKey('2026-08-07', 1)).toBe('2026-08-08');
    expect(addDaysToKey('2026-08-31', 1)).toBe('2026-09-01');
    expect(addDaysToKey('2026-01-01', -1)).toBe('2025-12-31');
    expect(addDaysToKey('2024-02-28', 1)).toBe('2024-02-29'); // annee bissextile
  });

  it('genere une plage inclusive', () => {
    const range = dateKeyRange('2026-08-01', '2026-08-05');
    expect(range).toEqual(['2026-08-01', '2026-08-02', '2026-08-03', '2026-08-04', '2026-08-05']);
  });

  it('renvoie les N derniers jours en terminant par la date donnee', () => {
    const days = lastNDays(7, '2026-08-07');
    expect(days).toHaveLength(7);
    expect(days[0]).toBe('2026-08-01');
    expect(days[6]).toBe('2026-08-07');
  });

  it('compte les jours entre deux dates', () => {
    expect(daysBetween('2026-08-01', '2026-08-08')).toBe(7);
    expect(daysBetween('2026-08-08', '2026-08-01')).toBe(-7);
    expect(daysBetween('2026-08-01', '2026-08-01')).toBe(0);
  });

  it('trouve le lundi de la semaine', () => {
    // 2026-08-07 est un vendredi.
    expect(weekDayOf('2026-08-07')).toBe(5);
    expect(startOfWeekKey('2026-08-07')).toBe('2026-08-03');
    // Un dimanche appartient a la semaine qui commence le lundi precedent.
    expect(startOfWeekKey('2026-08-09')).toBe('2026-08-03');
  });

  it('trouve le premier jour du mois', () => {
    expect(startOfMonthKey('2026-08-27')).toBe('2026-08-01');
  });

  it('convertit une cle en date a midi UTC', () => {
    const date = fromDateKey('2026-08-07');
    expect(date.toISOString()).toBe('2026-08-07T12:00:00.000Z');
  });

  it('calcule un age', () => {
    expect(ageFrom(null)).toBeNull();
    const birth = new Date();
    birth.setFullYear(birth.getFullYear() - 30);
    expect(ageFrom(birth)).toBe(30);
  });
});
