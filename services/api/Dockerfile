FROM node:20-alpine AS base
RUN corepack enable
WORKDIR /app

FROM base AS pruner
COPY . .
RUN npx turbo prune @messages/api --docker

FROM base AS installer
COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile
COPY --from=pruner /app/out/full/ .
RUN pnpm turbo run build --filter=@messages/api

FROM base AS runner
ENV NODE_ENV=production
COPY --from=installer /app .
WORKDIR /app/services/api
EXPOSE 4000
CMD ["node", "dist/server.js"]
