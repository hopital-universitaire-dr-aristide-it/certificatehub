#!/bin/sh
# ============================================================================
# restore.sh — restauration de la base PostgreSQL de CertificateHub.
#
# Une sauvegarde dont on n'a jamais testé la restauration n'est pas une
# sauvegarde. Ce script est le pendant obligatoire de backup.sh : il liste ce
# qui existe (local + B2), retrouve le dump voulu, et le réinjecte.
#
# Usage (depuis le poste qui héberge la stack) :
#   docker compose exec backup /opt/backup/restore.sh --list
#   docker compose exec backup /opt/backup/restore.sh --latest --yes
#   docker compose exec backup /opt/backup/restore.sh --local  backup_20260729_020000.dump --yes
#   docker compose exec backup /opt/backup/restore.sh --remote backup_20260729_020000.dump --yes
#
# ATTENTION — opération destructive : --clean --if-exists supprime les objets
# existants avant de les recréer. Arrêter les services qui écrivent avant de
# restaurer, sinon leurs connexions ouvertes bloquent les DROP :
#   docker compose stop app worker scheduler
#   ... restauration ...
#   docker compose start app worker scheduler
# ============================================================================

set -u

. /opt/backup/b2.sh

BACKUP_DIR=${BACKUP_DIR:-/backups/local}
REMOTE_PREFIX=${BACKUP_REMOTE_PREFIX:-backups/postgres/}
DB_HOST=${DB_HOST:-postgres}
DB_PORT=${DB_PORT:-5432}

MODE=""
TARGET=""
CONFIRMED=0

usage() {
    sed -n '3,25p' "$0" | sed 's/^# \{0,1\}//'
    exit "${1:-1}"
}

while [ $# -gt 0 ]; do
    case "$1" in
        --list)   MODE="list" ;;
        --latest) MODE="latest" ;;
        --local)  MODE="local";  shift; TARGET=${1:-} ;;
        --remote) MODE="remote"; shift; TARGET=${1:-} ;;
        --yes)    CONFIRMED=1 ;;
        -h|--help) usage 0 ;;
        *) echo "Option inconnue: $1" >&2; usage 1 ;;
    esac
    shift
done

[ -n "$MODE" ] || usage 1

b2_ready=0
if b2_configured && b2_authorize 2>/dev/null; then
    b2_ready=1
fi

list_local() {
    find "$BACKUP_DIR" -maxdepth 1 -name 'backup_*.dump' 2>/dev/null | sort
}

# ---------------------------------------------------------------- --list ----
if [ "$MODE" = "list" ]; then
    echo "Sauvegardes locales ($BACKUP_DIR) :"
    _found=0
    for f in $(list_local); do
        _found=1
        if [ -f "$f.uploaded" ]; then
            _flag="televersee vers B2 le $(cat "$f.uploaded")"
        else
            _flag="LOCALE UNIQUEMENT (pas encore sur B2)"
        fi
        echo "  $(basename "$f")  $(du -h "$f" | cut -f1)  — $_flag"
    done
    [ "$_found" = "0" ] && echo "  (aucune)"

    echo ""
    if [ "$b2_ready" = "1" ]; then
        echo "Sauvegardes distantes (B2 / $BACKBLAZE_BUCKET) :"
        _remote=$(b2_list "$REMOTE_PREFIX" 2>/dev/null | sort)
        if [ -n "$_remote" ]; then
            echo "$_remote" | sed 's|^|  |'
        else
            echo "  (aucune)"
        fi
    else
        echo "Sauvegardes distantes : B2 injoignable ou non configure — liste indisponible."
    fi
    exit 0
fi

# ------------------------------------------------- résolution du fichier ----
DUMP=""

case "$MODE" in
    local)
        [ -n "$TARGET" ] || { echo "--local attend un nom de fichier" >&2; exit 1; }
        # Accepte un nom simple ou un chemin complet.
        case "$TARGET" in
            /*) DUMP="$TARGET" ;;
            *)  DUMP="$BACKUP_DIR/$TARGET" ;;
        esac
        [ -f "$DUMP" ] || { echo "Fichier introuvable: $DUMP" >&2; exit 1; }
        ;;

    remote)
        [ -n "$TARGET" ] || { echo "--remote attend un nom de fichier" >&2; exit 1; }
        [ "$b2_ready" = "1" ] || { echo "B2 non configure ou injoignable — impossible de telecharger" >&2; exit 1; }
        case "$TARGET" in
            "$REMOTE_PREFIX"*) _remote_name="$TARGET" ;;
            *)                 _remote_name="${REMOTE_PREFIX}${TARGET}" ;;
        esac
        DUMP="$BACKUP_DIR/restore_$(basename "$_remote_name")"
        echo "Telechargement de $_remote_name depuis B2..."
        b2_download "$_remote_name" "$DUMP" || exit 1
        ;;

    latest)
        # Le format d'horodatage (YYYYMMDD_HHMMSS) rend le tri lexicographique
        # équivalent au tri chronologique.
        DUMP=$(list_local | tail -n 1)
        if [ -n "$DUMP" ]; then
            echo "Dump local le plus recent : $(basename "$DUMP")"
        elif [ "$b2_ready" = "1" ]; then
            _remote_name=$(b2_list "$REMOTE_PREFIX" 2>/dev/null | sort | tail -n 1)
            [ -n "$_remote_name" ] || { echo "Aucune sauvegarde trouvee, ni locale ni sur B2" >&2; exit 1; }
            DUMP="$BACKUP_DIR/restore_$(basename "$_remote_name")"
            echo "Aucun dump local — telechargement de $_remote_name depuis B2..."
            b2_download "$_remote_name" "$DUMP" || exit 1
        else
            echo "Aucune sauvegarde locale et B2 injoignable" >&2
            exit 1
        fi
        ;;
esac

# Même contrôle qu'à la sauvegarde : on refuse de restaurer une archive dont la
# table des matières est illisible plutôt que de vider la base pour rien.
if ! pg_restore --list "$DUMP" > /dev/null 2>&1; then
    echo "ERREUR: $DUMP n'est pas une archive pg_dump valide — restauration annulee" >&2
    exit 1
fi

if [ "$CONFIRMED" != "1" ]; then
    cat <<EOF

OPERATION DESTRUCTIVE — rien n'a ete modifie.

  Archive      : $DUMP
  Base cible   : $DB_DATABASE sur $DB_HOST:$DB_PORT
  Effet        : les objets existants sont supprimes puis recrees a partir de
                 l'archive (--clean --if-exists). Toute donnee saisie apres
                 cette sauvegarde sera perdue.

Avant de relancer, arreter les services qui ecrivent dans la base :
  docker compose stop app worker scheduler

Puis relancer la meme commande avec --yes.
EOF
    exit 2
fi

_conns=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USERNAME" -d "$DB_DATABASE" -tAw \
    -c "SELECT count(*) FROM pg_stat_activity WHERE datname = '$DB_DATABASE' AND pid <> pg_backend_pid();" 2>/dev/null || echo "?")
if [ "$_conns" != "0" ] && [ "$_conns" != "?" ]; then
    echo "ATTENTION: $_conns connexion(s) active(s) sur $DB_DATABASE — les DROP peuvent echouer."
    echo "           Arreter app/worker/scheduler donne une restauration propre."
fi

echo "Restauration de $(basename "$DUMP") vers $DB_DATABASE..."
if pg_restore -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USERNAME" -d "$DB_DATABASE" \
     -w --clean --if-exists --no-owner --no-privileges "$DUMP"; then
    echo "Restauration terminee."
else
    # pg_restore sort en code != 0 dès le premier avertissement (objet absent
    # au moment du DROP, par exemple) : ce n'est pas forcément un échec réel.
    echo "pg_restore a signale des erreurs — relire la sortie ci-dessus." >&2
    echo "Les avertissements sur des objets inexistants pendant --clean sont normaux." >&2
fi

echo ""
echo "Etapes suivantes :"
echo "  docker compose start app worker scheduler"
echo "  docker compose exec app php artisan migrate --force   # aligne le schema si l'archive est anterieure a une migration"
echo "  docker compose exec app php artisan scout:import \"Modules\\Patient\\Models\\Patient\"   # reindexe Typesense"
