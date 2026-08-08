# Architecture technique

## Vue d'ensemble

LifeofM est une application Next.js 15 **full-stack** : l'interface (App Router) et
l'API REST (Route Handlers) vivent dans le même projet et partagent leurs types, leurs
schémas de validation et leur couche métier.

```
Navigateur
    │
    ├── Pages React (Server Components + Client Components)
    │
    └── /api/*  Route Handlers
                    │
                    ├── lib/api/handler.ts    auth · CSRF · rate-limit · validation
                    ├── lib/**               couche métier
                    └── Prisma → SQLite (dev) / PostgreSQL (prod)
```

### Pourquoi pas un backend NestJS séparé ?

Le cahier des charges initial proposait Next.js + NestJS. Un backend séparé aurait
imposé deux déploiements, une duplication des types et des schémas de validation, et une
couche HTTP interne — pour un gain nul ici : il n'existe pas d'autre client que cette
interface, et Next.js sait déjà exécuter du code serveur.

Le choix retenu conserve les bénéfices attendus (séparation nette, API REST documentée,
couche métier testable isolément) sans le coût. Si un client mobile natif devait
apparaître, l'API REST existante le servirait telle quelle.

---

## Arborescence

```
MOHOS/
├── prisma/
│   ├── schema.prisma           27 modèles
│   └── seed.ts                 90 jours de données réalistes
├── scripts/
│   └── use-db.mjs              bascule SQLite ↔ PostgreSQL
├── tests/                      80 tests Vitest
├── docs/
└── src/
    ├── app/
    │   ├── layout.tsx          racine — lit langue et thème depuis la session
    │   ├── page.tsx            landing publique
    │   ├── (auth)/             connexion, inscription, mot de passe oublié…
    │   ├── (app)/              espace connecté (garde d'authentification)
    │   │   ├── layout.tsx      providers + coquille applicative
    │   │   ├── dashboard/  habits/  tasks/  goals/
    │   │   ├── nutrition/  weight/  sport/
    │   │   ├── journal/    prayers/ calendar/ finance/ notes/
    │   │   └── stats/      compare/ ai/      settings/
    │   └── api/                Route Handlers REST
    ├── components/
    │   ├── ui/                 primitives, icônes, modale, notifications
    │   ├── charts/             graphiques SVG maison
    │   ├── app-shell/          barre latérale, en-tête, navigation
    │   ├── theme-provider.tsx
    │   └── page-header.tsx
    ├── lib/
    │   ├── auth/               mot de passe, JWT, session, jetons, rate-limit
    │   ├── api/                enveloppe de route, format de réponse
    │   ├── validation/         schémas Zod partagés API ↔ IA
    │   ├── ai/                 contexte, outils, boucle agentique
    │   ├── client/             client HTTP + hook de lecture
    │   ├── date.ts  stats.ts  gamification.ts
    │   ├── prayer.ts  weather.ts  quotes.ts
    │   ├── prisma.ts  env.ts  json.ts  mailer.ts  audit.ts  onboarding.ts
    ├── i18n/                   config, provider, 8 dictionnaires
    └── middleware.ts           aiguillage Edge
```

---

## Décisions structurantes

### 1. Une enveloppe unique pour toutes les routes

`lib/api/handler.ts` expose `route()` (protégée) et `publicRoute()`. Chaque handler
reçoit un contexte déjà validé :

```ts
export const POST = route(
  async ({ user, body }) => {
    const habit = await prisma.habit.create({ data: { userId: user.id, ...body } });
    return created(habit);
  },
  { schema: habitCreateSchema },
);
```

L'enveloppe garantit, pour **toutes** les routes sans exception :
authentification, vérification d'origine (CSRF), limitation de débit, validation Zod du
corps, et traduction des exceptions en réponses HTTP cohérentes.

Le bénéfice est autant sécuritaire qu'ergonomique : il devient impossible d'oublier une
de ces protections en ajoutant une route.

### 2. Isolation par `userId` dans la clause `where`

Aucune requête n'utilise `findUnique({ where: { id } })` seul. Toutes passent par
`findFirst({ where: { id, userId } })`. Un identifiant deviné ne donne accès à rien —
la route renvoie `NOT_FOUND`, jamais les données d'autrui.

Ce point est couvert par un test d'intégration manuel documenté dans le README et
vérifié à chaque livraison.

### 3. Un schéma compatible SQLite et PostgreSQL

Le schéma Prisma évite `enum`, `Json` et les tableaux natifs — non supportés ou
divergents entre les deux moteurs. Les listes sont stockées en JSON sérialisé
(`lib/json.ts` encapsule la conversion et ne jette jamais), les énumérations sont des
`String` validées par Zod côté application.

Conséquence pratique : `npm run db:use postgresql` suffit à passer en production, sans
réécriture ni migration de forme.

### 4. Les statistiques sont pré-agrégées

Recalculer 365 jours d'historique à chaque affichage serait rédhibitoire. Le modèle
`DailyStat` conserve un instantané par jour et par utilisateur ; `recomputeDay()` le met
à jour après chaque écriture significative.

Les pages Tableau de bord, Statistiques et Comparaison lisent alors une table unique et
indexée, ce qui les rend instantanées même sur plusieurs années.

### 5. Des graphiques SVG écrits dans le projet

`components/charts/` fournit courbe lissée (Catmull-Rom → Bézier), histogramme, anneau,
radar, heatmap annuelle, sparkline et anneau de progression.

Motivations : aucun kilo-octet de dépendance, aucun risque d'incompatibilité avec
React 19, un rendu serveur immédiat, des couleurs qui suivent les variables du thème, et
une accessibilité explicite (`role="img"` avec description).

### 6. Les dates raisonnent dans le fuseau de l'utilisateur

Toute la logique journalière manipule des clés `YYYY-MM-DD` calculées via
`dateKeyIn(timezone)`, jamais l'heure du serveur. Un utilisateur à Tokyo et un autre à
Paris voient chacun leur propre « aujourd'hui ».

C'est la partie la plus densément testée du projet : une erreur ici décalerait
silencieusement habitudes, statistiques et horaires de prière.

### 7. Les horaires de prière fonctionnent hors ligne

`lib/prayer.ts` interroge l'API AlAdhan (référentiel largement utilisé), et bascule sur
un calcul astronomique local — position solaire, équation du temps, résolution de
l'angle horaire — si le réseau est indisponible.

Le calcul gère les hautes latitudes : au-delà des cercles polaires, lorsque le soleil ne
franchit jamais l'angle demandé, une journée nominale de 12 heures est utilisée puis la
règle du « septième de nuit » s'applique. Ce cas est couvert par un test (Tromsø en
juin) qui avait révélé un vrai bug lors du développement.

### 8. Le middleware ne touche pas la base

Le middleware s'exécute dans le runtime Edge, qui ne dispose ni de `node:crypto` ni de
Prisma. Il se limite donc à vérifier la **signature** du jeton avec `jose` pour décider
d'une redirection.

La révocation de session, elle, est vérifiée côté Node dans `requireUser()`. Ce
double niveau donne une redirection rapide sans requête, et une garantie réelle au
moment où les données sont servies. La constante `SESSION_COOKIE` vit dans
`lib/auth/constants.ts` précisément pour que le middleware puisse l'importer sans
entraîner tout le module de session dans le bundle Edge.

### 9. L'agent IA partage la validation de l'interface

Les outils de `lib/ai/tools.ts` réutilisent les schémas Zod de `lib/validation/`.
L'agent ne peut donc rien écrire qu'un humain ne pourrait pas saisir via un formulaire :
mêmes bornes, mêmes formats, mêmes valeurs par défaut.

Chaque exécuteur reçoit l'utilisateur de la session et écrit `userId` lui-même ; le
modèle n'a aucun moyen de désigner un autre compte. Les identifiants d'objets fournis
par le modèle sont systématiquement revérifiés comme appartenant à l'utilisateur avant
usage.

La boucle agentique est plafonnée à 6 tours pour qu'une erreur d'outil répétée ne puisse
pas la faire tourner — et facturer — indéfiniment.

### 10. Les huit langues sont vérifiées à la compilation

Le dictionnaire français est la référence ; `Dictionary` en est le type dérivé. Toute
clé ajoutée doit être traduite dans les sept autres langues, sinon `tsc` échoue. Un test
complète la garantie en vérifiant qu'aucune traduction n'est vide et qu'aucune clé
superflue n'a été introduite.

---

## Modèle de données

27 modèles, tous rattachés à `User` avec suppression en cascade.

**Identité** — `User`, `Session`, `VerificationToken`
**Quotidien** — `Habit`, `HabitLog`, `Task`, `Goal`, `GoalStep`
**Corps** — `Meal`, `WaterLog`, `WeightEntry`, `Workout`, `Exercise`, `FocusSession`
**Esprit** — `JournalEntry`, `PrayerSettings`, `PrayerLog`
**Vie** — `Transaction`, `Project`, `Note`, `CalendarEvent`
**Analyse** — `DailyStat`, `Badge`, `UserBadge`, `XpEvent`
**Système** — `Notification`, `AiConversation`, `AiMessage`, `AuditLog`

Index posés sur les accès réels : `(userId, date)` pour tous les modèles journaliers,
`(userId, status)` pour les tâches et objectifs, contraintes d'unicité sur
`(habitId, date)`, `(userId, date)` et `(userId, date, name)` afin qu'un double envoi ne
crée jamais de doublon.

---

## Gamification

Courbe de progression quadratique douce :

```
XP requise pour le niveau L  =  50·(L−1)² + 50·(L−1)
```

Les premiers niveaux arrivent vite, puis l'écart se creuse — l'application ne se
« termine » pas au bout de quelques semaines.

Le score de discipline pondère les piliers plutôt que d'en faire la moyenne brute :
habitudes 40 %, tâches 25 %, prières 15 %, sport 10 %, concentration 10 %. Un pilier
sans engagement (aucune habitude définie) est exclu du calcul au lieu de pénaliser.

L'XP est **symétrique** : annuler une validation la retire. Le score reste honnête, et
cocher/décocher en boucle ne permet pas de gonfler son niveau.

---

## Sécurité — récapitulatif

| Menace | Parade |
| --- | --- |
| Fuite de mots de passe | bcrypt 12 tours, jamais journalisés ni exportés |
| Vol de session | Cookie `httpOnly` + `SameSite=Lax` + `Secure` en production, révocable en base |
| CSRF | Vérification d'origine sur toutes les méthodes mutantes |
| Force brute | Limitation par IP **et** verrouillage progressif par compte |
| Énumération de comptes | Réponses identiques que l'email existe ou non |
| Accès horizontal | `userId` dans la clause `where` de chaque requête |
| XSS | Échappement React + Content-Security-Policy |
| Fuite via l'IA | Contexte construit à partir du seul utilisateur de la session |
| Fuite de jetons en base | Seule l'empreinte SHA-256 est stockée |

---

## Tests

80 tests couvrant la couche métier :

| Fichier | Portée |
| --- | --- |
| `date.test.ts` | Fuseaux, franchissement de mois et d'années, années bissextiles |
| `gamification.test.ts` | Courbe de niveaux, bornes, pondération du score |
| `stats.test.ts` | Agrégation, régression de poids, IMC et catégories limites |
| `prayer.test.ts` | Ordre chronologique, madhhab, hautes latitudes, prière suivante |
| `security.test.ts` | Hachage, JWT, limitation de débit, validation des entrées |
| `i18n.test.ts` | Complétude des 8 langues, RTL, citations |

Deux bugs réels ont été trouvés et corrigés par cette suite : la normalisation des
emails avant validation Zod, et le calcul des horaires de prière au-delà du cercle
polaire.
