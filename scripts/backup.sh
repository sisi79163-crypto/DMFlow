#!/bin/sh
set -eu
umask 077
while true; do
  stamp=$(date -u +%Y%m%dT%H%M%SZ)
  temp="/backups/dmflow-$stamp.dump.partial"
  if pg_dump --format=custom --file="$temp"; then
    mv "$temp" "/backups/dmflow-$stamp.dump"
    find /backups -type f -name 'dmflow-*.dump' -mtime +"${BACKUP_RETENTION_DAYS:-14}" -delete
    echo "Backup completed at $stamp"
  else
    rm -f "$temp"
    echo "Backup failed" >&2
  fi
  sleep 86400
done
