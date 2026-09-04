# Imagem da API do Pecê.
#
# Constrói a partir da raiz do monorepo porque a API depende de `@pece/core` via
# npm workspaces — o domínio e o servidor precisam ser instalados juntos.

FROM node:24-slim AS base
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# Dependências primeiro: só invalida o cache quando os manifests mudam.
COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/
COPY apps/api/package.json apps/api/
COPY apps/mobile/package.json apps/mobile/

# O app mobile não faz parte da imagem do servidor.
RUN npm ci --omit-dev --workspace @pece/api --workspace @pece/core --ignore-scripts

COPY packages/core packages/core
COPY apps/api apps/api

# O client do Prisma precisa ser gerado para a plataforma do container.
RUN npx prisma generate --schema apps/api/prisma/schema.prisma

ENV NODE_ENV=production
EXPOSE 3333

# O servidor e nada mais.
#
# Migrar o schema e popular o catálogo são passos deliberados, executados sob demanda
# (npm run db:push / db:seed no workspace da API) — nunca a cada início de container.
# Railway reinicia containers por conta própria; rodar "db push --accept-data-loss" em
# todo boot colocaria dados de produção em risco a cada reinício.
CMD ["node", "--experimental-transform-types", "apps/api/src/server.ts"]
