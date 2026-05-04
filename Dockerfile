FROM node:24-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY tsconfig.json tsconfig.base.json ./
COPY artifacts/api-server/package.json artifacts/api-server/package.json
COPY artifacts/askhealth/package.json artifacts/askhealth/package.json
COPY artifacts/mockup-sandbox/package.json artifacts/mockup-sandbox/package.json
COPY lib/api-client-react/package.json lib/api-client-react/package.json
COPY lib/api-spec/package.json lib/api-spec/package.json
COPY lib/api-zod/package.json lib/api-zod/package.json
COPY lib/db/package.json lib/db/package.json
COPY lib/integrations-openai-ai-react/package.json lib/integrations-openai-ai-react/package.json
COPY lib/integrations-openai-ai-server/package.json lib/integrations-openai-ai-server/package.json
COPY lib/replit-auth-web/package.json lib/replit-auth-web/package.json
COPY scripts/package.json scripts/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
ENV CI=true
ENV NODE_ENV=production
ENV PORT=8080
ENV BASE_PATH=/
RUN pnpm --filter @workspace/askhealth run build
RUN pnpm --filter @workspace/api-server run build
RUN pnpm prune --prod

FROM node:24-slim AS runner
ENV NODE_ENV=production
ENV PORT=8080
ENV STATIC_DIR=/app/artifacts/askhealth/dist/public
WORKDIR /app
COPY --from=build /app/package.json /app/pnpm-workspace.yaml ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/artifacts/api-server/package.json ./artifacts/api-server/package.json
COPY --from=build /app/artifacts/api-server/node_modules ./artifacts/api-server/node_modules
COPY --from=build /app/artifacts/api-server/dist ./artifacts/api-server/dist
COPY --from=build /app/artifacts/askhealth/dist/public ./artifacts/askhealth/dist/public
EXPOSE 8080
CMD ["node", "--enable-source-maps", "artifacts/api-server/dist/index.mjs"]
