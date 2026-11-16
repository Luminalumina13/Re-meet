#!/usr/bin/env bash
# Packs a production build (`next build` with output: "standalone") into a self-contained tarball:
# server.js + traced node_modules + static assets + public/. Run after `npm run build`.
#   scripts/package-release.sh <out.tar.gz>
set -euo pipefail
OUT="${1:?usage: package-release.sh <out.tar.gz>}"
[ -f .next/standalone/server.js ] || { echo "No .next/standalone/server.js: run npm run build first" >&2; exit 1; }
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT
cp -a .next/standalone/. "$STAGE/"
mkdir -p "$STAGE/.next"
cp -a .next/static "$STAGE/.next/static"
[ -d public ] && cp -a public "$STAGE/public"
# Never ship local secrets or data that the standalone trace may have picked up.
rm -rf "$STAGE"/.env* "$STAGE/data"
tar czf "$OUT" -C "$STAGE" .
echo "packed $(du -h "$OUT" | cut -f1) → $OUT"
