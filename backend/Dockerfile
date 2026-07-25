FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN mkdir -p /app/data

RUN npx prisma generate
RUN npm run build

EXPOSE 4000

# Synchronise le schema avec la base (simple pour un self-hosting MVP) puis demarre l'API.
# Pour un vrai historique de migrations en production, remplace par :
# npx prisma migrate deploy (apres avoir genere une migration avec `npm run prisma:migrate:dev` en local)
CMD npx prisma db push --skip-generate && node dist/index.js
