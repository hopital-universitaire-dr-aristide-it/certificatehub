# Identifiants de développement (local uniquement)

**Ne jamais utiliser ces valeurs en production.** Ce fichier documente les
identifiants déjà présents dans l'environnement Docker local (`.env`,
seeders, comptes créés manuellement pendant les tests) pour que toute
l'équipe puisse se connecter sans les redemander à chaque fois.

## Comptes applicatifs (CertificateHub)

| Rôle | E-mail | Mot de passe | Origine |
|---|---|---|---|
| superadmin | `superadmin@certhub.local` | `changeme` | `AdminUserSeeder` (défaut, surchargeable via `SUPERADMIN_EMAIL`/`SUPERADMIN_PASSWORD` dans `.env`) |
| doctor | `jbaptiste@certhub.local` | `changeme` | Compte de test créé manuellement (pas dans un seeder) |
| reception | `reception@certhub.local` | `changeme` | Compte de test créé manuellement (pas dans un seeder) |

Aucun compte `it` ni `admin` (non-superadmin) n'existe encore — à créer via
l'écran Utilisateurs (superadmin) si besoin de tester ces rôles séparément.

## Infrastructure (valeurs de `.env`)

| Service | Détail | Valeur |
|---|---|---|
| PostgreSQL | host / port interne | `postgres` / `5432` |
| PostgreSQL | port exposé sur l'hôte | `5434` |
| PostgreSQL | base / utilisateur / mot de passe | `certhub_db` / `certhub_user` / `certhub_dev_password` |
| Redis | mot de passe | `certhub_dev_redis_password` |
| Typesense | clé API | `certhub_dev_typesense_key` |
| pgAdmin | URL | http://localhost:5050 |
| pgAdmin | e-mail / mot de passe | `admin@certhub.local` / `admin` |
| Mailpit | UI | http://localhost:8026 (SMTP interne sur 1026, pas d'auth) |

## À renseigner avant déploiement (tâche #9)

| Variable | Usage |
|---|---|
| `BACKBLAZE_KEY_ID` | Sauvegardes nocturnes (`pg_dump` → B2) |
| `BACKBLAZE_APP_KEY` | idem |
| `BACKBLAZE_BUCKET` | actuellement `certhub-aristide-backups` (à confirmer) |

## Accès

- Frontend (dev, hot reload) : http://localhost:5173
- API + build statique (nginx) : http://localhost (port 80) / https://localhost (port 443, cert auto-signé)
