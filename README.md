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

```bash
npm install
cp .env.example .env
npm run db:push
npm run db:seed
npm run dev
```

Ouvrez <http://localhost:3000> et connectez-vous au compte de démonstration :

| Identifiant           | Mot de passe |
| --------------------- | ------------ |
| `demo@lifeofm.app`    | `Demo1234`   |

Le compte de démonstration contient **90 jours d'historique réaliste** : les graphiques,
la heatmap annuelle, les séries et la page de comparaison sont immédiatement remplis.

---

## Fonctionnalités

### Authentification et compte
- Inscription en deux étapes, connexion, déconnexion
- Vérification d'email et réinitialisation de mot de passe par lien à usage unique
- Sessions JWT `httpOnly` révocables côté serveur
- Mots de passe hachés en bcrypt (12 tours), verrouillage progressif après échecs
- Export complet des données et suppression du compte (RGPD)

### Tableau de bord
Salutation contextuelle, date et heure locale, météo en direct, lever et coucher du
soleil, horaires de prière, citation du jour, objectif principal, progression
quotidienne, score de discipline, série, niveau, XP, badges et graphiques.

### Modules
| Module | Contenu |
| --- | --- |
| **Habitudes** | Icône, couleur, catégorie, fréquence, objectif quotidien, rappel, habitudes à éviter, série, historique 30 jours |
| **Tâches** | Sous-tâches, priorités, échéances, filtres (aujourd'hui / semaine / mois / en retard), récompense XP |
| **Objectifs** | Court, moyen et long terme, étapes cochables, progression automatique, sous-objectifs |
| **Alimentation** | 4 repas, macronutriments complets, modèles réutilisables, suivi d'hydratation |
| **Poids** | Historique, IMC, courbe, **projection à 30 jours par régression linéaire** |
| **Sport** | Séances, exercices, séries, répétitions, charges, distance, intensité, répartition |
| **Journal** | Humeur, énergie, pensées, gratitude, une entrée par jour |
| **Prières** | Horaires calculés pour votre position exacte, méthode et madhhab configurables, **fonctionne hors ligne** |
| **Finances** | Revenus, dépenses, catégories, solde mensuel |
| **Agenda** | Vue mensuelle fusionnant événements et tâches datées |
| **Notes** | Recherche, épinglage, couleurs |
| **Statistiques** | Courbes, radar d'équilibre de vie, heatmap annuelle, répartition par catégorie |
| **Comparaison** | Passé / présent sur 7 j, 30 j, 3 m, 6 m, 1 an ou depuis le début |

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

| Couche | Choix |
| --- | --- |
| Framework | Next.js 15 (App Router) + React 19 + TypeScript strict |
| Style | Tailwind CSS v4 (thème en CSS, sans `tailwind.config`) |
| Animations | Framer Motion 12 |
| Graphiques | **SVG maison, zéro dépendance** (courbe, barres, anneau, radar, heatmap, sparkline) |
| Base de données | Prisma 6 — SQLite en développement, PostgreSQL en production |
| Authentification | JWT `jose` (compatible Edge) + bcrypt |
| Validation | Zod 4, partagée entre l'API REST et les outils de l'IA |
| IA | `@anthropic-ai/sdk` — Claude avec `tool_use` |
| Tests | Vitest — 80 tests |
| Conteneurisation | Dockerfile multi-étapes + docker-compose (app + PostgreSQL) |

**Aucune librairie de graphiques, d'icônes ou de composants** : tout est écrit dans le
projet, ce qui supprime les risques d'incompatibilité et allège le bundle.

---

## Commandes

```bash
npm run dev            # serveur de développement
npm run build          # build de production
npm run start          # serveur de production
npm run typecheck      # vérification TypeScript
npm run test           # tests unitaires
npm run db:push        # applique le schéma
npm run db:seed        # données de démonstration
npm run db:studio      # explorateur de base
npm run db:use sqlite       # bascule sur SQLite
npm run db:use postgresql   # bascule sur PostgreSQL
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
- Verrouillage du compte après 8 tentatives échouées
- En-têtes de sécurité stricts, CSP incluse
- Isolation par `userId` sur **toutes** les requêtes de base de données
- Journalisation des actions sensibles (connexions, exports, actions de l'IA)
- Réponses identiques que l'email existe ou non (pas d'énumération de comptes)

---

## Licence

Projet privé. © 2026 LifeofM.
