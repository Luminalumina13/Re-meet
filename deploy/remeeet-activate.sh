#!/bin/bash
# Activates an uploaded release: /home/deploy/incoming/<id>.tar.gz -> /opt/remeeet/releases/<id>.
# Switches the `current` symlink, restarts the service, health-checks it and rolls back on failure.
set -euo pipefail
ID="${1:-}"
[[ "$ID" =~ ^[0-9a-f]{7,40}$ ]] || { echo "bad release id" >&2; exit 2; }
TARBALL="/home/deploy/incoming/$ID.tar.gz"
ROOT=/opt/remeeet
DIR="$ROOT/releases/$ID"
[ -f "$TARBALL" ] || { echo "no tarball $TARBALL" >&2; exit 2; }

exec 9>/run/remeeet-activate.lock
flock -w 600 9

rm -rf "$DIR.tmp" && mkdir -p "$DIR.tmp"
tar xzf "$TARBALL" -C "$DIR.tmp" --no-same-owner
[ -f "$DIR.tmp/server.js" ] || { echo "release has no server.js" >&2; rm -rf "$DIR.tmp"; exit 2; }
chown -R remeeet:remeeet "$DIR.tmp"
rm -rf "$DIR" && mv "$DIR.tmp" "$DIR"
rm -f "$TARBALL"

PREV="$(readlink -f "$ROOT/current" 2>/dev/null || true)"
switch() { ln -sfn "$1" "$ROOT/current.tmp" && mv -Tf "$ROOT/current.tmp" "$ROOT/current"; systemctl restart remeeet; }
healthy() {
  for _ in $(seq 1 30); do
    if curl -fs -o /dev/null -m 5 http://127.0.0.1:3000/ && curl -fs -o /dev/null -m 5 'http://127.0.0.1:3000/api/airports?q=waw'; then return 0; fi
    sleep 2
  done
  return 1
}

switch "$DIR"
if healthy; then
  echo "release $ID is live"
else
  echo "release $ID failed the health check" >&2
  journalctl -u remeeet -n 30 --no-pager >&2 || true
  if [ -n "$PREV" ] && [ "$PREV" != "$DIR" ] && [ -d "$PREV" ]; then
    switch "$PREV"
    healthy && echo "rolled back to $(basename "$PREV")" >&2 || echo "ROLLBACK ALSO UNHEALTHY" >&2
  fi
  exit 1
fi

# Keep the 5 newest releases (never the live one).
LIVE="$(readlink -f "$ROOT/current")"
ls -1dt "$ROOT"/releases/*/ 2>/dev/null | sed 's:/$::' | tail -n +6 | while read -r old; do
  [ "$old" != "$LIVE" ] && rm -rf "$old"
done
