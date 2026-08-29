#!/usr/bin/env bash
# ============================================================================
# smoke-test.sh — verification automatisee du deploiement de CertificateHub.
#
# A lancer sur le poste qui heberge la stack, apres `docker compose up` et
# apres chaque mise a jour. Remplace la liste de verifications manuelles de
# DEPLOYMENT.md pour tout ce qui est mecanisable : etat des conteneurs, TLS,
# redirection, en-tetes, cloisonnement de l'API, base, sauvegarde.
#
# Ce que ce script NE peut PAS remplacer : le parcours metier reel depuis un
# autre poste de l'hopital (accueil enregistre -> paiement -> medecin remplit
# -> accueil imprime). Cette partie reste manuelle, voir DEPLOYMENT.md etape 10.
#
# Usage (Git Bash, depuis la racine du depot) :
#   ./scripts/smoke-test.sh                        # cible https://localhost, mode prod
#   ./scripts/smoke-test.sh --host 192.168.1.50    # cible l'IP du serveur
#   ./scripts/smoke-test.sh --dev                  # stack de developpement (HTTP, pas de backup)
#
# Test du parcours authentifie (facultatif — sinon ces controles sont ignores) :
#   SMOKE_EMAIL=... SMOKE_PASSWORD=... ./scripts/smoke-test.sh
#
# Code de sortie : 0 si aucun ECHEC, 1 sinon. Les AVERTISSEMENTS n'echouent pas.
# ============================================================================

set -uo pipefail

HOST="localhost"
MODE="prod"

while [ $# -gt 0 ]; do
    case "$1" in
        --host) shift; HOST=${1:-localhost} ;;
        --dev)  MODE="dev" ;;
        --prod) MODE="prod" ;;
        -h|--help) sed -n '3,24p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
        *) echo "Option inconnue: $1" >&2; exit 1 ;;
    esac
    shift
done

if [ "$MODE" = "prod" ]; then
    COMPOSE="docker compose -f docker-compose.yml -f docker-compose.prod.yml"
    BASE="https://$HOST"
    SERVICES="nginx app postgres redis typesense worker scheduler backup"
else
    COMPOSE="docker compose -f docker-compose.yml -f docker-compose.dev.yml"
    BASE="http://$HOST"
    SERVICES="nginx app postgres redis typesense worker scheduler"
fi

# -k : le certificat est auto-signe, sa non-validation par une autorite
# publique est le fonctionnement attendu ici (LAN, pas d'ACME possible).
CURL="curl -sS -k --max-time 20"

# Nom d'utilisateur / de base lus depuis .env plutot que devines : un
# deploiement peut les avoir changes. Extraction ciblee de ces deux cles
# seulement, pour ne pas exporter tout le fichier de secrets dans ce shell.
if [ -f .env ]; then
    DB_USERNAME=$(sed -n 's/^DB_USERNAME=\([^ #]*\).*/\1/p' .env | tail -n 1)
    DB_DATABASE=$(sed -n 's/^DB_DATABASE=\([^ #]*\).*/\1/p' .env | tail -n 1)
fi
DB_USERNAME=${DB_USERNAME:-certhub_user}
DB_DATABASE=${DB_DATABASE:-certhub_db}

PASS=0
FAIL=0
WARN=0
SKIP=0

if [ -t 1 ]; then
    C_OK=$'\033[32m'; C_KO=$'\033[31m'; C_WA=$'\033[33m'; C_SK=$'\033[90m'; C_HD=$'\033[1m'; C_0=$'\033[0m'
else
    C_OK=""; C_KO=""; C_WA=""; C_SK=""; C_HD=""; C_0=""
fi

section() { echo ""; echo "${C_HD}--- $* ---${C_0}"; }
ok()      { PASS=$((PASS+1)); echo "  ${C_OK}OK  ${C_0} $1"; }
ko()      { FAIL=$((FAIL+1)); echo "  ${C_KO}ECHEC${C_0} $1"; [ $# -gt 1 ] && echo "        $2"; }
warn()    { WARN=$((WARN+1)); echo "  ${C_WA}ATTN ${C_0} $1"; [ $# -gt 1 ] && echo "        $2"; }
skip()    { SKIP=$((SKIP+1)); echo "  ${C_SK}IGNORE${C_0} $1"; }

# Etat d'un service compose, version-agnostique : `docker compose ps --format`
# a change de forme entre les versions de Compose v2, `docker inspect` non.
svc_state() {
    _cid=$($COMPOSE ps -q "$1" 2>/dev/null | head -n 1)
    [ -n "$_cid" ] || { echo "absent"; return; }
    docker inspect -f '{{.State.Status}}/{{if .State.Health}}{{.State.Health.Status}}{{else}}nohealth{{end}}' "$_cid" 2>/dev/null || echo "absent"
}

http_code() { $CURL -o /dev/null -w '%{http_code}' "$@" 2>/dev/null || echo "000"; }

echo "${C_HD}CertificateHub — smoke test${C_0}"
echo "Mode : $MODE    Cible : $BASE"

# ============================================================ 1. Prerequis ==
section "1. Prerequis"

if [ ! -f docker-compose.yml ]; then
    ko "Lance depuis la racine du depot" "docker-compose.yml introuvable dans $(pwd)"
    echo ""; echo "Arret : rien d'autre ne peut etre verifie."; exit 1
fi
ok "Racine du depot"

if docker info > /dev/null 2>&1; then
    ok "Docker repond"
else
    ko "Docker ne repond pas" "Demarrer Docker Desktop et attendre l'etat 'running'"
    echo ""; echo "Arret : rien d'autre ne peut etre verifie."; exit 1
fi

for f in .env api/.env; do
    if [ -f "$f" ]; then ok "$f present"; else ko "$f absent" "Voir DEPLOYMENT.md etape 3"; fi
done

if [ "$MODE" = "prod" ]; then
    if [ -f docker/nginx/ssl/fullchain.pem ] && [ -f docker/nginx/ssl/privkey.pem ]; then
        ok "Certificat TLS present"
    else
        ko "Certificat TLS absent" "./scripts/generate-tls-cert.sh <IP_SERVEUR>"
    fi

    # Un .env de prod qui contient encore les valeurs de dev de SEED_CREDENTIALS.md
    # signifie que la stack tourne avec des mots de passe publies dans le depot.
    if grep -qE '^(DB_PASSWORD|REDIS_PASSWORD|TYPESENSE_API_KEY)=certhub_dev' .env 2>/dev/null; then
        ko "Mots de passe de developpement dans .env" "Valeurs certhub_dev_* interdites en production (DEPLOYMENT.md etape 3)"
    else
        ok "Aucun mot de passe de developpement dans .env"
    fi

    if grep -qE '^APP_DEBUG=true' .env 2>/dev/null; then
        ko "APP_DEBUG=true dans .env" "Expose les traces d'erreur et la configuration"
    else
        ok "APP_DEBUG desactive"
    fi
fi

# ============================================================ 2. Services ===
section "2. Etat des services"

for svc in $SERVICES; do
    state=$(svc_state "$svc")
    case "$state" in
        running/healthy)   ok "$svc (running, healthy)" ;;
        running/nohealth)  ok "$svc (running, pas de healthcheck)" ;;
        running/starting)  warn "$svc demarre encore (healthcheck: starting)" "Relancer le test dans une minute" ;;
        running/unhealthy) ko "$svc running mais UNHEALTHY" "docker compose logs $svc --tail=50" ;;
        absent)            ko "$svc absent" "Service non cree — verifier les fichiers compose utilises" ;;
        *)                 ko "$svc dans l'etat '$state'" "docker compose logs $svc --tail=50" ;;
    esac
done

# ================================================================= 3. TLS ===
section "3. TLS"

if [ "$MODE" = "dev" ]; then
    skip "Controles TLS (mode dev)"
else
    CERT=docker/nginx/ssl/fullchain.pem
    if [ -f "$CERT" ]; then
        # 30 jours d'avance : le temps de regenerer et de faire reaccepter
        # l'exception sur les postes avant l'expiration.
        if openssl x509 -in "$CERT" -noout -checkend 0 > /dev/null 2>&1; then
            if openssl x509 -in "$CERT" -noout -checkend 2592000 > /dev/null 2>&1; then
                ok "Certificat valide ($(openssl x509 -in "$CERT" -noout -enddate | cut -d= -f2))"
            else
                warn "Certificat expire dans moins de 30 jours" "$(openssl x509 -in "$CERT" -noout -enddate)"
            fi
        else
            ko "Certificat EXPIRE" "./scripts/generate-tls-cert.sh <IP_SERVEUR> --force"
        fi

        SAN=$(openssl x509 -in "$CERT" -noout -ext subjectAltName 2>/dev/null | tail -n +2 | tr -d ' ')
        if [ -z "$SAN" ]; then
            ko "Certificat sans subjectAltName" "Les navigateurs refuseront la connexion — regenerer avec generate-tls-cert.sh"
        elif echo "$SAN" | grep -q "$HOST"; then
            ok "subjectAltName couvre $HOST ($SAN)"
        else
            ko "subjectAltName ne couvre pas $HOST" "SAN actuel : $SAN"
        fi
    fi

    # Le certificat servi peut differer du fichier sur disque si nginx n'a pas
    # ete redemarre apres une regeneration.
    served=$(echo | openssl s_client -connect "$HOST:443" -servername "$HOST" 2>/dev/null | openssl x509 -noout -fingerprint -sha256 2>/dev/null | cut -d= -f2)
    ondisk=$(openssl x509 -in docker/nginx/ssl/fullchain.pem -noout -fingerprint -sha256 2>/dev/null | cut -d= -f2)
    if [ -z "$served" ]; then
        ko "Aucune reponse TLS sur $HOST:443" "docker compose logs nginx --tail=50"
    elif [ "$served" = "$ondisk" ]; then
        ok "nginx sert bien le certificat de docker/nginx/ssl"
    else
        ko "nginx sert un autre certificat que celui sur disque" "docker compose restart nginx"
    fi

    for proto in tls1 tls1_1; do
        if echo | openssl s_client -"$proto" -connect "$HOST:443" > /dev/null 2>&1; then
            ko "TLS obsolete accepte ($proto)" "Verifier ssl_protocols dans docker/nginx/default.prod.conf"
        else
            ok "$proto refuse"
        fi
    done

    if echo | openssl s_client -tls1_2 -connect "$HOST:443" > /dev/null 2>&1; then
        ok "TLS 1.2 accepte"
    else
        ko "TLS 1.2 refuse" "Les navigateurs plus anciens du parc ne pourront pas se connecter"
    fi
fi

# ======================================================== 4. HTTP / routes ==
section "4. Reponses HTTP"

code=$(http_code "$BASE/up")
if [ "$code" = "200" ]; then
    body=$($CURL "$BASE/up" 2>/dev/null | tr -d '\r\n')
    if echo "$body" | grep -qi "application up\|ok"; then
        ok "/up repond 200"
    else
        warn "/up repond 200 mais le corps est inattendu" "$(echo "$body" | head -c 120)"
    fi
else
    ko "/up repond $code" "docker compose logs nginx app --tail=50"
fi

if [ "$MODE" = "prod" ]; then
    # Verifie la redirection de default.prod.conf. -I : on ne veut que le statut,
    # sans suivre la redirection.
    redirect=$(curl -sS -k --max-time 20 -o /dev/null -w '%{http_code} %{redirect_url}' "http://$HOST/api/v1/auth/me" 2>/dev/null || echo "000 -")
    rcode=${redirect%% *}
    rurl=${redirect#* }
    if [ "$rcode" = "301" ] && [ "${rurl#https://}" != "$rurl" ]; then
        ok "HTTP redirige en 301 vers $rurl"
    else
        ko "Pas de redirection HTTP->HTTPS (recu '$redirect')" "docker-compose.prod.yml doit monter docker/nginx/default.prod.conf"
    fi
else
    skip "Redirection HTTP->HTTPS (mode dev)"
fi

headers=$($CURL -D - -o /dev/null "$BASE/up" 2>/dev/null | tr -d '\r')
check_header() {
    if echo "$headers" | grep -qi "^$1:"; then
        ok "En-tete $1 present"
    else
        ko "En-tete $1 absent" "Voir docker/nginx/snippets/security-headers.conf"
    fi
}
check_header "X-Content-Type-Options"
check_header "X-Frame-Options"
check_header "Referrer-Policy"
if [ "$MODE" = "prod" ]; then
    check_header "Strict-Transport-Security"
fi

for path in "/.env" "/storage/logs/laravel.log" "/.git/config"; do
    code=$(http_code "$BASE$path")
    if [ "$code" = "403" ] || [ "$code" = "404" ]; then
        ok "$path non servi ($code)"
    else
        ko "$path accessible ($code)" "Verifier les blocs deny de docker/nginx/snippets/app.conf"
    fi
done

# =============================================================== 5. API =====
section "5. Cloisonnement de l'API"

code=$(http_code -H "Accept: application/json" "$BASE/api/v1/patients")
if [ "$code" = "401" ]; then
    ok "GET /api/v1/patients sans jeton -> 401"
else
    ko "GET /api/v1/patients sans jeton -> $code (401 attendu)" "Une route patient ne doit jamais repondre sans authentification"
fi

code=$(http_code -X POST -H "Accept: application/json" -H "Content-Type: application/json" \
    -d '{"email":"inexistant@example.invalid","password":"mauvais"}' "$BASE/api/v1/auth/login")
case "$code" in
    401|422) ok "Login avec de mauvais identifiants -> $code" ;;
    429)     warn "Login -> 429" "Limiteur throttle:5,1 deja sature par un test precedent — reessayer dans une minute" ;;
    500)     ko "Login -> 500" "Erreur serveur : docker compose logs app --tail=50" ;;
    *)       ko "Login -> $code (401 ou 422 attendu)" ;;
esac

if [ -n "${SMOKE_EMAIL:-}" ] && [ -n "${SMOKE_PASSWORD:-}" ]; then
    login=$($CURL -X POST -H "Accept: application/json" -H "Content-Type: application/json" \
        -d "{\"email\":\"$SMOKE_EMAIL\",\"password\":\"$SMOKE_PASSWORD\"}" \
        "$BASE/api/v1/auth/login" 2>/dev/null)
    token=$(echo "$login" | sed -n 's/.*"token"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')
    if [ -n "$token" ]; then
        ok "Login de $SMOKE_EMAIL reussi"
        code=$(http_code -H "Accept: application/json" -H "Authorization: Bearer $token" "$BASE/api/v1/auth/me")
        if [ "$code" = "200" ]; then ok "GET /api/v1/auth/me avec jeton -> 200"; else ko "GET /api/v1/auth/me -> $code"; fi
        # Ne laisse pas un jeton de test valide derriere le passage du script.
        http_code -X POST -H "Authorization: Bearer $token" "$BASE/api/v1/auth/logout" > /dev/null
    else
        ko "Login de $SMOKE_EMAIL echoue" "$(echo "$login" | head -c 200)"
    fi
else
    skip "Parcours authentifie (definir SMOKE_EMAIL et SMOKE_PASSWORD pour l'activer)"
fi

# ========================================================== 6. Frontend =====
section "6. Frontend"

if [ "$MODE" = "prod" ]; then
    index=$($CURL "$BASE/" 2>/dev/null)
    if echo "$index" | grep -q '<div id="root"'; then
        ok "index.html du SPA servi"
    else
        ko "La racine ne renvoie pas le SPA" "Assets construits ? docker build --target export -o web/dist ./web"
    fi

    asset=$(echo "$index" | sed -n 's/.*src="\(\/assets\/[^"]*\.js\)".*/\1/p' | head -n 1)
    if [ -n "$asset" ]; then
        ahead=$($CURL -D - -o /dev/null "$BASE$asset" 2>/dev/null | tr -d '\r')
        if echo "$ahead" | grep -q "200"; then
            ok "Asset $asset servi"
            echo "$ahead" | grep -qi "^Cache-Control:.*immutable" \
                && ok "Asset en cache long (Cache-Control immutable)" \
                || warn "Asset sans Cache-Control immutable"
            echo "$ahead" | grep -qi "^X-Content-Type-Options:" \
                && ok "Asset avec en-tetes de securite" \
                || ko "Asset sans en-tete de securite" "Le include de security-headers.conf manque dans le location des assets"
        else
            ko "Asset $asset non servi"
        fi
    else
        warn "Aucun asset JS trouve dans index.html" "Build frontend incomplet ?"
    fi
else
    skip "Controles frontend (le SPA est servi par Vite sur :5173 en dev)"
fi

# ========================================================== 7. Base / app ===
section "7. Base de donnees et application"

migr=$($COMPOSE exec -T app php artisan migrate:status 2>&1)
if echo "$migr" | grep -q "Pending"; then
    ko "Migrations en attente" "docker compose exec app php artisan migrate --force"
elif echo "$migr" | grep -q "Ran"; then
    ok "Toutes les migrations sont appliquees"
else
    ko "migrate:status illisible" "$(echo "$migr" | head -c 200)"
fi

roles=$($COMPOSE exec -T postgres psql -U "$DB_USERNAME" -d "$DB_DATABASE" -tA \
    -c "SELECT count(*) FROM roles;" 2>/dev/null | tr -d '[:space:]')
if [ "$roles" = "5" ]; then
    ok "5 roles presents en base"
elif [ -n "$roles" ]; then
    warn "$roles role(s) en base (5 attendus)" "php artisan db:seed a-t-il ete lance ?"
else
    ko "Table roles illisible" "Seeding non effectue ? docker compose exec app php artisan migrate --seed"
fi

users=$($COMPOSE exec -T postgres psql -U "$DB_USERNAME" -d "$DB_DATABASE" -tA \
    -c "SELECT count(*) FROM users;" 2>/dev/null | tr -d '[:space:]')
if [ -n "$users" ] && [ "$users" -ge 1 ] 2>/dev/null; then
    ok "$users compte(s) utilisateur en base"
else
    ko "Aucun compte utilisateur" "Le superadmin est cree par le seeding (DEPLOYMENT.md etape 7)"
fi

if $COMPOSE exec -T app php artisan tinker --execute="echo Illuminate\Support\Facades\Cache::store('redis')->put('smoke', 'ok', 10) ? 'REDIS_OK' : 'REDIS_KO';" 2>/dev/null | grep -q REDIS_OK; then
    ok "Redis accessible depuis l'application"
else
    warn "Ecriture Redis non confirmee" "docker compose logs redis --tail=20"
fi

# ============================================================ 8. Sauvegarde =
section "8. Sauvegarde"

if [ "$MODE" = "dev" ]; then
    skip "Service de sauvegarde (prod uniquement)"
else
    if grep -qE '^BACKBLAZE_KEY_ID=.+' .env 2>/dev/null && grep -qE '^BACKBLAZE_APP_KEY=.+' .env 2>/dev/null; then
        B2_SET=1
        ok "Identifiants Backblaze B2 renseignes"
    else
        B2_SET=0
        warn "BACKBLAZE_KEY_ID / BACKBLAZE_APP_KEY vides" "Sauvegarde locale uniquement : une panne du poste ferait perdre la base (DEPLOYMENT.md etape 0)"
    fi

    before=$(ls -1 backups/backup_*.dump 2>/dev/null | wc -l | tr -d ' ')

    # Declenche un cycle immediat au lieu d'attendre les 24 h de la boucle :
    # c'est le seul moyen de prouver que la sauvegarde fonctionne vraiment
    # (droits, mot de passe, connexion B2) plutot que de supposer.
    echo "  ... cycle de sauvegarde force (peut prendre un moment)"
    out=$($COMPOSE exec -T backup /opt/backup/backup.sh --once 2>&1)

    if echo "$out" | grep -q "Dump local OK"; then
        ok "pg_dump reussi et archive relue par pg_restore"
    else
        ko "Le cycle de sauvegarde n'a pas produit de dump valide" "$(echo "$out" | tail -n 5)"
    fi

    after=$(ls -1 backups/backup_*.dump 2>/dev/null | wc -l | tr -d ' ')
    if [ "$after" -gt "$before" ]; then
        ok "Nouveau dump visible dans ./backups ($before -> $after)"
    else
        ko "Aucun nouveau fichier dans ./backups" "Verifier le montage ./backups:/backups/local"
    fi

    if [ "${B2_SET:-0}" = "1" ]; then
        if echo "$out" | grep -q "Upload B2 OK"; then
            ok "Televersement vers Backblaze B2 confirme (SHA-1 verifie)"
        elif echo "$out" | grep -q "authentification B2 impossible"; then
            ko "Authentification B2 refusee" "Verifier BACKBLAZE_KEY_ID/APP_KEY et que la cle a le droit writeFiles sur le bucket"
        elif echo "$out" | grep -q "upload B2 echoue"; then
            warn "Upload B2 echoue" "Le dump local est conserve et sera reessaye au prochain cycle — verifier la connexion sortante"
        else
            warn "Etat de l'upload B2 indetermine" "$(echo "$out" | tail -n 3)"
        fi
    else
        skip "Verification de l'upload B2 (identifiants absents)"
    fi

    if $COMPOSE exec -T backup /opt/backup/restore.sh --list > /dev/null 2>&1; then
        ok "restore.sh --list fonctionne (procedure de restauration disponible)"
    else
        ko "restore.sh --list echoue" "docker compose exec backup /opt/backup/restore.sh --list"
    fi
fi

# ================================================================= Bilan ====
echo ""
echo "${C_HD}=====================================${C_0}"
echo "${C_OK}OK${C_0} : $PASS    ${C_KO}ECHEC${C_0} : $FAIL    ${C_WA}ATTN${C_0} : $WARN    ${C_SK}IGNORE${C_0} : $SKIP"
echo "${C_HD}=====================================${C_0}"

if [ "$FAIL" -gt 0 ]; then
    echo ""
    echo "${C_KO}Deploiement non valide${C_0} — corriger les echecs ci-dessus avant de mettre l'application"
    echo "a disposition du personnel."
    exit 1
fi

echo ""
echo "${C_OK}Verifications automatiques passees.${C_0}"
echo ""
echo "Il reste le test manuel qui ne peut pas etre automatise (DEPLOYMENT.md etape 10) :"
echo "  depuis un AUTRE poste de l'hopital, ouvrir $BASE, se connecter avec un"
echo "  vrai compte et derouler accueil -> paiement -> medecin -> impression du certificat."
exit 0
