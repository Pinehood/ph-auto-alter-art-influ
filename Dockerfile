FROM node:lts-bullseye-slim

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@10.9.0 --activate

WORKDIR /app
COPY . /app

RUN pnpm install --frozen-lockfile
RUN pnpm run build

ENTRYPOINT ["node", "dist/main"]
