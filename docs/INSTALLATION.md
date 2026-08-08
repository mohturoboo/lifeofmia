# Installation et déploiement

## Prérequis

| Outil | Version | Note |
| --- | --- | --- |
| Node.js | ≥ 20 (testé sur 24) | obligatoire |
| npm | ≥ 10 | fourni avec Node |
| PostgreSQL | ≥ 14 | **production uniquement** |
| Docker | récent | facultatif |

En développement, aucune base de données n'est à installer : SQLite est utilisé et le
fichier est créé automatiquement.

---

## 1. Installation locale

```bash
npm install
cp .env.example .env
```

Ouvrez `.env`. Les seules valeurs indispensables au démarrage sont déjà remplies :

```env
DATABASE_URL="file:./dev.db"
AUTH_SECRET="dev-secret-change-me-in-production-please-32-chars-min"
```

Créez le schéma et les données de démonstration :

```bash
npm run db:push
npm run db:seed
npm run dev
```

L'application est disponible sur <http://localhost:3000>.

**Compte de démonstration :** `demo@lifeofm.app` / `Demo1234`
(90 jours d'historique généré, graphiques et comparaisons immédiatement remplis)

Pour partir d'une base vide, sautez `npm run db:seed` et créez votre compte via
`/register`.

---

## 2. Variables d'environnement

### Obligatoires

| Variable | Rôle |
| --- | --- |
| `DATABASE_URL` | Chaîne de connexion Prisma |
| `AUTH_SECRET` | Clé de signature des jetons de session. **Obligatoire en production**, l'application refuse de démarrer sans. |

Générer un secret solide :

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

### Facultatives — l'application fonctionne sans

| Variable | Sans elle |
| --- | --- |
| `ANTHROPIC_API_KEY` | L'agent IA affiche un écran expliquant comment l'activer. Tout le reste fonctionne. |
| `AI_MODEL` | Vaut `claude-sonnet-5`. |
| `OPENWEATHER_API_KEY` | La météo bascule sur Open-Meteo, gratuit et sans clé. |
| `SMTP_*` | Les emails de vérification et de réinitialisation sont **écrits dans la console du serveur** : les liens restent utilisables. |
| `NEXT_PUBLIC_APP_URL` | Vaut `http://localhost:3000`. À définir en production pour que les liens des emails soient corrects. |

Les horaires de prière n'exigent aucune clé : l'API AlAdhan est publique, et un calcul
astronomique local prend le relais si le réseau est indisponible.

---

## 3. Passage à PostgreSQL

Prisma n'accepte pas de variable d'environnement pour le `provider` ; un script se
charge de la bascule.

```bash
npm run db:use postgresql
```

Puis dans `.env` :

```env
DATABASE_URL="postgresql://lifeofm:motdepasse@localhost:5432/lifeofm?schema=public"
```

Appliquez le schéma :

```bash
npm run db:push          # développement / prototypage
# ou, pour un historique de migrations versionnées :
npx prisma migrate dev --name init
```

Le schéma est volontairement écrit dans un sous-ensemble compatible avec les deux
moteurs : aucun `enum`, aucun type `Json`, aucun tableau natif. La bascule ne demande
donc aucune autre modification.

Pour revenir à SQLite : `npm run db:use sqlite`.

---

## 4. Docker

`docker-compose.yml` démarre l'application **et** PostgreSQL.

```bash
# 1. Basculer le schéma sur PostgreSQL
npm run db:use postgresql

# 2. Créer un .env avec au minimum le secret
cat > .env <<EOF
AUTH_SECRET=$(node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))")
NEXT_PUBLIC_APP_URL=http://localhost:3000
EOF

# 3. Démarrer
docker compose up -d
```

Commandes utiles :

```bash
docker compose logs -f app     # suivre les journaux
docker compose ps              # état des services
docker compose down            # arrêter
docker compose down -v         # arrêter et supprimer les données
```

L'application applique le schéma au démarrage (`prisma db push`) puis lance le serveur.
Le conteneur tourne sous un utilisateur non privilégié et expose une sonde de santé sur
`/api/health`.

Pour insérer les données de démonstration dans le conteneur :

```bash
docker compose exec app npx tsx prisma/seed.ts
```

---

## 5. Déploiement

### Vercel (recommandé)

1. Poussez le dépôt sur GitHub.
2. Importez-le sur Vercel.
3. Base de données managée : **Neon**, **Supabase** ou **Vercel Postgres**.
4. Variables d'environnement à définir dans le projet Vercel :

```
DATABASE_URL        postgresql://...
AUTH_SECRET         <48 octets aléatoires>
NEXT_PUBLIC_APP_URL https://votre-domaine.vercel.app
ANTHROPIC_API_KEY   sk-ant-...        (facultatif)
OPENWEATHER_API_KEY ...               (facultatif)
```

5. Avant le premier déploiement, exécutez `npm run db:use postgresql` et committez le
   `schema.prisma` modifié.

Le script `build` exécute `prisma generate` avant `next build` : aucune configuration
supplémentaire n'est nécessaire.

### Railway / Render

Ces plateformes construisent directement le `Dockerfile`.

- **Commande de démarrage** : laissée au `CMD` de l'image
- **Port** : `3000`
- **Sonde de santé** : `/api/health`
- Ajoutez un service PostgreSQL et reliez sa `DATABASE_URL`

### Checklist avant mise en production

- [ ] `AUTH_SECRET` généré aléatoirement, différent de la valeur d'exemple
- [ ] `NEXT_PUBLIC_APP_URL` pointe sur le domaine réel (liens des emails)
- [ ] `DATABASE_URL` pointe sur PostgreSQL et `npm run db:use postgresql` a été exécuté
- [ ] SMTP configuré si la vérification d'email doit réellement partir
- [ ] `npm run build` et `npm run test` passent
- [ ] Sauvegardes automatiques activées sur la base de données

---

## 6. Vérification

```bash
npm run typecheck   # aucune erreur TypeScript
npm run test        # 80 tests
npm run build       # build de production
```

Une fois le serveur démarré :

```bash
curl http://localhost:3000/api/health
# {"status":"ok","database":"up","ai":"disabled","latencyMs":1,...}
```

---

## 7. Résolution de problèmes

**`PrismaClientInitializationError` au démarrage**
Le client n'a pas été généré : `npm run db:generate`.

**`Error validating datasource: the URL must start with postgresql://`**
Le provider et l'URL ne correspondent pas. Exécutez `npm run db:use sqlite` ou
`npm run db:use postgresql` selon votre `DATABASE_URL`.

**Les emails ne partent pas**
C'est le comportement attendu sans SMTP configuré : le message complet, lien inclus,
est affiché dans la console du serveur.

**L'agent IA affiche « non activé »**
`ANTHROPIC_API_KEY` est vide dans `.env`. Ajoutez-la puis redémarrez le serveur.

**Erreur `FORBIDDEN — Origine de la requête non autorisée`**
La protection CSRF a rejeté la requête. En développement, accédez à l'application par la
même origine que `NEXT_PUBLIC_APP_URL` (`localhost` et `127.0.0.1` sont deux origines
distinctes).

**La météo affiche « indisponible »**
Les deux fournisseurs sont injoignables. L'application reste pleinement utilisable ; le
bloc météo disparaît simplement du tableau de bord.
