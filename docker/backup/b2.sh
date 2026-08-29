#!/bin/sh
# ============================================================================
# b2.sh — client Backblaze B2 minimal (API native v3), en curl + jq.
#
# POURQUOI L'API NATIVE ET PAS L'API S3 :
# le plan initial (et DOC-11 du dépôt hms) proposait un simple
#   curl -u KEY_ID:APP_KEY -T dump https://s3.us-east-005.backblazeb2.com/...
# Cela ne peut pas fonctionner : le endpoint S3-compatible de Backblaze exige
# une signature AWS SigV4 et rejette l'authentification HTTP Basic. L'API
# native de B2, elle, s'authentifie bien en Basic (b2_authorize_account) puis
# par jeton — donc elle reste faisable en curl seul, sans awscli ni b2 CLI.
#
# Séquence : b2_authorize_account -> (b2_list_buckets) -> b2_get_upload_url
#            -> POST du fichier -> vérification du SHA-1 renvoyé.
#
# Sourcé par backup.sh et restore.sh. POSIX sh (busybox ash).
# ============================================================================

B2_API_BASE="https://api.backblazeb2.com/b2api/v3"

B2_API_URL=""
B2_DOWNLOAD_URL=""
B2_TOKEN=""
B2_ACCOUNT_ID=""
B2_BUCKET_ID=""
B2_LAST_BODY=""

# Les identifiants B2 sont facultatifs : sans eux la sauvegarde reste locale
# (voir backup.sh). C'est un mode dégradé assumé, pas une erreur fatale.
b2_configured() {
    [ -n "${BACKBLAZE_KEY_ID:-}" ] &&
    [ -n "${BACKBLAZE_APP_KEY:-}" ] &&
    [ -n "${BACKBLAZE_BUCKET:-}" ]
}

# Exécute un appel et sépare corps / code HTTP (le code est ajouté sur une
# dernière ligne par -w, puis retiré du corps par `sed '$d'`).
_b2_curl() {
    _resp=$(curl -sS -w '\n%{http_code}' "$@" 2>&1) || {
        B2_LAST_BODY="$_resp"
        return 1
    }
    B2_LAST_CODE=$(echo "$_resp" | tail -n 1)
    B2_LAST_BODY=$(echo "$_resp" | sed '$d')
    [ "$B2_LAST_CODE" = "200" ]
}

b2_authorize() {
    if ! _b2_curl --max-time 60 -u "$BACKBLAZE_KEY_ID:$BACKBLAZE_APP_KEY" \
         "$B2_API_BASE/b2_authorize_account"; then
        echo "b2_authorize_account a echoue: ${B2_LAST_BODY}" >&2
        return 1
    fi

    # `// .champ` : tolère aussi la forme de réponse v2 (champs à la racine)
    # au cas où la clé utilisée serait servie par l'ancien schéma.
    B2_API_URL=$(echo "$B2_LAST_BODY"      | jq -r '.apiInfo.storageApi.apiUrl // .apiUrl // empty')
    B2_DOWNLOAD_URL=$(echo "$B2_LAST_BODY" | jq -r '.apiInfo.storageApi.downloadUrl // .downloadUrl // empty')
    B2_TOKEN=$(echo "$B2_LAST_BODY"        | jq -r '.authorizationToken // empty')
    B2_ACCOUNT_ID=$(echo "$B2_LAST_BODY"   | jq -r '.accountId // empty')
    # Non vide seulement si la clé est restreinte à un bucket (cas recommandé).
    B2_BUCKET_ID=$(echo "$B2_LAST_BODY"    | jq -r '.apiInfo.storageApi.bucketId // .allowed.bucketId // empty')

    if [ -z "$B2_API_URL" ] || [ -z "$B2_TOKEN" ]; then
        echo "b2_authorize_account: reponse inattendue (apiUrl/token absents)" >&2
        return 1
    fi

    [ -n "$B2_BUCKET_ID" ] || b2_resolve_bucket_id || return 1
    return 0
}

# Appel authentifié à l'API (toujours POST + JSON en v3).
b2_api() {
    _path=$1
    _json=$2
    if ! _b2_curl --max-time 60 -X POST "$B2_API_URL/b2api/v3/$_path" \
         -H "Authorization: $B2_TOKEN" \
         -H "Content-Type: application/json" \
         -d "$_json"; then
        echo "$_path a echoue (HTTP ${B2_LAST_CODE:-?}): ${B2_LAST_BODY}" >&2
        return 1
    fi
    return 0
}

# Utilisé uniquement avec une clé maître (une clé restreinte fournit déjà son
# bucketId dans la réponse d'autorisation).
b2_resolve_bucket_id() {
    b2_api b2_list_buckets \
        "{\"accountId\":\"$B2_ACCOUNT_ID\",\"bucketName\":\"$BACKBLAZE_BUCKET\"}" || return 1
    B2_BUCKET_ID=$(echo "$B2_LAST_BODY" | jq -r '.buckets[0].bucketId // empty')
    if [ -z "$B2_BUCKET_ID" ]; then
        echo "Bucket '$BACKBLAZE_BUCKET' introuvable sur ce compte B2" >&2
        return 1
    fi
    return 0
}

# b2_upload <fichier_local> <nom_distant>
# Le SHA-1 est calculé localement, envoyé dans X-Bz-Content-Sha1 (B2 refuse
# l'upload s'il ne correspond pas) puis recomparé au SHA-1 renvoyé : c'est la
# vérification d'intégrité de bout en bout de la sauvegarde.
b2_upload() {
    _file=$1
    _remote=$2

    b2_api b2_get_upload_url "{\"bucketId\":\"$B2_BUCKET_ID\"}" || return 1
    _upload_url=$(echo "$B2_LAST_BODY" | jq -r '.uploadUrl // empty')
    _upload_tok=$(echo "$B2_LAST_BODY" | jq -r '.authorizationToken // empty')
    if [ -z "$_upload_url" ] || [ -z "$_upload_tok" ]; then
        echo "b2_get_upload_url: reponse inattendue" >&2
        return 1
    fi

    _sha1=$(sha1sum "$_file" | cut -d' ' -f1)

    if ! _b2_curl --max-time 3600 -X POST "$_upload_url" \
         -H "Authorization: $_upload_tok" \
         -H "X-Bz-File-Name: $_remote" \
         -H "Content-Type: application/octet-stream" \
         -H "X-Bz-Content-Sha1: $_sha1" \
         --data-binary "@$_file"; then
        echo "Upload de $_remote a echoue (HTTP ${B2_LAST_CODE:-?}): ${B2_LAST_BODY}" >&2
        return 1
    fi

    _returned=$(echo "$B2_LAST_BODY" | jq -r '.contentSha1 // empty')
    if [ "$_returned" != "$_sha1" ]; then
        echo "Integrite: SHA-1 renvoye par B2 ($_returned) != local ($_sha1)" >&2
        return 1
    fi
    return 0
}

# b2_list <prefixe> — un nom de fichier distant par ligne.
b2_list() {
    b2_api b2_list_file_names \
        "{\"bucketId\":\"$B2_BUCKET_ID\",\"prefix\":\"$1\",\"maxFileCount\":1000}" || return 1
    echo "$B2_LAST_BODY" | jq -r '.files[].fileName'
}

# b2_download <nom_distant> <destination_locale>
b2_download() {
    _code=$(curl -sS --max-time 3600 -o "$2" -w '%{http_code}' \
        -H "Authorization: $B2_TOKEN" \
        "$B2_DOWNLOAD_URL/file/$BACKBLAZE_BUCKET/$1") || return 1
    if [ "$_code" != "200" ]; then
        echo "Telechargement de $1 a echoue (HTTP $_code)" >&2
        rm -f "$2"
        return 1
    fi
    return 0
}
