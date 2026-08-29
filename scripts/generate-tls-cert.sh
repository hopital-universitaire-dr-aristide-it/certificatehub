#!/usr/bin/env bash
# ============================================================================
# generate-tls-cert.sh — certificat TLS auto-signe pour CertificateHub.
#
# Remplace le bloc openssl a recopier a la main dans DEPLOYMENT.md : l'oubli du
# subjectAltName y etait l'erreur la plus couteuse (les navigateurs recents
# ignorent le CN seul et refusent la connexion sans meme proposer d'exception
# de securite — voir le depannage de DEPLOYMENT.md).
#
# Usage (depuis la racine du depot, dans Git Bash) :
#   ./scripts/generate-tls-cert.sh 192.168.1.50
#   ./scripts/generate-tls-cert.sh 192.168.1.50 certhub.aristide.local
#   ./scripts/generate-tls-cert.sh 192.168.1.50 --force   # ecraser l'existant
#
# Les IP sont ajoutees en `IP:`, les noms d'hote en `DNS:`. localhost et
# 127.0.0.1 sont toujours inclus, pour que le controle de sante local
# (`curl https://localhost/up`) et smoke-test.sh fonctionnent sur le poste
# lui-meme.
# ============================================================================

set -euo pipefail

SSL_DIR="docker/nginx/ssl"
DAYS=825   # limite acceptee par les navigateurs pour un certificat auto-signe
FORCE=0
HOSTS=()

for arg in "$@"; do
    case "$arg" in
        --force) FORCE=1 ;;
        -h|--help)
            sed -n '3,20p' "$0" | sed 's/^# \{0,1\}//'
            exit 0
            ;;
        -*) echo "Option inconnue: $arg" >&2; exit 1 ;;
        *)  HOSTS+=("$arg") ;;
    esac
done

if [ ${#HOSTS[@]} -eq 0 ]; then
    echo "Usage: $0 <ip-ou-nom-du-serveur> [autre-nom...] [--force]" >&2
    echo "Exemple: $0 192.168.1.50" >&2
    exit 1
fi

if ! command -v openssl > /dev/null 2>&1; then
    echo "openssl est introuvable. Git Bash l'inclut — verifier d'etre dans Git Bash" >&2
    echo "et non dans PowerShell/cmd." >&2
    exit 1
fi

if [ ! -f docker-compose.yml ]; then
    echo "A lancer depuis la racine du depot (docker-compose.yml introuvable ici)." >&2
    exit 1
fi

# Le certificat n'est pas dans git (.gitignore) et est monte en lecture seule
# par nginx : l'ecraser par accident coute un redemarrage de nginx et une
# nouvelle acceptation d'exception sur chaque poste de l'hopital.
if [ -f "$SSL_DIR/fullchain.pem" ] && [ "$FORCE" -ne 1 ]; then
    echo "Un certificat existe deja dans $SSL_DIR :"
    openssl x509 -in "$SSL_DIR/fullchain.pem" -noout -subject -dates \
        -ext subjectAltName 2>/dev/null | sed 's/^/  /'
    echo ""
    echo "Relancer avec --force pour le remplacer (chaque poste de l'hopital"
    echo "devra alors reaccepter l'avertissement de securite)."
    exit 2
fi

# SAN : une entree IP: par adresse, DNS: par nom d'hote.
SAN=""
add_san() {
    [ -n "$SAN" ] && SAN="$SAN,"
    SAN="$SAN$1"
}
for host in "${HOSTS[@]}"; do
    if echo "$host" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$'; then
        add_san "IP:$host"
    else
        add_san "DNS:$host"
    fi
done
# Toujours presents : utilises par le healthcheck du conteneur nginx et par
# smoke-test.sh lance sur le poste serveur.
echo "$SAN" | grep -q 'DNS:localhost'  || add_san "DNS:localhost"
echo "$SAN" | grep -q 'IP:127.0.0.1'   || add_san "IP:127.0.0.1"

CN="${HOSTS[0]}"

mkdir -p "$SSL_DIR"

echo "Generation du certificat auto-signe :"
echo "  CN  : $CN"
echo "  SAN : $SAN"
echo "  duree : $DAYS jours"
echo ""

openssl req -x509 -nodes -days "$DAYS" -newkey rsa:2048 \
    -keyout "$SSL_DIR/privkey.pem" \
    -out "$SSL_DIR/fullchain.pem" \
    -subj "/C=HT/ST=Ouest/L=Port-au-Prince/O=Hopital Universitaire Dr. Aristide/OU=Service Informatique/CN=$CN" \
    -addext "subjectAltName=$SAN" \
    -addext "basicConstraints=critical,CA:FALSE" \
    -addext "keyUsage=critical,digitalSignature,keyEncipherment" \
    -addext "extendedKeyUsage=serverAuth"

chmod 600 "$SSL_DIR/privkey.pem" 2>/dev/null || true
chmod 644 "$SSL_DIR/fullchain.pem" 2>/dev/null || true

echo "Certificat ecrit :"
echo "  $SSL_DIR/fullchain.pem"
echo "  $SSL_DIR/privkey.pem"
echo ""
openssl x509 -in "$SSL_DIR/fullchain.pem" -noout -subject -dates -ext subjectAltName | sed 's/^/  /'
echo ""
echo "Recharger nginx pour qu'il serve ce certificat :"
echo "  docker compose -f docker-compose.yml -f docker-compose.prod.yml restart nginx"
