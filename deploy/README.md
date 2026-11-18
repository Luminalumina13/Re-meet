# Deploy

Production runs on one DigitalOcean droplet (Ubuntu 24.04, 512 MB + 2 GB swap) behind Caddy, which handles HTTPS for `remeeet.com` (DNS at GoDaddy: `A @ → droplet IP`, `CNAME www → @`).

## How a deploy works

Every push to `main` runs [`.github/workflows/ci.yml`](../.github/workflows/ci.yml):

1. **check** (also on every pull request): `npm ci`, typecheck, lint, tests, `next build` with `output: "standalone"`, then [`scripts/package-release.sh`](../scripts/package-release.sh) packs `server.js`, the traced `node_modules`, `.next/static` and `public/` into `release.tar.gz`. The build runs on Linux x64 like the droplet, which matters: the bundle contains native modules (sharp).
2. **deploy** (only `main`): uploads the tarball as the `deploy` user to `~/incoming/<sha>.tar.gz` and runs `sudo remeeet-activate <sha>`, the only command `deploy` may run as root.

[`remeeet-activate.sh`](remeeet-activate.sh) unpacks the release into `/opt/remeeet/releases/<sha>`, points the `/opt/remeeet/current` symlink at it, restarts `remeeet.service` and health-checks `/` and `/api/airports`. If the new release does not come up within a minute, it switches back to the previous one and the workflow fails. The 5 newest releases are kept.

Builds never happen on the droplet: with 512 MB a `next build` takes minutes and lives in swap.

## GitHub secrets

| Secret | Value |
|---|---|
| `DEPLOY_HOST` | droplet IP |
| `DEPLOY_SSH_KEY` | private key of the `deploy` user (ed25519) |
| `DEPLOY_KNOWN_HOSTS` | `ssh-keyscan -t ed25519 <ip>` output, so the runner refuses a server it does not know |

## Manual operations (as root on the droplet)

```bash
journalctl -u remeeet -f                      # app logs
ls -t /opt/remeeet/releases                   # releases, newest first
# roll back by hand to an older release:
ln -sfn /opt/remeeet/releases/<sha> /opt/remeeet/current && systemctl restart remeeet
```

Re-run the last deploy: *Actions → CI/CD → Run workflow* on `main`.

## Files on the server

| Repo file | Server path |
|---|---|
| [`remeeet.service`](remeeet.service) | `/etc/systemd/system/remeeet.service` (env in `/etc/remeeet.env`, mode 600: `DATA_DIR=/var/lib/remeeet`, `CRON_SECRET`, `APP_URL`, `WATCH_POLL_MINUTES=0`; for the question form on `/faq` also `FEEDBACK_CHAT_ID` and, unless the tracker bot is reused, `FEEDBACK_BOT_TOKEN`) |
| [`Caddyfile`](Caddyfile) | `/etc/caddy/Caddyfile` |
| [`remeeet-activate.sh`](remeeet-activate.sh) | `/usr/local/bin/remeeet-activate` (sudoers: `deploy ALL=(root) NOPASSWD: /usr/local/bin/remeeet-activate`) |
| [`remeeet-check-watches.sh`](remeeet-check-watches.sh) | `/usr/local/bin/remeeet-check-watches`, run every 30 min from `/etc/cron.d/remeeet` |

The in-process watch scheduler (`WATCH_POLL_MINUTES`) stays off: it keeps its own copy of the watch store and overwrites watches created through the API. Price checks go through the cron script instead.
