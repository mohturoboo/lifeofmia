import { describe, expect, it } from 'vitest';
import { LOGIN_BACKOFF, RATE_LIMITS } from '@/lib/auth/rate-limit';
import { bucketCompte, bucketIp } from '@/lib/auth/rate-limit-store';

/**
 * Reglages de la limitation de debit sur l'authentification.
 *
 * Le comportement du compteur partage se verifie de bout en bout (il parle a la
 * base) ; ce qui se teste ici, ce sont les valeurs et les cles — la partie ou
 * une erreur passe inapercue le plus longtemps.
 */

describe('bornes de l authentification', () => {
  it('limite la connexion a cinq tentatives par quart d heure et par compte', () => {
    expect(RATE_LIMITS.login.limit).toBe(5);
    expect(RATE_LIMITS.login.windowMs).toBe(15 * 60_000);
  });

  it('laisse la borne par adresse IP plus large que celle par compte', () => {
    /*
     * Une adresse IP n'identifie pas une personne : bureau, campus, reseau
     * mobile. La serrer au niveau du compte exclurait tout un immeuble parce
     * qu'un de ses occupants s'est trompe de mot de passe.
     */
    expect(RATE_LIMITS.loginIp.limit).toBeGreaterThan(RATE_LIMITS.login.limit);
    expect(RATE_LIMITS.passwordResetIp.limit).toBeGreaterThan(RATE_LIMITS.passwordReset.limit);
  });

  it('borne aussi l inscription et la reinitialisation', () => {
    expect(RATE_LIMITS.register.limit).toBeLessThanOrEqual(10);
    expect(RATE_LIMITS.register.windowMs).toBe(60 * 60_000);
    expect(RATE_LIMITS.passwordReset.limit).toBeLessThanOrEqual(5);
  });

  it('applique un recul exponentiel plafonne', () => {
    const { baseDelaySeconds, maxDelaySeconds } = LOGIN_BACKOFF;

    // 30 s, 1 min, 2 min, 4 min...
    const attente = (refus: number) => Math.min(maxDelaySeconds, baseDelaySeconds * 2 ** refus);
    expect(attente(0)).toBe(30);
    expect(attente(1)).toBe(60);
    expect(attente(3)).toBe(240);
    // Le plafond evite qu'un incident ne bloque un compte pour la journee.
    expect(attente(20)).toBe(maxDelaySeconds);
    expect(maxDelaySeconds).toBeLessThanOrEqual(60 * 60);
  });
});

describe('cles de compteur', () => {
  it('separe strictement les compteurs par IP et par compte', () => {
    expect(bucketIp('login', '1.2.3.4')).toBe('login:ip:1.2.3.4');
    expect(bucketCompte('login', 'qui@exemple.fr')).toBe('login:compte:qui@exemple.fr');
    expect(bucketIp('login', '1.2.3.4')).not.toBe(bucketCompte('login', '1.2.3.4'));
  });

  it('normalise l adresse email : la casse ne cree pas un second compteur', () => {
    /*
     * Sans normalisation, « Qui@Exemple.FR » et « qui@exemple.fr » ouvraient
     * deux compteurs distincts pour le meme compte : il suffisait d'alterner la
     * casse pour doubler le quota.
     */
    expect(bucketCompte('login', '  Qui@Exemple.FR ')).toBe('login:compte:qui@exemple.fr');
  });

  it('ne melange pas les compteurs de deux routes differentes', () => {
    expect(bucketCompte('login', 'a@b.fr')).not.toBe(bucketCompte('forgot', 'a@b.fr'));
  });
});
