import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/locales/fr';

/**
 * Controle des dictionnaires, partage par `npm run lint:i18n` et par les tests.
 *
 * Trois verifications :
 *  - parite : chaque langue porte toutes les cles du francais, aucune cle
 *    inventee (hors formes plurielles du CLDR), aucune valeur vide ;
 *  - variables : un `{count}` du francais existe aussi dans la traduction,
 *    sinon le nombre disparait de l'ecran ;
 *  - accents : aucune valeur francaise ne contient un mot courant prive de
 *    ses accents (« reglages », « prieres », « debut »...).
 *
 * Les autres langues ont ete saisies sans accents a l'origine ; leurs mots
 * desaccentues sont signales en avertissement, pas en erreur, tant que leur
 * reprise n'est pas faite.
 */

const CATEGORIES = ['zero', 'one', 'two', 'few', 'many', 'other'];

/**
 * Mots francais courants ecrits sans leurs accents. Aucun n'existe tel quel,
 * ni comme identifiant de code (« theme », « role » en sont donc exclus).
 */
const FRANCAIS_DESACCENTUE = [
  'acces', 'annee', 'annees', 'apres', 'bientot', 'caractere', 'caracteres', 'categorie',
  'categories', 'connecte', 'controle', 'cree', 'creee', 'creer', 'debut', 'deconnecte', 'deconnexion',
  'definir', 'defini', 'definie', 'deja', 'depasser', 'derniere', 'dernieres', 'detail', 'details',
  'deuxieme', 'donnee', 'donnees', 'duree', 'echeance', 'ecran', 'ecrire', 'egale', 'energie', 'entree',
  'entrees', 'equilibre', 'etape', 'etapes', 'etait', 'ete', 'etes', 'etre', 'evenement', 'evenements',
  'eviter', 'facon', 'francais', 'frequence', 'generer', 'idee', 'inferieure', 'interieur', 'journee',
  'maniere', 'meme', 'memes', 'methode', 'metrique', 'necessaire', 'numero', 'parametres', 'pensee',
  'pensees', 'periode', 'periodes', 'plutot', 'precedent', 'precedente', 'premiere', 'premieres',
  'priere', 'prieres', 'progres', 'reessayez', 'reglage', 'reglages', 'reinitialisation',
  'reinitialiser', 'repetee', 'reponse', 'requete', 'reseau', 'reunis', 'reussi', 'reussie', 'reussite',
  'sante', 'seance', 'seances', 'securite', 'selectionnez', 'succes', 'superieure', 'systeme',
  'tache', 'taches', 'telecharger', 'telephone', 'tres', 'unite', 'unites',
  'verifiez', 'verifier', 'verification',
];

/** Echantillon par langue, pour mesurer la reprise restant a faire. */
const AUTRES_DESACCENTUES: Partial<Record<Locale, string[]>> = {
  es: ['dia', 'dias', 'tambien', 'aqui', 'numero', 'contrasena', 'sesion', 'configuracion', 'informacion',
    'ultimo', 'ultimos', 'proximo', 'rapido', 'categoria', 'categorias', 'energia', 'periodo', 'metrica',
    'oracion', 'oraciones'],
  pt: ['nao', 'voce', 'definicoes', 'sessao', 'configuracoes', 'informacao', 'numero', 'ultimo', 'proximo',
    'tambem', 'ate', 'entao', 'sao', 'categoria', 'energia', 'periodo', 'oracao', 'oracoes'],
  it: ['gia', 'piu', 'perche', 'cosi', 'citta', 'attivita', 'unita', 'puo', 'sara', 'qualita'],
  de: ['fur', 'uber', 'zuruck', 'mussen', 'konnen', 'moglich', 'loschen', 'andern', 'hinzufugen', 'wahlen',
    'gerat', 'gerate', 'starke', 'taglich', 'tagliche', 'wochentlich', 'zusatzlich', 'ubung', 'ubungen'],
  tr: ['icin', 'gun', 'gunu', 'gunluk', 'bugun', 'degil', 'sifre', 'sifreyi', 'giris', 'cikis', 'saglik',
    'ozet', 'basari', 'haftalik', 'aylik', 'secin', 'goster', 'gizle', 'simdi', 'cok', 'ogun'],
};

function motifMots(mots: string[]): RegExp {
  // Bornes Unicode : « été » ne doit pas faire correspondre « ete ».
  return new RegExp(`(?<![\\p{L}])(${mots.join('|')})(?![\\p{L}])`, 'iu');
}

function variables(texte: string): string[] {
  return Array.from(texte.matchAll(/\{(\w+)\}/g), (m) => m[1]).sort();
}

export interface RapportI18n {
  erreurs: string[];
  avertissements: string[];
}

export function controlerDictionnaires(dictionnaires: Record<Locale, Dictionary>): RapportI18n {
  const erreurs: string[] = [];
  const avertissements: string[] = [];
  const reference = dictionnaires.fr as Record<string, string>;
  const cles = Object.keys(reference);
  const racines = new Set(cles.filter((cle) => cle.endsWith('_one')).map((cle) => cle.slice(0, -4)));
  const racineDe = (cle: string) => {
    const separateur = cle.lastIndexOf('_');
    if (separateur === -1) return null;
    const racine = cle.slice(0, separateur);
    return racines.has(racine) && CATEGORIES.includes(cle.slice(separateur + 1)) ? racine : null;
  };

  for (const [locale, dictionnaire] of Object.entries(dictionnaires) as Array<[Locale, Record<string, string>]>) {
    for (const cle of cles) {
      if (!(cle in dictionnaire)) erreurs.push(`[${locale}] cle manquante : ${cle}`);
    }
    for (const [cle, valeur] of Object.entries(dictionnaire)) {
      const racine = racineDe(cle);
      if (!(cle in reference) && !racine) erreurs.push(`[${locale}] cle inconnue : ${cle}`);
      if (valeur.trim().length === 0) erreurs.push(`[${locale}] valeur vide : ${cle}`);
      const modele = reference[cle] ?? (racine ? reference[`${racine}_other`] : undefined);
      if (modele === undefined) continue;
      /*
       * Les formes `zero`, `one` et `two` peuvent omettre `{count}` (« يومان ») :
       * le nombre y est porte par le mot. Partout ailleurs il reste du.
       */
      const nombreImplicite = racine !== null && /_(zero|one|two)$/.test(cle);
      const attendues = variables(modele).filter((nom) => !(nombreImplicite && nom === 'count'));
      const presentes = variables(valeur);
      const absentes = attendues.filter((nom) => !presentes.includes(nom));
      if (absentes.length > 0) erreurs.push(`[${locale}] ${cle} : variable(s) absente(s) ${absentes.join(', ')}`);
    }
  }

  const francais = motifMots(FRANCAIS_DESACCENTUE);
  for (const [cle, valeur] of Object.entries(reference)) {
    const trouve = valeur.match(francais);
    if (trouve) erreurs.push(`[fr] ${cle} : « ${trouve[1]} » sans accents`);
  }

  for (const [locale, mots] of Object.entries(AUTRES_DESACCENTUES) as Array<[Locale, string[]]>) {
    const motif = motifMots(mots);
    const fautives = Object.entries(dictionnaires[locale] as Record<string, string>).filter(([, valeur]) =>
      motif.test(valeur),
    );
    if (fautives.length > 0) {
      avertissements.push(
        `[${locale}] ${fautives.length} valeur(s) sans accents, ex. ${fautives
          .slice(0, 3)
          .map(([cle]) => cle)
          .join(', ')}`,
      );
    }
  }

  return { erreurs, avertissements };
}

/** Controle d'un texte francais isole (messages serveur, donnees de depart). */
export function motsDesaccentues(texte: string): string[] {
  const motif = new RegExp(motifMots(FRANCAIS_DESACCENTUE).source, 'giu');
  return Array.from(texte.matchAll(motif), (m) => m[1]);
}

/**
 * Sources dont les chaines francaises sont lues par l'utilisateur sans passer
 * par le dictionnaire : messages d'API et de validation, badges, habitudes de
 * depart, e-mails, donnees de demonstration.
 *
 * Exclus volontairement : les descriptions d'outils et le contexte envoyes au
 * modele (`lib/ai/tools.ts`, `lib/ai/context.ts`), qui ne s'affichent pas.
 */
export const SOURCES_FRANCAISES = [
  'src/app/api',
  'src/lib/api',
  'src/lib/validation',
  'src/lib/client/api.ts',
  'src/lib/gamification.ts',
  'src/lib/onboarding.ts',
  'src/lib/mailer.ts',
  'prisma/seed.ts',
];

/** Mots desaccentues trouves dans les chaines (hors commentaires) d'un fichier source. */
export function controlerSource(contenu: string): Array<{ ligne: number; mots: string[] }> {
  // Les commentaires restent en ASCII par convention : on les neutralise.
  const sansCommentaires = contenu
    .replace(/\/\*[\s\S]*?\*\//g, (bloc) => bloc.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
  const resultats: Array<{ ligne: number; mots: string[] }> = [];
  sansCommentaires.split('\n').forEach((texte, index) => {
    const mots = Array.from(texte.matchAll(/(['"`])((?:\\.|(?!\1).)*)\1/g)).flatMap((m) => motsDesaccentues(m[2]));
    if (mots.length > 0) resultats.push({ ligne: index + 1, mots });
  });
  return resultats;
}
