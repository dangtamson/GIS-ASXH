#!/usr/bin/env bash
set -euo pipefail

BRANCH="${1:-main}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "[deploy] repo: ${ROOT_DIR}"
echo "[deploy] branch: ${BRANCH}"

cd "${ROOT_DIR}"

git fetch origin "${BRANCH}"
git checkout "${BRANCH}"
git pull --ff-only origin "${BRANCH}"

if command -v corepack >/dev/null 2>&1; then
  corepack enable >/dev/null 2>&1 || true
fi

echo "[deploy] install backend dependencies"
cd "${ROOT_DIR}/BE"
pnpm install --frozen-lockfile

echo "[deploy] build backend"
pnpm build

echo "[deploy] install frontend dependencies"
cd "${ROOT_DIR}/FE"
pnpm install --frozen-lockfile

echo "[deploy] build frontend"
pnpm build

echo "[deploy] reload pm2 apps"
cd "${ROOT_DIR}"
pm2 startOrReload ecosystem.config.js --update-env
pm2 save

echo "[deploy] done"
