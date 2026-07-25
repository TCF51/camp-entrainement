# -*- coding: utf-8 -*-
# Corrige backend/Dockerfile (--accept-data-loss requis pour db push non-interactif)
import pathlib

content = 'FROM node:20-alpine\n\n# Prisma a besoin d\'OpenSSL pour que son moteur fonctionne correctement sur Alpine Linux\nRUN apk add --no-cache openssl\n\nWORKDIR /app\n\nCOPY package*.json ./\nRUN npm install\n\nCOPY . .\nRUN mkdir -p /app/data\n\n# Railway (et la plupart des plateformes) ne fournissent les variables d\'environnement\n# qu\'au DEMARRAGE du conteneur, pas pendant sa construction. Or `prisma generate` a besoin\n# que DATABASE_URL soit resolvable au moment du build. On lui donne donc une valeur factice\n# ici ; la vraie valeur (definie dans Railway) prendra le relais au demarrage via `db push`.\nENV DATABASE_URL="file:./dev.db"\n\nRUN npx prisma generate\nRUN npm run build\n\nEXPOSE 4000\n\n# Synchronise le schema avec la base (simple pour un self-hosting MVP) puis demarre l\'API.\n# --accept-data-loss : necessaire car la commande tourne sans interaction possible au demarrage\n# du conteneur (elle bloquerait sinon en attendant une confirmation qui ne peut jamais venir).\n# Pour un vrai historique de migrations en production, remplace par :\n# npx prisma migrate deploy (apres avoir genere une migration avec `npm run prisma:migrate:dev` en local)\nCMD npx prisma db push --skip-generate --accept-data-loss && node dist/index.js\n'

p = pathlib.Path("backend/Dockerfile")
p.write_text(content, encoding="utf-8")
print("OK -> backend/Dockerfile")
