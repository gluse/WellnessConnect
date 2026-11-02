# syntax=docker/dockerfile:1
ARG NODE_IMAGE=node:22-bookworm-slim

FROM ${NODE_IMAGE} AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM dependencies AS development
COPY . .
ENV NODE_ENV=development PORT=5000
USER node
EXPOSE 5000
CMD ["npm", "run", "dev"]

FROM dependencies AS build
COPY . .
RUN npm run build && ./node_modules/.bin/esbuild server/audit/run-worker.ts --platform=node --packages=external --bundle --format=esm --outfile=dist/audit-worker.js

FROM ${NODE_IMAGE} AS production-dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force

FROM ${NODE_IMAGE} AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT=5000
COPY --from=production-dependencies --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node deploy/aws/staging-proxy.mjs ./staging-proxy.mjs
COPY --chown=node:node deploy/aws-staging/supabase-ca.crt ./certs/supabase-ca.crt
COPY --chown=node:node package.json ./
USER node
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/health/ready',{signal:AbortSignal.timeout(4000)}).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/index.js"]
