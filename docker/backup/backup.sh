#!/bin/sh
# ============================================================================
# backup.sh — sauvegarde PostgreSQL de CertificateHub.
#
#   pg_dump -Fc  ->  vérification du dump  ->  upload Backblaze B2  ->  rotation
#
# Deux principes qui expliquent la logique ci-dessous :
#
#  1. La connectivité de l'hôpital est irrégulière. Un upload échoué n'est donc
#     jamais une perte : le dump reste sur le disque local sans marqueur
#     `.uploaded`, et chaque cycle suivant réessaie tous les dumps non
#     téléversés (flush_pending) — dès que le lien revient, le retard se rattrape.
#
#  2. La rotation ne supprime jamais la seule copie existante. Un dump de plus
#     de BACKUP_RETENTION_DAYS jours n'est effacé que s'il est marqué
#     `.uploaded` (ou si B2 n'est pas configuré du tout, auquel cas la copie
#     locale *est* la copie finale et l'âge seul décide).
#
# Usage :
#   backup.sh            boucle permanente (entrypoint du conteneur)
#   backup.sh --once     un seul cycle puis sortie (utilisé par smoke-test.sh)
# ============================================================================

set -u

. /opt/backup/b2.sh

BACKUP_DIR=${BACKUP_DIR:-/backups/local}
BACKUP_INTERVAL=${BACKUP_INTERVAL_SECONDS:-86400}
RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-14}
REMOTE_PREFIX=${BACKUP_REMOTE_PREFIX:-backups/postgres/}
LOG_FILE="$BACKUP_DIR/backup.log"
LOCK_DIR="$BACKUP_DIR/.lock"

DB_HOST=${DB_HOST:-postgres}
DB_PORT=${DB_PORT:-5432}

ONCE=0
[ "${1:-}" = "--once" ] && ONCE=1

log() {
    _line="[$(date '+%Y-%m-%d %H:%M:%S')] $*"
    echo "$_line"
    # Journal persistant en plus de `docker compose logs` (qui est tronqué par
    # la rotation Docker). Tronqué au-delà de ~1 Mo pour ne pas grossir sans fin.
    if [ -f "$LOG_FILE" ] && [ "$(wc -c < "$LOG_FILE")" -gt 1048576 ]; then
        tail -n 500 "$LOG_FILE" > "$LOG_FILE.tmp" && mv "$LOG_FILE.tmp" "$LOG_FILE"
    fi
    echo "$_line" >> "$LOG_FILE" 2>/dev/null || true
}

# --once peut être lancé à la main pendant que la boucle tourne : le verrou
# évite deux pg_dump/rotations simultanés sur le même répertoire.
acquire_lock() {
    _tries=0
    while ! mkdir "$LOCK_DIR" 2>/dev/null; do
        _tries=$((_tries + 1))
        if [ "$_tries" -ge 30 ]; then
            log "ERREUR: un autre cycle de sauvegarde est deja en cours (verrou $LOCK_DIR)"
            return 1
        fi
        sleep 2
    done
    trap 'rmdir "$LOCK_DIR" 2>/dev/null' EXIT INT TERM
    return 0
}

release_lock() {
    rmdir "$LOCK_DIR" 2>/dev/null || true
    trap - EXIT INT TERM
}

# Un pg_dump tronqué (disque plein, connexion coupée en cours de route) reste
# un fichier d'apparence valide. `pg_restore --list` relit la table des
# matières de l'archive : c'est le contrôle qui distingue un dump exploitable
# d'un fichier corrompu, avant de le compter comme sauvegarde.
make_dump() {
    _stamp=$(date +%Y%m%d_%H%M%S)
    _file="$BACKUP_DIR/backup_${_stamp}.dump"

    if ! pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USERNAME" -d "$DB_DATABASE" \
         -w -F c -f "$_file" 2>>"$LOG_FILE"; then
        log "ERREUR: pg_dump a echoue (voir $LOG_FILE)"
        rm -f "$_file"
        return 1
    fi

    if ! pg_restore --list "$_file" > /dev/null 2>>"$LOG_FILE"; then
        log "ERREUR: le dump $(basename "$_file") est illisible (pg_restore --list) — supprime"
        rm -f "$_file"
        return 1
    fi

    log "Dump local OK: $(basename "$_file") ($(du -h "$_file" | cut -f1))"
    return 0
}

# Téléverse tous les dumps encore dépourvus de marqueur `.uploaded`, du plus
# ancien au plus récent (le retard part avant le frais).
flush_pending() {
    _pending=0
    _sent=0
    _failed=0

    for _file in $(find "$BACKUP_DIR" -maxdepth 1 -name 'backup_*.dump' | sort); do
        [ -f "$_file" ] || continue
        [ -f "$_file.uploaded" ] && continue
        _pending=$((_pending + 1))

        if b2_upload "$_file" "${REMOTE_PREFIX}$(basename "$_file")" 2>>"$LOG_FILE"; then
            date '+%Y-%m-%d %H:%M:%S' > "$_file.uploaded"
            _sent=$((_sent + 1))
            log "Upload B2 OK: $(basename "$_file")"
        else
            _failed=$((_failed + 1))
            log "ATTENTION: upload B2 echoue pour $(basename "$_file") — copie locale conservee, nouvel essai au prochain cycle"
        fi
    done

    [ "$_pending" -eq 0 ] && log "Aucun dump en attente d'upload"
    [ "$_failed" -gt 0 ] && return 1
    return 0
}

prune() {
    for _file in $(find "$BACKUP_DIR" -maxdepth 1 -name 'backup_*.dump' -mtime +"$RETENTION_DAYS"); do
        [ -f "$_file" ] || continue
        if [ "$B2_ENABLED" = "1" ] && [ ! -f "$_file.uploaded" ]; then
            log "Rotation ignoree pour $(basename "$_file") : jamais televersee vers B2, copie locale conservee"
            continue
        fi
        rm -f "$_file" "$_file.uploaded"
        log "Rotation: $(basename "$_file") supprimee (> ${RETENTION_DAYS} jours)"
    done
}

cycle() {
    acquire_lock || return 1

    B2_ENABLED=0
    if b2_configured; then
        if b2_authorize 2>>"$LOG_FILE"; then
            B2_ENABLED=1
        else
            log "ATTENTION: authentification B2 impossible (identifiants ou reseau) — cycle en mode local seul"
        fi
    else
        log "ATTENTION: BACKBLAZE_KEY_ID/APP_KEY/BUCKET non renseignes — sauvegarde LOCALE UNIQUEMENT (aucune copie hors du poste)"
    fi

    make_dump

    if [ "$B2_ENABLED" = "1" ]; then
        flush_pending
    else
        _waiting=$(find "$BACKUP_DIR" -maxdepth 1 -name 'backup_*.dump' | wc -l)
        log "$_waiting dump(s) local(aux) en attente d'un envoi vers B2"
    fi

    prune
    release_lock
}

mkdir -p "$BACKUP_DIR"

if [ "$ONCE" = "1" ]; then
    log "=== Cycle de sauvegarde unique (--once) ==="
    cycle
    exit $?
fi

log "=== Service de sauvegarde demarre (intervalle ${BACKUP_INTERVAL}s, retention ${RETENTION_DAYS} jours) ==="
while true; do
    cycle
    sleep "$BACKUP_INTERVAL"
done
