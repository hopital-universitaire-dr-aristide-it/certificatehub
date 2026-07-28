# Guide de déploiement — CertificateHub sur le poste du service informatique

Ce fichier s'adresse à l'agent (Claude Code ou humain) qui exécute le
déploiement **directement sur la machine cible** — le poste du service
informatique de l'Hôpital Universitaire Dr. Aristide qui hébergera
l'application pour tout le réseau local (LAN) de l'hôpital.

Suivre les étapes dans l'ordre. Chaque étape indique explicitement si elle
nécessite une information que **seul l'opérateur humain sur place peut
fournir** (marqué `⛔ DEMANDER A L'OPERATEUR`) — ne jamais inventer ou
deviner ces valeurs.

---

## 0. Prérequis — à confirmer avant de commencer

- [ ] Docker Engine + Docker Compose v2 installés sur la machine cible
      (`docker --version` et `docker compose version`).
- [ ] Accès réseau sortant vers GitHub (pour cloner le dépôt privé
      `hopital-universitaire-dr-aristide-it/certificatehub`).
- [ ] ⛔ **DEMANDER A L'OPERATEUR** : un compte GitHub avec accès à
      l'organisation `hopital-universitaire-dr-aristide-it`, ou un jeton
      d'accès (PAT) pour cloner le dépôt privé.
- [ ] ⛔ **DEMANDER A L'OPERATEUR** : les identifiants Backblaze B2
      (`BACKBLAZE_KEY_ID`, `BACKBLAZE_APP_KEY`) pour les sauvegardes
      automatiques. Si non disponibles immédiatement, le déploiement peut
      démarrer sans (le service `backup` réessaiera à chaque cycle et
      loggera l'échec), mais **il faut relancer le service `backup` dès que
      les identifiants sont fournis** (voir étape 9).
- [ ] Cette machine reste allumée en permanence (ou redémarre Docker au
      démarrage) — c'est le seul serveur de l'application.

## 1. Déterminer l'adresse IP de la machine sur le LAN de l'hôpital

```bash
# Linux
ip addr show | grep "inet " | grep -v 127.0.0.1

# Windows (PowerShell)
ipconfig | findstr IPv4
```

Noter cette IP — elle est utilisée dans toutes les étapes suivantes.
Idéalement, demander au service réseau une **IP statique/réservée par DHCP**
pour cette machine (sinon l'app deviendra injoignable si l'IP change).

⛔ **DEMANDER A L'OPERATEUR** de confirmer que c'est bien l'IP à utiliser
(certaines machines ont plusieurs interfaces réseau) et qu'elle est stable.

Dans tout ce document, `<IP_SERVEUR>` désigne cette adresse (ex: `192.168.1.50`).

## 2. Cloner le dépôt

```bash
git clone https://github.com/hopital-universitaire-dr-aristide-it/certificatehub.git
cd certificatehub
```

## 3. Configurer les secrets de production

```bash
cp .env.example .env
```

Éditer `.env` et renseigner :

| Variable | Valeur |
|---|---|
| `APP_URL` | `https://<IP_SERVEUR>` |
| `FRONTEND_URL` | `https://<IP_SERVEUR>` |
| `SANCTUM_STATEFUL_DOMAINS` | `<IP_SERVEUR>` |
| `DB_PASSWORD` | valeur forte aléatoire — générer avec `openssl rand -base64 32` |
| `REDIS_PASSWORD` | idem |
| `TYPESENSE_API_KEY` | idem |
| `BACKBLAZE_KEY_ID` / `BACKBLAZE_APP_KEY` | ⛔ fournis par l'opérateur (étape 0) |
| `BACKBLAZE_BUCKET` | garder `certhub-aristide-backups` sauf indication contraire |

**Ne jamais réutiliser** les valeurs de développement (`certhub_dev_password`,
`certhub_dev_redis_password`, `certhub_dev_typesense_key`, comptes
`@certhub.local` documentés dans `SEED_CREDENTIALS.md`) — ce fichier décrit
l'environnement de dev local, pas la prod.

Copier ensuite les mêmes valeurs vers `api/.env` :

```bash
cp .env api/.env
```

## 4. Générer le certificat TLS auto-signé

Le certificat déjà présent dans `docker/nginx/ssl/` (s'il existe) a été
généré pour le développement local (`CN=certificatehub.local`) — **il ne
fonctionnera pas** pour l'IP réelle du serveur. En régénérer un neuf :

```bash
mkdir -p docker/nginx/ssl
openssl req -x509 -nodes -days 825 -newkey rsa:2048 \
  -keyout docker/nginx/ssl/privkey.pem \
  -out docker/nginx/ssl/fullchain.pem \
  -subj "/CN=<IP_SERVEUR>" \
  -addext "subjectAltName=IP:<IP_SERVEUR>"
```

Le `subjectAltName` est **obligatoire** — les navigateurs modernes (Chrome,
Firefox) ignorent le `CN` seul et refusent purement et simplement une
connexion HTTPS sans SAN correspondant, même pour accepter une exception de
sécurité.

## 5. Ouvrir les ports nécessaires dans le pare-feu de la machine

Les autres postes de l'hôpital doivent atteindre le port **443** (HTTPS) :

```bash
# Linux (ufw)
sudo ufw allow 443/tcp

# Windows (PowerShell, en administrateur)
New-NetFirewallRule -DisplayName "CertificateHub HTTPS" -Direction Inbound -LocalPort 443 -Protocol TCP -Action Allow
```

Le port 80 n'a pas besoin d'être ouvert vers l'extérieur (nginx ne l'utilise
qu'en interne / redirection optionnelle) sauf si l'IT souhaite forcer la
redirection HTTP→HTTPS depuis d'autres postes du LAN aussi.

## 6. Construire les assets frontend et démarrer la stack

```bash
docker build --target export -o web/dist ./web

docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

Attendre que tous les services soient `healthy` :

```bash
docker compose ps
```

Si `app` reste `unhealthy` ou en `502` après `nginx` : nginx met en cache la
résolution DNS interne de `app` au démarrage — si un conteneur a été recréé
après coup sans redémarrer `nginx`, faire `docker compose restart nginx`.

## 7. Initialiser la base de données

```bash
docker compose exec app php artisan key:generate
docker compose exec app php artisan migrate --seed
docker compose exec app php artisan config:cache
```

Le seeding crée automatiquement :
- Les 5 rôles (`reception`, `doctor`, `it`, `admin`, `superadmin`) avec leurs
  permissions.
- **Un seul compte superadmin** : e-mail `superadmin@certhub.local`, mot de
  passe `changeme` par défaut — **sauf si** `SUPERADMIN_EMAIL` /
  `SUPERADMIN_PASSWORD` sont définis dans `.env`, auquel cas ces valeurs sont
  utilisées à la place (recommandé pour un vrai déploiement : définir ces
  deux variables avec un e-mail et un mot de passe réels avant l'étape 3, ou
  se connecter avec le compte par défaut puis changer immédiatement le mot
  de passe via l'écran Utilisateurs).
- Le formulaire "Certificat de santé" et son type de certificat associé.

**Aucun compte reception/doctor/admin/it n'est créé automatiquement** — ce
sont des comptes de test locaux (voir `SEED_CREDENTIALS.md`), pas des
comptes de production. Voir étape 8.

## 8. Créer les vrais comptes du personnel

⛔ **DEMANDER A L'OPERATEUR** la liste du personnel à créer (nom, e-mail,
rôle) — ne jamais inventer de faux comptes de test en production.

Se connecter avec le compte superadmin (https://<IP_SERVEUR>) → écran
**Utilisateurs** → créer un compte par personne avec un mot de passe fort
(généré, transmis en main propre ou par un canal sécurisé — jamais par
e-mail en clair).

## 9. Vérifier les sauvegardes

```bash
docker compose logs backup --tail=20
```

Doit afficher soit `Backup B2 OK: ...` (si les identifiants Backblaze sont
corrects), soit un message d'échec explicite. Si les identifiants B2
n'étaient pas disponibles à l'étape 3 et ont été ajoutés après coup :

```bash
docker compose up -d backup   # relit le .env et redémarre juste ce service
```

Une sauvegarde locale (`./backups/`) est conservée 14 jours même si l'upload
B2 échoue — vérifier que ce dossier grossit bien chaque jour.

## 10. Test de bout en bout (obligatoire avant de considérer le déploiement terminé)

Depuis la machine serveur elle-même :

```bash
curl -k https://localhost/up
```

Depuis **un autre poste du réseau de l'hôpital** (le vrai test qui compte) :

1. Ouvrir un navigateur, aller sur `https://<IP_SERVEUR>`.
2. Accepter l'avertissement de certificat auto-signé (une fois par
   navigateur/poste).
3. Se connecter avec un vrai compte créé à l'étape 8.
4. Dérouler le parcours complet : accueil enregistre un patient + une visite
   → marque payé → médecin prend en charge dans la file d'attente → remplit
   le certificat → finalise → accueil imprime le certificat (voir note
   permissions ci-dessous) → vérifier le rendu du PDF.

**Rappel du modèle de permissions actuel** : le médecin peut uniquement
*prévisualiser* un certificat — seuls les rôles `reception` et `admin`
peuvent l'imprimer (bouton imprimante visible uniquement pour ces rôles,
une fois le certificat finalisé).

## 11. (Recommandé) Mettre en place le déploiement continu

Voir la section « Mise en place du runner self-hosted » dans `README.md` —
permet aux futures mises à jour du dépôt d'être déployées automatiquement
sur cette même machine via GitHub Actions (`deploy.yml`), sans répéter les
étapes 6-7 manuellement à chaque changement.

## Dépannage — problèmes déjà rencontrés en développement

- **Requêtes très lentes (10-20s)** : n'affecte que l'environnement de *dev*
  (bind mount Windows sur `vendor/`) — l'image de production a `vendor/`
  compilé à l'intérieur au moment du build (`docker build`), donc ce
  problème ne devrait pas apparaître en prod. Si des lenteurs apparaissent
  quand même, vérifier d'abord `docker stats` (CPU/mémoire de la machine)
  avant de suspecter Xdebug (absent de l'image de production) ou Typesense.
- **502 après avoir recréé un conteneur** : toujours `docker compose restart
  nginx` après avoir recréé `app`, `worker` ou `postgres` individuellement —
  nginx résout et cache l'IP interne du conteneur au démarrage.
- **Le certificat est refusé même après avoir accepté l'avertissement** :
  vérifier que le certificat a bien un `subjectAltName` (étape 4) — un `CN`
  seul ne suffit plus sur les navigateurs récents.
