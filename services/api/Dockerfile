FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat
RUN corepack enable
WORKDIR /app

FROM base AS pruner
COPY . .
RUN npx turbo prune @messages/api --docker

FROM base AS installer
COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile
COPY --from=pruner /app/out/full/ .
# Next.js inlines NEXT_PUBLIC_* vars at build time, so the real Clerk
# publishable key must be supplied via --build-arg for a production image.
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
RUN pnpm turbo run build --filter=@messages/api

FROM base AS runner
ENV NODE_ENV=production
COPY --from=installer /app .
WORKDIR /app/services/api
EXPOSE 3000
CMD ["node", "dist/server.js"]
