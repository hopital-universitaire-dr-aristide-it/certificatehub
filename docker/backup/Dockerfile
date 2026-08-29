# Image du service de sauvegarde.
#
# Base postgres:16-alpine et non alpine:3.19 + `apk add postgresql-client` pour
# deux raisons :
#
#  1. Parite de version garantie avec le serveur (meme image que le service
#     `postgres` de la stack). pg_dump refuse de dumper une base servie par un
#     PostgreSQL plus recent que lui — un decalage de version majeure sur un
#     `apk upgrade` casserait silencieusement les sauvegardes.
#  2. Plus aucun `apk add` au demarrage du conteneur. L'ancienne version
#     installait ses paquets a chaque (re)demarrage : sur un poste sans
#     connexion au reboot, le service de sauvegarde ne demarrait pas du tout —
#     precisement le scenario contre lequel il est cense proteger.
FROM postgres:16-alpine

# curl + jq : appels a l'API native Backblaze B2 (voir b2.sh).
# tzdata : horodatage des dumps dans le fuseau de l'hopital (APP_TIMEZONE).
RUN apk add --no-cache curl jq tzdata

COPY docker/backup/b2.sh      /opt/backup/b2.sh
COPY docker/backup/backup.sh  /opt/backup/backup.sh
COPY docker/backup/restore.sh /opt/backup/restore.sh

# sed -i : ces fichiers sont edites sur un poste Windows ; un CRLF residuel
# rendrait le shebang invalide ("no such file or directory") dans le conteneur.
# .gitattributes force deja LF cote depot, ceci est la ceinture de securite.
RUN sed -i 's/\r$//' /opt/backup/*.sh && chmod +x /opt/backup/*.sh

ENTRYPOINT ["/opt/backup/backup.sh"]
