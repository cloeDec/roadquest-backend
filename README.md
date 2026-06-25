# RoadQuest Backend

API RESTful pour l'application mobile RoadQuest - tracking GPS et gamification pour motards.

## Stack Technique

| Technologie | Version | Usage |
|-------------|---------|-------|
| Node.js | 20+ | Runtime |
| TypeScript | 5.3 | Langage |
| Express | 4.18 | Framework web |
| PostgreSQL | 16 | Base de données |
| PostGIS | 3.4 | Extension géospatiale |
| JWT | 9.0 | Authentification |
| Jest | 30.4 | Tests |
| Swagger | 3.0 | Documentation API |

## Architecture

```
src/
├── __tests__/          # Tests unitaires et d'intégration
├── config/
│   ├── database.ts     # Pool PostgreSQL
│   └── swagger.ts      # Configuration OpenAPI
├── controllers/        # Gestion des requêtes HTTP
├── middlewares/
│   └── auth.ts         # Authentification JWT
├── repositories/       # Accès base de données
├── routes/             # Définition des endpoints
├── services/           # Logique métier
├── utils/
│   ├── jwt.ts          # Génération/vérification tokens
│   └── tokenBlacklist.ts
├── app.ts              # Configuration Express
└── server.ts           # Point d'entrée

database/
└── roadquest_database.sql  # Schéma complet avec triggers

docker-compose.yml          # PostgreSQL + Redis
```

## Installation

### Prérequis

- Node.js 20+
- Docker & Docker Compose
- PostgreSQL 16 avec PostGIS (ou Docker)

### Étapes

```bash
# 1. Installer les dépendances
npm install

# 2. Démarrer les services Docker
docker-compose up -d

# 3. Configurer les variables d'environnement
cp .env.example .env

# 4. Initialiser la base de données
psql -U user -d roadquest_db -f database/roadquest_database.sql
```

## Variables d'environnement

```env
# Serveur
NODE_ENV=development
PORT=3000
API_URL=http://localhost:3000

# Base de données PostgreSQL + PostGIS
DATABASE_URL=postgresql://user:password@localhost:5432/roadquest_db

# Authentification JWT
JWT_SECRET=votre-clé-secrète-à-changer
JWT_EXPIRES_IN=7d

# Redis (optionnel)
REDIS_URL=redis://localhost:6379
```

## Scripts

```bash
npm run dev          # Développement avec hot-reload
npm run build        # Compilation TypeScript
npm start            # Production
npm test             # Tests
npm run test:watch   # Tests en watch mode
npm run test:coverage # Rapport de couverture
```

## API Endpoints

### Authentification `/api/auth`

| Méthode | Route | Description | Auth |
|---------|-------|-------------|------|
| POST | /register | Inscription | Non |
| POST | /login | Connexion | Non |
| POST | /logout | Déconnexion | Oui |

### Utilisateur `/api/user`

| Méthode | Route | Description | Auth |
|---------|-------|-------------|------|
| GET | /profile | Profil utilisateur | Oui |
| PUT | /motorcycle | Modifier la moto | Oui |
| GET | /statistics | Statistiques | Oui |

### Trajets `/api/rides`

| Méthode | Route | Description | Auth |
|---------|-------|-------------|------|
| POST | / | Créer un trajet | Oui |
| GET | / | Liste des trajets | Oui |
| GET | /:rideId | Détail d'un trajet | Oui |
| DELETE | /:rideId | Supprimer un trajet | Oui |

### Points d'intérêt `/api/pois`

| Méthode | Route | Description | Auth |
|---------|-------|-------------|------|
| GET | / | Tous les POIs | Non |
| GET | /nearby | POIs à proximité | Non |
| GET | /visited | POIs visités | Oui |
| POST | / | Créer un POI | Oui |
| POST | /:poiId/visit | Marquer comme visité | Oui |

### Achievements `/api/achievements`

| Méthode | Route | Description | Auth |
|---------|-------|-------------|------|
| GET | / | Tous les achievements | Non |
| GET | /user | Progression utilisateur | Oui |
| GET | /stats | Statistiques | Oui |

### Documentation Swagger

Accédez à la documentation interactive : `http://localhost:3000/api-docs`

## Base de données

### Tables principales

- **users** - Comptes utilisateurs, XP, niveau, statistiques
- **rides** - Trajets GPS avec PostGIS (POINT, LINESTRING)
- **pois** - Points d'intérêt géolocalisés
- **achievements** - Catalogue des trophées
- **user_achievements** - Trophées débloqués par utilisateur
- **ride_poi** - Relation trajets/POIs visités

### Fonctionnalités PostGIS

- Calcul automatique des distances (`ST_Length`, `ST_Distance`)
- Index spatiaux pour requêtes de proximité
- Stockage des routes GPS en LINESTRING

### Système de gamification

- **XP** : 1 XP par km parcouru + bonus POIs
- **Niveau** : `floor(xp / 1000) + 1`
- **Triggers** : Mise à jour automatique XP/niveau

## Sécurité

- Mots de passe hashés avec bcrypt
- Authentification JWT avec blacklist
- Rate limiting : 10 tentatives/compte, 20/IP
- Lockout de 15 minutes après dépassement

## Docker

```yaml
# PostgreSQL avec PostGIS
postgis/postgis:16-3.4
Port: 5432

# Redis
redis:7-alpine
Port: 6379
```

```bash
# Démarrer
docker-compose up -d

# Arrêter
docker-compose down

# Logs
docker-compose logs -f
```

## Tests

```bash
# Exécuter tous les tests
npm test

# Avec couverture
npm run test:coverage

# Mode watch
npm run test:watch
```

## Licence

MIT
