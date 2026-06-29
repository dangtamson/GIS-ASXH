FROM node:22-alpine AS base

ENV PNPM_VERSION=9.1.0

RUN npm install -g pnpm@$PNPM_VERSION

WORKDIR /app

ARG NODE_ENV
ENV NODE_ENV=${NODE_ENV}

# install deps first so we can cache them
COPY package*.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS builder

WORKDIR /app

COPY . .

RUN mkdir dist

RUN pnpm build

FROM base AS runner

WORKDIR /app

RUN addgroup -S express -g 1001 && \
    adduser -S express -u 1001 -G express

COPY --from=builder --chown=1001:1001 /app/node_modules /app/node_modules
COPY --from=builder --chown=1001:1001 /app/dist /app/dist
COPY --from=builder --chown=1001:1001 /app/package.json /app/package.json

USER 1001:1001

EXPOSE 4000

FROM runner AS dev

WORKDIR /app

COPY --from=builder --chown=1001:1001 /app/.env.example /app/.env

CMD ["node", "./dist/server.mjs"]

FROM runner AS prod

WORKDIR /app

CMD ["node", "./dist/server.mjs"]
