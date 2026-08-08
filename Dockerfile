# =============================================================================
#  LifeofM — image de production
# -----------------------------------------------------------------------------
#  Construction en trois etapes pour une image finale minimale :
#    deps    : dependances uniquement (couche mise en cache tant que le
#              package-lock ne change pas)
#    builder : generation du client Prisma et compilation Next.js
#    runner   : image finale, sans outillage de build, executee en non-root
# =============================================================================

# --- Etape 1 : dependances ---------------------------------------------------
FROM node:22-alpine AS deps
WORKDIR /app

# openssl est requis par le moteur de requetes Prisma sur Alpine.
RUN apk add --no-cache libc6-compat openssl

COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts

# --- Etape 2 : construction --------------------------------------------------
FROM node:22-alpine AS builder
WORKDIR /app

RUN apk add --no-cache libc6-compat openssl

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Next.js lit certaines variables au build ; une valeur factice suffit ici,
# les vraies sont injectees au demarrage du conteneur.
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN npx prisma generate
RUN npm run build

# --- Etape 3 : execution -----------------------------------------------------
FROM node:22-alpine AS runner
WORKDIR /app

RUN apk add --no-cache openssl

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Utilisateur dedie : le conteneur ne tourne jamais en root.
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts ./scripts

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Applique le schema puis demarre le serveur.
CMD ["sh", "-c", "npx prisma db push --skip-generate && npm run start"]
