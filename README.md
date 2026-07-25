# Camp d'Entrainement

Application web de suivi de séances d'exercices, en groupe. Chacun crée un compte, rejoint ou crée un
« camp d'entraînement » (un ensemble d'exercices partagé, avec un code d'invitation), puis définit son
propre objectif personnel (séries, répétitions ou durée, fréquence) pour chaque exercice. L'app envoie
un rappel le jour où une séance est prévue, et affiche la progression et la régularité de chacun —
**pas un classement entre utilisateurs**, juste un suivi personnel.

## Stack technique

- **Backend** : Node.js + Express + TypeScript, base de données via Prisma (SQLite par défaut, migrable
  vers PostgreSQL), authentification par JWT, notifications push via `web-push` + une tâche planifiée
  (`node-cron`).
- **Frontend** : React + Vite + TypeScript + Tailwind CSS, graphiques avec Recharts.
- **Déploiement** : Docker Compose fourni (un conteneur backend, un conteneur frontend servi par nginx).

## Fonctionnalités incluses

- Création de compte / connexion (email + mot de passe)
- Profil basique : poids, taille, date de naissance, sexe (optionnel)
- Création d'un camp : sélection d'exercices dans un large catalogue (pompes, gainage, chaise contre
  le mur, squats, tractions, etc.) + possibilité d'ajouter ses propres exercices → génère un code
  d'invitation à 6 caractères
- Rejoindre un camp existant avec un code
- Pour chaque exercice d'un camp, chaque membre définit **son** programme personnel : nombre de séries,
  répétitions (ou secondes tenues), et fréquence (tous les jours / certains jours de la semaine / tous
  les X jours)
- Page « Aujourd'hui » : liste des exercices dus le jour même, à valider d'un tap
- Notifications push (navigateur) rappelant les séances du jour non encore faites
- Page de progression par exercice : nombre de jours d'affilée (« streak »), taux de régularité,
  carte de pointage visuelle (grille des 12 dernières semaines) et graphique d'évolution

## Arborescence du projet

```
pompiers-app/
├── backend/           API Node/Express + Prisma
│   ├── prisma/        schema.prisma (modèle de données) + script de seed du catalogue d'exercices
│   └── src/
│       ├── routes/        une route par ressource (auth, users, camps, exercises, programs, today, logs, progress, push)
│       ├── middleware/    vérification du JWT
│       ├── services/      planification des rappels (cron + web-push)
│       └── utils/         logique de récurrence (isDueOnDate) et génération de code de camp
├── frontend/          App React/Vite
│   └── src/
│       ├── pages/          une page par écran (Login, Register, Profile, Dashboard, CreateCamp, JoinCamp, CampDetail, Today, Progress)
│       ├── components/     Layout, ExercisePicker, ProgramForm, StampGrid (la « carte de pointage »)
│       └── context/        AuthContext (session utilisateur)
└── docker-compose.yml
```

## Installation en local (sans Docker)

Prérequis : Node.js 20+ et npm.

### 1. Backend

```bash
cd backend
cp .env.example .env
npm install

# Génère les clés VAPID pour les notifications push, et colle-les dans .env
# (VAPID_PUBLIC_KEY et VAPID_PRIVATE_KEY)
npm run vapid:generate

# Crée la base SQLite et les tables
npx prisma migrate dev --name init

# Remplit le catalogue d'exercices par défaut
npm run seed

# Démarre l'API en mode développement (http://localhost:4000)
npm run dev
```

### 2. Frontend

Dans un second terminal :

```bash
cd frontend
npm install

# Si ton API tourne ailleurs qu'en local, crée un fichier .env avec :
# VITE_API_URL=https://ton-api.example.com/api

npm run dev
```

L'application est alors disponible sur `http://localhost:5173`. Crée un compte, crée un camp,
choisis tes exercices (pompes, chaise contre le mur, gainage planche...), configure ta fréquence
(par ex. tous les jours, une seule série au maximum), et partage le code du camp avec ta femme pour
qu'elle rejoigne le même camp et configure son propre objectif.

> Note sur les notifications : les navigateurs exigent HTTPS pour les notifications push, **sauf**
> sur `localhost`. En développement ça fonctionne donc directement ; en production, il te faut un nom
> de domaine avec un certificat HTTPS (Let's Encrypt, Caddy, un reverse proxy géré par ton hébergeur, etc.).

## Déploiement avec Docker Compose (self-hosting)

```bash
cd pompiers-app
cp backend/.env.example backend/.env
# édite backend/.env : renseigne JWT_SECRET et les clés VAPID (npm run vapid:generate dans backend/ au préalable)

docker compose up -d --build
```

- Backend disponible sur `http://<ton-serveur>:4000`
- Frontend disponible sur `http://<ton-serveur>:8080`

Si tu déploies sur un vrai domaine, pense à :
1. Mettre un reverse proxy (nginx, Caddy, Traefik) devant les deux conteneurs pour servir en HTTPS.
2. Mettre à jour `FRONTEND_URL` dans `backend/.env` (pour le CORS) et `VITE_API_URL` (argument de build
   du service `frontend` dans `docker-compose.yml`) avec les vraies URLs publiques.

Pour une base de données plus robuste qu'une seule base SQLite (utile si tu veux scaler ou faire des
sauvegardes plus classiques), remplace le `provider` dans `backend/prisma/schema.prisma` par
`postgresql` et adapte `DATABASE_URL` — le reste du code ne change pas grâce à Prisma.

## Idées d'évolution possibles

- Historique/export CSV des séances
- Badges de régularité (ex : 30 jours d'affilée)
- Rappel configurable à une heure choisie par chaque utilisateur (actuellement une heure fixe pour
  tout le monde, réglable via `REMINDER_HOUR` dans `.env`)
- Photos ou notes libres accompagnant une séance
- Vue "camp" agrégée montrant la régularité de chaque membre côte à côte (toujours sans classement)
