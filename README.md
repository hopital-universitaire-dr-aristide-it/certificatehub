# CertificateHub — Hôpital Universitaire Dr. Aristide

Mini-application indépendante et dockerisée pour la délivrance de certificats/documents médicaux (à commencer par le Certificat de Santé), hébergée sur un poste du service informatique et accessible aux autres postes de l'hôpital via le réseau local (IP:port).

Stack : Laravel 12 (API) + React/Vite (SPA) + PostgreSQL 16 + Redis + Typesense, orchestrés via Docker Compose.

## Démarrage (développement)

Prérequis : Docker Desktop (ou Docker Engine + Compose v2).

```bash
cp .env.example .env
# éditer .env : APP_ENV=development (important — voir la note dans le fichier),
# DB_PASSWORD, REDIS_PASSWORD, TYPESENSE_API_KEY (valeurs fortes aléatoires)

cp .env api/.env
# éditer api/.env : mêmes valeurs + APP_URL=http://localhost, DB_HOST=postgres, REDIS_HOST=redis,
# TYPESENSE_HOST=typesense — et laisser APP_ENV=local ici (valeur Laravel, differente du
# stage Docker choisi dans le .env racine)

docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build

docker compose exec app php artisan key:generate
docker compose exec app php artisan migrate --seed
docker compose exec app php artisan scout:import "Modules\Patient\Models\Patient"
```

- API : http://localhost/api
- Frontend (Vite dev, hot reload) : http://localhost:5173
- pgAdmin (optionnel) : `docker compose --profile tools up -d pgadmin` → http://localhost:5050
- Mailpit : http://localhost:8026 (décalé — 8025 déjà pris par un autre projet sur ce poste)

## Démarrage (production — poste du service informatique)

**Voir `DEPLOYMENT.md`** pour la procédure complète et détaillée (checklist,
valeurs à demander à l'opérateur, tests de bout en bout, dépannage).
Résumé :

```bash
cp .env.example .env
# éditer avec les vraies valeurs de production (mots de passe forts, APP_URL=https://<ip-du-poste>)

cp .env api/.env

# Générer un certificat auto-signé si aucun n'existe encore — le SAN est
# obligatoire, les navigateurs récents ignorent le CN seul :
mkdir -p docker/nginx/ssl
openssl req -x509 -nodes -days 825 -newkey rsa:2048 \
  -keyout docker/nginx/ssl/privkey.pem \
  -out docker/nginx/ssl/fullchain.pem \
  -subj "/CN=<ip-du-poste>" \
  -addext "subjectAltName=IP:<ip-du-poste>"

# Build du frontend (assets statiques servis par nginx)
docker build --target export -o web/dist ./web

docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

docker compose exec app php artisan key:generate
docker compose exec app php artisan migrate --seed
docker compose exec app php artisan config:cache
```

Accès depuis les autres postes de l'hôpital : `https://<ip-du-poste>` (accepter l'avertissement de certificat auto-signé une fois par navigateur).

## CI/CD

Deux workflows GitHub Actions (`.github/workflows/`), même convention que le dépôt `hms` de l'hôpital (org GitHub `hopital-universitaire-dr-aristide-it`) :

- **`ci.yml`** — sur chaque push/PR (`main`, `develop`) : lint + tests backend (Pint, PHPUnit contre Postgres/Redis de service), lint + build frontend (oxlint, tsc, vite build), puis un build des deux images Docker (API prod target + assets React) pour détecter tout `Dockerfile` cassé. Tourne sur les runners GitHub-hosted classiques.
- **`deploy.yml`** — sur push `main` (ou déclenchement manuel) : build et redémarre la stack `docker-compose.prod.yml`, lance les migrations, rafraîchit les caches Laravel, vérifie `/up`. **Tourne obligatoirement sur un self-hosted runner installé sur le poste du service informatique** — l'app n'étant joignable que sur le LAN de l'hôpital, un runner cloud classique ne pourrait de toute façon pas piloter `docker compose` sur cette machine.

### Mise en place du runner self-hosted (une seule fois, sur le poste cible)

1. Dans GitHub → repo → **Settings → Actions → Runners → New self-hosted runner**, suivre les instructions d'installation pour le poste (Linux/Windows selon l'OS du service informatique).
2. Lui donner le label `certhub` (utilisé par `deploy.yml` : `runs-on: [self-hosted, certhub]`).
3. L'installer comme **service** (`./svc.sh install && ./svc.sh start` sur Linux, ou "Run as service" sur Windows) pour qu'il redémarre avec la machine.
4. Cloner ce dépôt sur le poste, à l'endroit exact où tourne déjà (ou tournera) `docker compose` — c'est ce checkout que `deploy.yml` met à jour à chaque déploiement.
5. Créer **une seule fois, à la main** sur ce poste (jamais dans le dépôt git, voir `.gitignore`) :
   - `.env` et `api/.env` (à partir de `.env.example`, valeurs de production réelles)
   - `docker/nginx/ssl/fullchain.pem` + `privkey.pem` (certificat auto-signé, voir section précédente)
6. (Recommandé) Configurer un **Environment** `production` dans Settings → Environments avec une règle d'approbation manuelle avant déploiement — un document médico-légal mérite une confirmation humaine avant chaque mise à jour en prod.

Le pipeline ne touche jamais `.env` ni les certificats : `deploy.yml` échoue explicitement s'ils sont absents plutôt que de déployer une config incomplète.

## Structure

```
certificatehub/
├── api/            # Laravel 12 API (modules nwidart/laravel-modules)
├── web/            # React (Vite) SPA
├── docker/         # Dockerfile PHP, config nginx, init.sql PostgreSQL
├── docker-compose.yml
├── docker-compose.dev.yml
├── docker-compose.prod.yml
└── .env.example
```

Voir le plan complet : `C:\Users\Ben\.claude\plans\warm-wandering-popcorn.md`.
