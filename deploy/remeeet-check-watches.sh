#!/bin/sh
# /usr/local/bin/remeeet-check-watches, run by /etc/cron.d/remeeet:
#   */30 * * * * root /usr/local/bin/remeeet-check-watches 2>&1 | logger -t remeeet-cron
. /etc/remeeet.env
curl -fsS -m 290 -X POST -H "Authorization: Bearer $CRON_SECRET" http://127.0.0.1:3000/api/watches/check >/dev/null
