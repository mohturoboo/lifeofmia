# Référence de l'API REST

Base : `/api` · Format : JSON · Authentification : cookie de session `httpOnly`

---

## Conventions

**Succès**
```json
{ "data": { ... } }
```

**Erreur**
```json
{ "error": { "code": "VALIDATION", "message": "...", "fields": { "email": "..." } } }
```

| Code | HTTP | Signification |
| --- | --- | --- |
| `UNAUTHORIZED` | 401 | Session absente, expirée ou révoquée |
| `FORBIDDEN` | 403 | Origine non autorisée (CSRF) |
| `NOT_FOUND` | 404 | Ressource inexistante **ou n'appartenant pas à l'utilisateur** |
| `CONFLICT` | 409 | Doublon (email déjà utilisé) |
| `VALIDATION` | 422 | Champs invalides, détail dans `fields` |
| `RATE_LIMITED` | 429 | Trop de requêtes, en-tête `Retry-After` |
| `AI_DISABLED` | 503 | `ANTHROPIC_API_KEY` non configurée |
| `SERVER_ERROR` | 500 | Erreur interne |

### Règles transversales

- Toute route hors `/api/auth/*` et `/api/health` exige une session valide.
- Les méthodes `POST`, `PUT`, `PATCH` et `DELETE` vérifient l'en-tête `Origin`.
- Les dates journalières sont des chaînes `YYYY-MM-DD` dans le fuseau de l'utilisateur.
- Aucune route n'accepte de `userId` : il provient systématiquement de la session.

---

## Authentification

### `POST /api/auth/register`
Crée un compte, installe l'espace de départ (5 habitudes, réglages de prière, objectif
principal), envoie le lien de vérification et ouvre la session.

```json
{
  "firstName": "Mohamed", "lastName": "Ali",
  "email": "mohamed@exemple.fr", "password": "MotDePasse1",
  "city": "Paris", "country": "France",
  "timezone": "Europe/Paris", "locale": "fr",
  "birthDate": "1998-04-12", "gender": "male",
  "mainGoal": "Perdre 10 kg", "acceptTerms": true
}
```

`201` · Limite : 5 par heure et par IP.
Mot de passe : 8 caractères minimum, une minuscule, une majuscule, un chiffre.

### `POST /api/auth/login`
```json
{ "email": "mohamed@exemple.fr", "password": "MotDePasse1" }
```
L'email est nettoyé et mis en minuscules avant validation.
Limite : 8 par 15 minutes et par IP. Verrouillage du compte 15 minutes après 8 échecs.
Le message d'erreur est identique que le compte existe ou non.

### `POST /api/auth/logout`
Révoque la session courante en base et efface le cookie.

### `POST /api/auth/forgot-password`
```json
{ "email": "mohamed@exemple.fr" }
```
Répond toujours `{ "data": { "sent": true } }`, que l'adresse existe ou non.

### `POST /api/auth/reset-password`
```json
{ "token": "<reçu par email>", "password": "NouveauPass1" }
```
Révoque **toutes** les sessions de l'utilisateur.

> Il n'existe **pas** d'étape de vérification d'adresse email : un compte est
> utilisable dès sa création. Le champ `emailVerified` reste en base (il est
> renseigné à l'inscription) pour l'export RGPD et pour pouvoir réintroduire la
> vérification plus tard sans migration.

---

## Profil

### `GET /api/profile`
Profil complet, progression de niveau, badges débloqués, sessions actives.

### `PATCH /api/profile`
Mise à jour partielle. Champs : `firstName`, `lastName`, `city`, `country`, `latitude`,
`longitude`, `timezone`, `locale`, `theme`, `timeFormat`, `units`, `birthDate`,
`gender`, `heightCm`, `mainGoal`, `avatarUrl`, `marketingOptIn`.

> Changer `city` sans fournir de coordonnées déclenche une résolution automatique —
> météo et horaires de prière suivent immédiatement.

### `POST /api/profile/password`
```json
{ "currentPassword": "...", "newPassword": "..." }
```
Déconnecte les autres appareils, conserve la session courante.

### `GET /api/profile/export`
Télécharge l'intégralité des données au format JSON (RGPD, article 20). Le hash du mot
de passe et les secrets 2FA sont exclus.

### `DELETE /api/profile`
Suppression définitive du compte et de toutes les données liées (cascade).

---

## Tableau de bord

### `GET /api/dashboard`
Point d'entrée unique de la page d'accueil. Une seule requête renvoie :
statistiques du jour, habitudes programmées avec leur état, tâches à venir, objectif
principal, dernière pesée, série et niveau, météo, horaires de prière avec la prochaine
échéance, citation du jour et les 7 derniers jours.

Les appels externes (météo, prières) sont parallélisés et ne peuvent pas faire échouer
la réponse.

---

## Habitudes

| Méthode | Route | Rôle |
| --- | --- | --- |
| `GET` | `/api/habits?archived=false` | Liste avec série, taux de réussite et historique 30 jours |
| `POST` | `/api/habits` | Création |
| `PATCH` | `/api/habits/{id}` | Modification, `archived: true` pour archiver |
| `DELETE` | `/api/habits/{id}` | Suppression (historique inclus) |
| `POST` | `/api/habits/{id}/log` | Valider ou annuler pour une date |

**Création**
```json
{
  "name": "Lire 30 minutes", "category": "mind",
  "icon": "book", "color": "#8b5cf6",
  "targetPerDay": 1, "unit": null,
  "reminderAt": "07:00", "isNegative": false, "xpReward": 15
}
```
Catégories : `health`, `spirituality`, `mind`, `work`, `sport`, `social`, `other`.

**Journalisation**
```json
{ "date": "2026-08-07", "count": 1, "status": "done" }
```
Statuts : `done`, `skipped`, `failed`.

Réponse : `{ status, count, xpAwarded, streak, stats, newBadges }`.
L'XP est **symétrique** — repasser à `skipped` retire les points accordés.

---

## Tâches

| Méthode | Route |
| --- | --- |
| `GET` | `/api/tasks?scope=today\|week\|month\|overdue\|all&status=&goalId=&projectId=` |
| `POST` | `/api/tasks` |
| `PATCH` | `/api/tasks/{id}` |
| `DELETE` | `/api/tasks/{id}` |

```json
{
  "title": "Préparer la présentation",
  "priority": "high", "status": "todo",
  "dueDate": "2026-08-10T12:00:00",
  "estimateMin": 90, "parentId": null, "goalId": null, "tags": []
}
```
Priorités : `low`, `medium`, `high`, `urgent` · Statuts : `todo`, `doing`, `done`, `cancelled`.
Passer à `done` accorde l'XP et met à jour les statistiques du jour d'échéance.

---

## Objectifs

| Méthode | Route |
| --- | --- |
| `GET` | `/api/goals?status=&horizon=` |
| `POST` | `/api/goals` |
| `PATCH` | `/api/goals/{id}` |
| `DELETE` | `/api/goals/{id}` |
| `POST` | `/api/goals/{id}/steps` |
| `PATCH` | `/api/goals/{id}/steps` |

```json
{
  "title": "Perdre 10 kg", "category": "health", "horizon": "mid",
  "targetValue": 78, "currentValue": 88, "unit": "kg",
  "deadline": "2026-12-31T12:00:00",
  "steps": ["Déficit de 400 kcal", "4 séances par semaine", "10 000 pas par jour"]
}
```
Horizons : `short`, `mid`, `long` · Catégories : `health`, `career`, `finance`,
`spiritual`, `learning`, `personal`.

La progression est recalculée automatiquement depuis les étapes cochées.
Atteindre un objectif accorde 200 XP.

**Modifier une étape**
```json
{ "stepId": "clx...", "done": true }
{ "stepId": "clx...", "remove": true }
```

---

## Alimentation

| Méthode | Route |
| --- | --- |
| `GET` | `/api/meals?date=YYYY-MM-DD` |
| `POST` | `/api/meals` |
| `PATCH` · `DELETE` | `/api/meals/{id}` |
| `POST` | `/api/water` |

```json
{
  "date": "2026-08-07", "type": "lunch", "name": "Poulet et riz",
  "calories": 620, "protein": 45, "carbs": 70, "fat": 15, "fiber": 8,
  "isTemplate": false
}
```
Types : `breakfast`, `lunch`, `dinner`, `snack`.
`isTemplate: true` crée un modèle réutilisable, non comptabilisé dans la journée.

`GET` renvoie repas, totaux de macronutriments, hydratation et modèles enregistrés.

**Hydratation** — `{ "date": "2026-08-07", "amountMl": 250 }` (valeur négative pour retirer).

---

## Poids

| Méthode | Route |
| --- | --- |
| `GET` | `/api/weight` |
| `POST` | `/api/weight` |
| `DELETE` | `/api/weight/{id}` |

```json
{ "date": "2026-08-07", "weightKg": 84.6, "bodyFat": 18.2, "note": null }
```
Une seule mesure par jour : une nouvelle saisie remplace la précédente.

`GET` renvoie l'historique, l'IMC avec sa catégorie, le poids cible s'il existe, et une
**projection à 30 jours** obtenue par régression linéaire (`null` en dessous de trois
mesures).

---

## Sport

| Méthode | Route |
| --- | --- |
| `GET` | `/api/workouts?limit=60` |
| `POST` | `/api/workouts` |
| `PATCH` · `DELETE` | `/api/workouts/{id}` |

```json
{
  "date": "2026-08-07", "name": "Haut du corps", "type": "strength",
  "durationMin": 55, "intensity": "high",
  "exercises": [
    { "name": "Développé couché", "sets": 4, "reps": 8, "weightKg": 70, "restSec": 120 }
  ]
}
```
Types : `strength`, `cardio`, `walk`, `run`, `swim`, `yoga`, `other`.
XP proportionnelle à la durée, plafonnée à 60.

`GET` renvoie l'historique, les totaux cumulés, la répartition par type et les
30 derniers jours.

---

## Journal · Prières · Concentration

### `GET /api/journal?date=` · `PUT /api/journal`
Une entrée par jour, écriture idempotente.
```json
{
  "date": "2026-08-07", "mood": 4, "energy": 3,
  "title": "Bonne journée", "content": "...", "gratitude": "...",
  "tags": [], "media": []
}
```

### `GET /api/prayers?date=` · `POST /api/prayers` · `PATCH /api/prayers`

`GET` renvoie les six horaires, la source (`aladhan` ou `local`), la prière courante et
suivante, les minutes restantes, l'assiduité du mois et les réglages.

`POST` — `{ "date": "2026-08-07", "name": "Fajr", "status": "done" }`
Noms : `Fajr`, `Dhuhr`, `Asr`, `Maghrib`, `Isha` · Statuts : `done`, `late`, `missed`.

`PATCH` — `{ "method": 3, "school": 0, "notifyBefore": 10 }`
`school` : `0` = Shafi/Maliki/Hanbali, `1` = Hanafi.

### `POST /api/focus`
```json
{ "date": "2026-08-07", "minutes": 50, "label": "Travail profond" }
```
Un libellé contenant « lecture », « read », « livre » ou « book » alimente aussi le
compteur de lecture.

---

## Finances · Notes · Agenda

| Méthode | Route |
| --- | --- |
| `GET` | `/api/transactions?month=YYYY-MM` |
| `POST` | `/api/transactions` |
| `PATCH` · `DELETE` | `/api/transactions/{id}` |
| `GET` | `/api/notes?q=recherche` |
| `POST` | `/api/notes` |
| `PATCH` · `DELETE` | `/api/notes/{id}` |
| `GET` | `/api/events?from=ISO&to=ISO` |
| `POST` | `/api/events` |
| `PATCH` · `DELETE` | `/api/events/{id}` |

**Transaction** — `{ "date", "type": "expense", "category", "label", "amount", "recurring" }`
`GET` renvoie aussi le solde du mois et la répartition par catégorie.

**Agenda** — `GET` renvoie les événements **et** les tâches datées de la période :
l'interface les affiche sur la même grille.

---

## Analyse

### `GET /api/stats?period=7d|30d|3m|6m|1y|all`
Série temporelle, agrégats, heatmap sur 364 jours, répartition par catégorie, taux de
réussite par habitude, radar d'équilibre de vie, progression de niveau et badges.

### `GET /api/compare?period=7d|30d|3m|6m|1y|all`
Compare la période courante à la période **immédiatement précédente de même durée**.

Renvoie les deux séries, leurs agrégats, un tableau de 14 à 15 indicateurs avec delta
absolu et pourcentage, et deux profils radar superposables.

Chaque indicateur porte `lowerIsBetter` lorsque la baisse est la bonne direction.

---

## Agent IA

### `GET /api/ai/chat?conversationId=`
Liste des conversations et messages de la conversation demandée. Le champ `enabled`
indique si l'agent est configuré.

### `POST /api/ai/chat`
```json
{ "message": "Je veux perdre 10 kg", "conversationId": null }
```

Réponse :
```json
{
  "data": {
    "conversationId": "clx...",
    "message": { "id": "...", "role": "assistant", "content": "..." },
    "actions": [
      { "tool": "create_goal", "summary": "Objectif créé : « Perdre 10 kg » (4 étapes)", "ok": true },
      { "tool": "create_habit", "summary": "Habitude créée : « 10 000 pas »", "ok": true }
    ]
  }
}
```

Limite : 40 messages par heure et par utilisateur.

**Outils disponibles** — `create_habit`, `delete_habit`, `create_task`, `create_goal`,
`update_goal_progress`, `create_meal`, `create_workout`, `plan_day`, `get_statistics`.

Chaque outil valide ses entrées avec les mêmes schémas Zod que l'API REST et écrit
`userId` depuis la session. Le modèle ne peut désigner aucun autre compte, et tout
identifiant qu'il fournit est revérifié comme appartenant à l'utilisateur.

### `DELETE /api/ai/chat?conversationId=`
Supprime une conversation et ses messages.

---

## Santé

### `GET /api/health`
Publique, sans authentification.
```json
{ "status": "ok", "database": "up", "ai": "disabled", "latencyMs": 1, "timestamp": "..." }
```
Renvoie `503` si la base ne répond pas. Utilisée par le `HEALTHCHECK` Docker.
