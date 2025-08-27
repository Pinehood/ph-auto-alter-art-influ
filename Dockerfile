FROM node:lts-bullseye-slim

WORKDIR /app
COPY . /app

RUN npm ci
RUN npm run build

ENTRYPOINT ["node", "dist/main"]
