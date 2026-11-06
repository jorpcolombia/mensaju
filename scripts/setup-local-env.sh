#!/usr/bin/env bash
# Bootstraps local env files and infra for running this monorepo locally.
# Usage: bash scripts/setup-local-env.sh
set -euo pipefail

cd "$(dirname "$0")/.."

copy_if_missing() {
  local src="$1" dest="$2"
  if [ -f "$dest" ]; then
    echo "skip: $dest already exists"
  else
    cp "$src" "$dest"
    echo "created: $dest"
  fi
}

copy_if_missing services/api/.env.example services/api/.env
copy_if_missing apps/web/.env.example apps/web/.env.local

echo
echo "Starting MongoDB and Redis via docker compose..."
docker compose up -d mongo redis

cat <<'EOF'

Env files created (if they didn't already exist) and Mongo/Redis are running:
  mongodb://localhost:27017/messages
  redis://localhost:6379

Still need to fill in manually before auth/messaging works end-to-end:
  - services/api/.env: CLERK_SECRET_KEY, CLERK_WEBHOOK_SIGNING_SECRET (one Clerk app; admins in src/config/admins.ts)
  - services/api/.env: ABLY_API_KEY
  - services/api/.env: S3_BUCKET / AWS credentials
  - services/api/.env: CUSTOM_SMS_API_* / WHATSAPP_CLOUD_API_* (only needed for real sends)
  - services/api/.env: CUSTOMER_JWT_SECRET (any random string works locally)

Then:
  pnpm install
  pnpm dev
EOF
