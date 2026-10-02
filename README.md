# LifeofM

**Le système d'exploitation de votre vie quotidienne.**

Habitudes, objectifs, nutrition, poids, sport, journal, prières, finances, agenda et
statistiques réunis dans un espace personnel unique — accompagné d'un agent IA qui
connaît uniquement vos données et construit vos plans à votre place.

```
Chaque compte est totalement isolé. Toutes les données sont sauvegardées.
```

---

## Démarrage rapide

Aucune base de données à installer : le mode développement utilise SQLite.

Prérequis : Node.js 20 ou plus récent.

```bash
cp .env.example .env     # variables d'environnement (voir plus bas)
npm run setup            # npm install + SQLite + schéma + données de démonstration
npm run dev
```

> Le schéma Prisma versionné cible PostgreSQL (production). `npm run db:use sqlite`
> (lancé par `setup`) réécrit le `provider` de `prisma/schema.prisma` pour le
> développement local : ne commitez pas cette modification.

Ouvrez <http://localhost:3000> et connectez-vous au compte de démonstration :

| Identifiant        | Mot de passe |
| ------------------ | ------------ |
| `demo@lifeofm.app` | `Demo1234`   |

Le compte de démonstration contient **90 jours d'historique réaliste** : les graphiques,
la heatmap annuelle, les séries et la page de comparaison sont immédiatement remplis.

---

## Fonctionnalités

### Authentification et compte

- Inscription en deux étapes, connexion, déconnexion
- Réinitialisation de mot de passe par lien à usage unique
- Sessions JWT `httpOnly` révocables côté serveur
- Mots de passe hachés en bcrypt (12 tours), verrouillage progressif après 5 échecs
- Export complet des données et suppression du compte (RGPD)

### Tableau de bord

Salutation contextuelle, date et heure locale, météo en direct, lever et coucher du
soleil, horaires de prière, citation du jour, objectif principal, progression
quotidienne, score de discipline, série, niveau, XP, badges et graphiques.

### Modules

| Module           | Contenu                                                                                                                                           |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Habitudes**    | Icône, couleur, catégorie, fréquence, objectif quotidien, rappel, habitudes à éviter, série, historique 30 jours                                  |
| **Tâches**       | Sous-tâches, priorités, échéances, filtres (aujourd'hui / semaine / mois / en retard), récompense XP                                              |
| **Objectifs**    | Court, moyen et long terme, étapes cochables, progression automatique, sous-objectifs                                                             |
| **Alimentation** | 4 repas, macronutriments complets, modèles réutilisables, suivi d'hydratation                                                                     |
| **Poids**        | Historique, IMC, courbe, **projection à 30 jours par régression linéaire**                                                                        |
| **Sport**        | Séances, exercices, séries, répétitions, charges, distance, intensité, répartition                                                                |
| **Journal**      | Humeur, énergie, pensées, gratitude, une entrée par jour                                                                                          |
| **Prières**      | Horaires calculés pour votre position exacte, méthode et madhhab configurables, calcul local de secours si le service d'horaires est indisponible |
| **Finances**     | Revenus, dépenses, catégories, solde mensuel                                                                                                      |
| **Agenda**       | Vue mensuelle fusionnant événements et tâches datées                                                                                              |
| **Notes**        | Recherche, épinglage, couleurs                                                                                                                    |
| **Statistiques** | Courbes, radar d'équilibre de vie, heatmap annuelle, répartition par catégorie                                                                    |
| **Comparaison**  | Passé / présent sur 7 j, 30 j, 3 m, 6 m, 1 an ou depuis le début                                                                                  |

### Agent IA « Life AI »

Alimenté par l'API Claude avec appel d'outils réels. Il peut créer et supprimer des
habitudes, créer des tâches, construire des objectifs complets avec leurs étapes,
proposer des repas et des séances, planifier une journée et analyser les statistiques.

> « Je veux perdre 10 kg » → l'agent crée l'objectif, ses étapes, les habitudes qui y
> mènent et explique sa logique.

**Isolation stricte** : chaque outil reçoit l'utilisateur de la session et écrit
`userId` lui-même. Le modèle ne peut pas fournir d'identifiant d'utilisateur et ne voit
jamais les données d'un autre compte.

### Multilingue

Huit langues complètes — **français, anglais, arabe, espagnol, allemand, italien,
portugais, turc** — changeables à tout moment. L'arabe s'affiche en RTL. Un test
vérifie qu'aucune clé n'est manquante ni vide dans aucune langue.

### Design

Mode sombre et clair sans clignotement au chargement, animations fluides
(Framer Motion), responsive mobile-first, accessible (navigation clavier, focus
visibles, `aria-*`, lien d'évitement, respect de `prefers-reduced-motion`).

---

## Stack technique

| Couche           | Choix                                                                               |
| ---------------- | ----------------------------------------------------------------------------------- |
| Framework        | Next.js 15 (App Router) + React 19 + TypeScript strict                              |
| Style            | Tailwind CSS v4 (thème en CSS, sans `tailwind.config`)                              |
| Animations       | Framer Motion 12                                                                    |
| Graphiques       | **SVG maison, zéro dépendance** (courbe, barres, anneau, radar, heatmap, sparkline) |
| Base de données  | Prisma 6 — SQLite en développement, PostgreSQL en production                        |
| Authentification | JWT `jose` (compatible Edge) + bcrypt                                               |
| Validation       | Zod 4, partagée entre l'API REST et les outils de l'IA                              |
| IA               | `@anthropic-ai/sdk` — Claude avec `tool_use`                                        |
| Tests            | Vitest (unitaires) + Playwright (bout en bout)                                      |
| Conteneurisation | Dockerfile multi-étapes + docker-compose (app + PostgreSQL)                         |

**Aucune librairie de graphiques, d'icônes ou de composants** : tout est écrit dans le
projet, ce qui supprime les risques d'incompatibilité et allège le bundle.

---

## Commandes

```bash
npm run dev            # serveur de développement
npm run build          # prisma generate + build de production
npm run start          # serveur de production
npm run lint           # ESLint
npm run lint:i18n      # parité et accents des traductions
npm run typecheck      # vérification TypeScript
npm run format         # Prettier (format:check pour vérifier seulement)
npm run test           # tests unitaires (Vitest)
npm run test:e2e       # tests bout en bout (Playwright, serveur sur :3000)
npm run check          # typecheck + lint + tests
npm run db:push        # applique le schéma
npm run db:seed        # données de démonstration
npm run db:studio      # explorateur de base
npm run db:use sqlite       # bascule sur SQLite
npm run db:use postgresql   # bascule sur PostgreSQL
```

Les scripts de correction ponctuelle de données (`db:fix-*`, `db:recompute-stats`) sont
dans `scripts/maintenance/`.

---

## Variables d'environnement

Copiez `.env.example` en `.env`. Seules ces variables sont lues par l'application :

| Variable                                                             | Rôle                                                                   | Obligatoire |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------- | ----------- |
| `DATABASE_URL`                                                       | SQLite (`file:./dev.db`) ou PostgreSQL                                 | oui         |
| `AUTH_SECRET`                                                        | Signature des sessions ; la valeur d'exemple est refusée en production | production  |
| `NEXT_PUBLIC_APP_URL`                                                | URL publique (liens d'email, robots.txt, plan de site)                 | recommandé  |
| `REFRESH_TOKEN_TTL_DAYS`                                             | Durée de la session (30 par défaut)                                    | non         |
| `ANTHROPIC_API_KEY`, `AI_MODEL`                                      | Agent « Life AI » (désactivé sans clé)                                 | non         |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM` | Emails de réinitialisation (sinon écrits dans la console)              | non         |
| `OPENWEATHER_API_KEY`                                                | Météo du tableau de bord                                               | non         |
| `ALADHAN_API_URL`, `NOMINATIM_URL`                                   | Horaires de prière et géocodage (publics, valeurs par défaut)          | non         |

## Déploiement (Vercel)

1. Importez le dépôt dans Vercel ; `vercel.json` fixe la région `fra1`.
2. Créez une base PostgreSQL managée (Neon, Supabase, Vercel Postgres) et renseignez
   `DATABASE_URL` ; le schéma versionné cible déjà PostgreSQL.
3. Définissez `AUTH_SECRET` (générez-le : `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`),
   `NEXT_PUBLIC_APP_URL` et, au besoin, les autres variables ci-dessus.
4. Appliquez le schéma une fois : `DATABASE_URL=… npx prisma db push`.
5. Le build exécute `prisma generate && next build`. Chaque branche reçoit une URL d'aperçu.

Détails et autres hébergeurs : [docs/INSTALLATION.md](docs/INSTALLATION.md).

## Organisation du code

```
src/app/          pages (App Router), routes d'API, styles globaux (globals.css)
src/components/   interface : ui/ (primitives), charts/, app-shell/
src/config/       configuration centralisée (routes)
src/i18n/         dictionnaires (8 langues) et traducteur
src/lib/          logique métier, accès base, authentification, IA
tests/  e2e/      Vitest et Playwright
scripts/          utilitaires (maintenance/ : corrections ponctuelles de données)
```

---

## Passer en PostgreSQL

```bash
npm run db:use postgresql
# puis dans .env :
# DATABASE_URL="postgresql://user:pass@localhost:5432/lifeofm?schema=public"
npm run db:push
```

Le schéma est écrit dans un sous-ensemble compatible avec les deux moteurs (pas
d'`enum`, pas de `Json`, pas de tableaux natifs) : aucune autre modification n'est
nécessaire.

## Docker

```bash
echo "AUTH_SECRET=$(node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))")" > .env
npm run db:use postgresql
docker compose up -d
```

---

## Documentation

- [docs/INSTALLATION.md](docs/INSTALLATION.md) — installation, configuration, déploiement
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — structure, modèle de données, décisions techniques
- [docs/API.md](docs/API.md) — référence complète de l'API REST

---

## Sécurité

- Mots de passe bcrypt (12 tours), jamais journalisés ni exportés
- Sessions révocables côté serveur, vérifiées à chaque requête
- Protection CSRF par vérification d'origine sur toutes les méthodes mutantes
- Limitation de débit sur connexion, inscription, réinitialisation et IA
- Verrouillage progressif du compte après 5 tentatives échouées
- En-têtes de sécurité stricts, CSP incluse
- Isolation par `userId` sur **toutes** les requêtes de base de données
- Journalisation des actions sensibles (connexions, exports, actions de l'IA)
- Réponses identiques que l'email existe ou non (pas d'énumération de comptes)

---

## Licence

Projet privé. © 2026 LifeofM.
