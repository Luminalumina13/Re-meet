# Re:meeet

*Make time together last longer.*

Flight search tuned for **weekends** — and a planner that picks tickets for **friends flying from different cities** so that the time they spend together is maximal. With **price tracking** on top.

| Weekend search | Anywhere | Friends meetup | Price tracking |
|---|---|---|---|
| ![search](docs/screenshots/search-light.png) | ![explore](docs/screenshots/explore-light.png) | ![meetup](docs/screenshots/meetup-light.png) | ![watches](docs/screenshots/watches-dark.png) |

## What it does

- **Weekend search** — pick a weekend (Sat–Sun, Fri–Sun, Fri–Mon, …) and a route. The default *Ideal weekend* preset keeps only flights that leave **no earlier than 08:00** (**12:00 when you depart on a Friday**, and you can change the time) and bring you home **in the evening (17:00–23:30)**. Results get a *comfort score* (time windows, directness, speed) and a composite rank mixing comfort and price. Sort by best / cheapest / fastest / most comfortable.
- **Shareable links** — a *Share* button on search, "anywhere" and meetup copies a link (or opens the share sheet on phones) that re-creates the form and runs the same search: route, dates or weekend, travellers, cabin; for meetups also the friends with their airports, places and the money-vs-time setting. Unknown or past values in a link are ignored. Time-of-day filters are not part of the link.
- **Flexible dates (±3 days)** — a price grid under the search form: cheapest one-way fare for each day around your departure and return, combined into a departure × return table (sums of two one-way tickets, with your time filters applied). A pair counts only if the return flight leaves at least 3 hours after the outbound lands, so cells never mix a cheap flight that arrives after the cheap return has gone. Filled in as answers arrive; press a price to search those dates. It costs about 14 provider queries per press, so it only runs on demand.
- **Meetup planner** — add friends with their home airports and one or more candidate meeting cities (optionally the friends' own cities). The engine picks an outbound and a return per friend to **maximise time everyone is in the same place**, trading hours against money with a single knob (*what an hour together is worth*). Shows a timeline of who is there when, the shared window, and a time-vs-price frontier of alternatives. Friends who live in the destination are hosts (no flights).
  A friend can list several airports (e.g. two cities nearby); the planner picks the cheapest one that works, flying out and back from the same airport.
- **Price tracking** — save any search or meetup query as a *watch*. A scheduler re-runs it, records price history, and raises alerts for **price drops**, **new offers** (flights not seen before), **target price reached**, big rises and vanished offers. Alerts go to the in-app page, a webhook (Slack/Discord/anything) and/or a Telegram bot where users can also manage their trackers.
- **Date range** — a "Date range" tab next to the weekend and custom dates, on the search, Anywhere and meet-up pages: leave any day from … to …, and come back either within a return window or after N to M nights (or one way, on the search page). The rules live in `src/lib/domain/dateRange.ts` (pairs, nights, limits), the form in `src/components/search/DateRangeFields.tsx` and `src/lib/rangeForm.ts` (also the share-link params `depTo`, `back`, `retTo`, `nMin`, `nMax`).
  - Search page: up to 14 days per window. `POST /api/range` (`src/lib/flex/range.ts`) asks the sources that search ranges themselves (Kiwi: at most 4 calls, the departure window cut into parts, nights or a return window passed through) and lists the cheapest real round trip per day pair. Only when no such source answers does the page price every day via `/api/flex` and add up one-way fares (`RangeResults.tsx`). Choosing a pair runs the exact search. Nearby airports are not used in this mode.
  - Meet-up and "meet on the way": up to 7 days per window. The API takes `departUntil`, `returnUntil`, `minNights`, `maxNights`; each route is fetched once per day and the planner runs per day pair, so every plan carries its own `departDate`/`returnDate`. With a range the hub search tries half as many hubs.
  - Anywhere: up to 7 days per window, passed to Kiwi as one call (`departureDateTo`, `returnDateTo`, `nights_in_dst_from/to`); results outside the range are dropped.
- **Anywhere from several airports** — up to 4 departure airports (`origins` in `/api/explore`, `also=` in links); results are pooled per destination city, and none of the departure cities is offered as a destination. Each card shows the airport it flies from, and "All flights" opens the search from that airport (and, for a range, on that card's dates).
- **Cheapest weekends** — pick which weekend formats suit you (Sat–Sun, Fri–Sun, Sat–Mon, Fri–Mon, Thu–Sun) and how many weeks ahead; the site prices every day those formats need via `/api/flex`, pairs outbound and return fares and lists the trips cheapest first (`src/lib/flex/weekends.ts`, `CheapestWeekends.tsx`). Choosing a row runs the ordinary weekend search for those dates.
- **Nearby airports and countries** — under the search form, "also search near the origin/destination" adds the nearest large or medium airports (100/200/300 km) or the big airports of the whole country (`src/lib/data/nearby.ts`). A search sends up to 8 airport pairs (3 in cheapest weekends) and merges the results (`src/lib/multiSearch.ts`).
- **Complex route** — a fourth mode: leg 1 is the From/To fields and a date, further legs (up to 4) have their own airports and dates. Each leg is searched one-way and the cheapest chains are built with at least 3 h between legs (`src/lib/multiLeg.ts`, `MultiLegResults.tsx`); it covers fly in to one airport and home from another. Shareable via `leg=FROM.TO.DATE` links.
- **Meet-up extras** — "Meet on the way and fly on together" (`src/lib/meetup/via.ts`, `POST /api/meetup/via`): picks hubs on the way to each chosen place (big, well-connected airports or a friend's own city, `suggestHubs`), everyone flies to the hub (1.5–12 h wait), then one shared flight to the destination; the way back is tried both together via the hub and each on their own. Plan cards flag friends who share a connection (`src/lib/meetup/layover.ts`, "bonus: meet on the way") or the same flight ("travelling together").
- **Real flight data without keys** — Kiwi.com and lastminute.com (via their public MCP servers) plus a direct Ryanair connector, queried in parallel, merged across sources with price comparison, and cached. Duffel, Kiwi Tequila and Amadeus adapters are available when you have keys. A deterministic **demo provider** (`PROVIDERS=mock`) generates synthetic schedules for offline development.
- **Adults, children (2–11) and infants (under 2)** — passed to every provider, so the price reflects each fare class (children usually cheaper, infants a fraction; each infant needs an adult, max 9 travellers). Ryanair infants are estimated at a flat fee per flight.
- UI in Ukrainian and English, light/dark theme, responsive.

## Stack

TypeScript end-to-end · Next.js 16 (App Router, route handlers as the API) · React 19 · Tailwind CSS 4 · Zod · Vitest. No database required: watches live in a JSON file store (`DATA_DIR`), behind a `WatchStore` interface you can swap for Postgres/Redis.

```
src/
  app/                 pages (/, /meetup, /watches) and API routes (/api/*)
  components/          UI: search, meetup (timeline, frontier), watch, primitives
  lib/
    domain/            types, time-zone utils, weekend dates, filters & scoring
    providers/         FlightProvider interface, kiwi / amadeus / duffel / mock, aggregator + cache
    meetup/            the meetup planning engine
    watch/             watch store, checker (diff → alerts), notifiers
    api/               zod schemas
    data/airports.ts   curated airport table (IATA, city, IANA tz, coordinates)
    i18n/              uk / en dictionaries
tests/                 vitest unit tests
```

## Run

```bash
npm install
cp .env.example .env     # optional: add provider keys
npm run dev              # http://localhost:3000
```

`npm test` runs the unit tests, `npm run lint` and `npm run typecheck` do what they say, `npm run build && npm start` for production.

## Anywhere

`/explore` answers "where can I go?": pick a departure city, a weekend or any round-trip dates, and the longest flight you accept each way (for example up to 4 hours, connections included). The app asks Kiwi.com for every reachable city ("anywhere", one best option per city, four departure windows, two price pages each), applies the same ideal-weekend windows, and shows one card per destination: price from, flight time, hours on the ground, times, airlines and a photo. Sort by best, cheapest, most time there or shortest flight; filter by country; open the booking, or jump to the regular search for that city with everything prefilled. The whole query can be saved as a price watch: you get alerts on price drops and on new destinations.

API: `POST /api/explore` with `{ origin, origins?, departDate, returnDate, departUntil?, returnUntil?, minNights?, maxNights?, maxFlightHours, adults, filters }`.

## Deploy

Production: **https://remeeet.com**. Pull requests run typecheck, lint, tests and a build in GitHub Actions; every merge to `main` deploys automatically to a DigitalOcean droplet with a health check and automatic rollback. Details, secrets and server files: [`deploy/`](deploy/README.md).

## Mobile app

`mobile/` is the iOS and Android app (Flutter). It talks to the same API as the website, has the same tabs (search with flexible dates, anywhere, meetup planner, price tracking) and the Sun palette. How to run, test and build it, and what is not done yet (push notifications, incoming links, store listings) is in [`mobile/README.md`](mobile/README.md).

## Legal

© 2026 Svitlana Pavlenko (ФОП Павленко Світлана Сергіївна). All rights reserved, see [`LICENSE`](LICENSE). The Privacy Policy (`/privacy`) and Terms of Use (`/terms`) live in [`content/legal`](content/legal) as Markdown (Ukrainian and English), with the company details in `company.json`; what to fill in before publishing, the assumptions made and the open product issues are in [`docs/legal`](docs/legal/README.md).

## Help pages and the question form

`/how-it-works` (steps with screenshots from `public/how/`, plus tips) and `/faq` (accordion with FAQ structured data, plus a question form) are written in Ukrainian and English in [`src/content/howto.ts`](src/content/howto.ts). `/sitemap.xml` and `/robots.txt` are generated (`APP_URL` sets the host). To refresh a screenshot, capture it from a dev server with `PROVIDERS=mock` in the light theme and replace the file in `public/how/`.

The form posts to `POST /api/feedback` and the message is delivered to a Telegram chat; nothing is stored on the server. It needs `FEEDBACK_CHAT_ID` (the numeric id of the chat or group that should receive questions) and a bot token: `FEEDBACK_BOT_TOKEN`, or the existing `TELEGRAM_BOT_TOKEN`. The bot must be able to write to that chat (for a group, add it as a member or admin). Without them the form answers "service unavailable". Protection: a hidden honeypot field, 3 messages per 10 minutes per address and 100 per day overall, and a Cloudflare Turnstile check (`NEXT_PUBLIC_TURNSTILE_SITE_KEY` GitHub variable, `TURNSTILE_SECRET_KEY` in `/etc/remeeet.env`; skipped when the secret is unset).

**Error alerts.** The same bot and chat also receive critical server errors (an API request that failed with 500, a tracker check or scheduler tick that threw, a Telegram update the bot could not handle), in production only (`ERROR_REPORTS=1` forces it elsewhere, `ERROR_REPORTS=0` turns it off). Messages carry the place, the error text and the top of the stack, with tokens, keys, e-mail addresses and long opaque strings redacted; the same error is sent at most once per 15 minutes and at most 20 per hour. See `src/lib/errorReport.ts`.

## SEO

Every page sets its own bilingual `title`/`description` and canonical address in its `page.tsx`. Next.js replaces (does not merge) `openGraph` and `alternates` of the layout, so a page that sets them must repeat what it needs. The home page adds `Organization`, `WebSite` and `WebApplication` JSON-LD. The link preview (1200×630) is drawn in code by `src/app/opengraph-image.tsx`. After a deploy, submit `https://remeeet.com/sitemap.xml` in Google Search Console. Wordmark colours come from the logo variables (`--lm-*`), so mark and text always match in both themes.

## Analytics and ads

Google Analytics 4 and Google AdSense are optional and **off until the visitor presses "Accept"** in the consent banner: nothing from Google is requested before that, and the choice can be changed any time via "Cookie settings" in the footer. With no ids configured no banner is shown and nothing loads.

The ids are inlined by `next build`, so they are **GitHub Actions variables** (Settings > Secrets and variables > Actions > Variables), not entries in `/etc/remeeet.env`: `NEXT_PUBLIC_GA_ID` (`G-XXXXXXXXXX`), `NEXT_PUBLIC_GTM_ID` (`GTM-XXXXXXX`, a Tag Manager container: when set it replaces the direct GA tag, so GA is configured inside the container; it loads only after "Accept" with Consent Mode defaults denied), `NEXT_PUBLIC_ADSENSE_CLIENT` (`ca-pub-…`), `NEXT_PUBLIC_ADSENSE_SLOT` (ad unit id). `/ads.txt` and the `<meta name="google-adsense-account">` tag (both verify site ownership in AdSense without loading any Google script) are generated from the AdSense client id. Events sent after consent: `search` (flights, explore, meetup), `watch_created`, `booking_click`. The ad block sits under the results on the search and Anywhere pages and is labelled as an ad. The Privacy Policy (section on cookies and recipients) describes this.

Not covered: AdSense for visitors from the EEA, the UK and Switzerland requires a Google-certified consent platform (TCF); this banner alone is not one. Configure Google's own "Privacy & messaging" consent message in AdSense before relying on ad revenue there.

## Colour schemes

The current look is the *Sun* palette (slate neutrals, sunny yellow accent). All the candidates we compared, with hex codes, comparison pages and a preview tool, are archived in [`docs/palettes`](docs/palettes/README.md).

## Flight sources

Out of the box the app queries three sources in parallel, with **no API keys**:

| Source | Id | What it covers | How |
|---|---|---|---|
| Kiwi.com | `kiwi` | Hundreds of airlines, incl. Ryanair, Wizz Air, easyJet, Vueling, LOT, Lufthansa group, Air France-KLM, and Kiwi's self-transfer combinations | Kiwi.com's public MCP server, `https://mcp.kiwi.com` |
| lastminute.com | `lastminute` | Full-service and low-cost airlines; a second price for the same flights | lastminute.com's official public MCP server, `https://mcp.lastminute.com/mcp` |
| Ryanair | `ryanair` | Every Ryanair-group flight (FR, RK, AL…) directly from the airline | Ryanair's public fare-finder endpoint |

Results are merged: the same trip from several sources becomes one card with the cheapest price, the most detailed flight description (flight numbers, connection airports) and the other sources' prices for comparison. Above the results, an airline filter lists every operating carrier found.

Each MCP source returns at most 15–20 itineraries per call, so the connector splits the day into departure-time windows and queries them in parallel. Ryanair's fare finder returns only the cheapest flight in a time window, so the connector splits the window around every flight it finds until the whole day is listed (about 2n+1 requests for n flights).

Optional sources that need keys:

| Source | Id | Variables | Status (Nov 2026) |
|---|---|---|---|
| Duffel | `duffel` | `DUFFEL_ACCESS_TOKEN` | Open sign-up; test tokens only return the fictional "Duffel Airways", live tokens need account verification |
| Kiwi.com Tequila | `kiwi-tequila` | `KIWI_API_KEY` | Invite-only since 2024 |
| Amadeus | `amadeus` | `AMADEUS_CLIENT_ID`, `AMADEUS_CLIENT_SECRET` | Self-Service portal closed on 17 July 2026; Enterprise contracts only |

`PROVIDERS=kiwi,ryanair` restricts the set; `PROVIDERS=mock` forces demo data; `INCLUDE_DEMO=1` adds demo data next to real results. Each no-key source can be turned off with `KIWI_MCP_ENABLED=0`, `LASTMINUTE_MCP_ENABLED=0`, `RYANAIR_ENABLED=0`.

Adding another source = one file implementing `FlightProvider` (`search(req) → Itinerary[]`) and one line in `providers/registry.ts`.

**Terms of use.** The Kiwi.com and lastminute.com MCP servers are published for AI assistants, and Ryanair's terms restrict automated use of its website by third parties. Fine for personal use and prototyping; for a public or commercial product, agree terms with each company (or use Duffel/partner APIs). Requests are cached for 5 minutes (explore: 10) and throttled.

**Behind a proxy.** Node's built-in `fetch` ignores `HTTPS_PROXY` unless started with `NODE_USE_ENV_PROXY=1` (Node ≥ 22.21).

## Price tracking

Watches are checked either by the in-process scheduler (`WATCH_POLL_MINUTES=30`) or by an external cron hitting `GET|POST /api/watches/check` (protect with `CRON_SECRET`, send `Authorization: Bearer …`; in production the endpoint returns 503 until the secret is set). Example Vercel cron in `vercel.json`:

```json
{ "crons": [{ "path": "/api/watches/check", "schedule": "*/30 * * * *" }] }
```

**Who can see a tracker.** There are no accounts. Creating a tracker issues a secret owner token: the website keeps it in an httpOnly cookie (`remeeet_owner`), the mobile app sends it as `Authorization: Bearer <token>` (32+ URL-safe characters it generates itself). Only its SHA-256 is stored. `GET /api/watches` returns just the caller's trackers, and every other call on someone else's tracker answers 404. **Opening trackers in another browser or on another device.** The cookie is per browser (a second Chrome profile counts as another browser). In the bot, "Open on the website" under a tracker (or `/site`) sends a button with a link `/watches/claim?c=<token>`: signed with `TELEGRAM_WEBHOOK_SECRET` (HMAC), carrying the chat id, valid for 10 minutes and usable once (used nonces are kept in memory). Opening it adds the browser's key to `ownerHashes` of every tracker connected (verified) to that chat and sets the cookie, then redirects to `/watches?claim=ok`. After deploying, run `npm run telegram:webhook` once more so the `/site` command appears in the bot menu.

Trackers created before this change have no owner and are not reachable through the API (the Telegram bot and the scheduler still use them).

Notifications: per watch, a webhook URL (JSON `{ text, label, alerts }`) and/or Telegram. Webhooks must be public http(s) addresses: localhost, private ranges and cloud-metadata addresses are rejected, and redirects are not followed. A check where a data source failed raises no alerts and keeps the previous baseline.

**API errors.** Every error response is `{ error, code }` (plus `issues` for validation); the UI maps `code` to localized text in `errors` of the i18n dictionaries and never shows server messages.

### Telegram bot

Users follow their trackers in Telegram: alerts arrive as messages (in the language of the chat), and `/list` shows their trackers with buttons to check now, pause/resume and delete.

1. Create a bot with @BotFather and put the token in `.env.local` as `TELEGRAM_BOT_TOKEN`.
2. **Local development:** use a **separate bot** (create a second one in @BotFather), put its token in `.env.local` and set `TELEGRAM_MODE=polling` (long polling, no public URL needed), then run `npm run dev`. Polling deletes the bot's webhook, so sharing a bot with production silences production: the poller therefore refuses to start when the bot has a webhook (set `TELEGRAM_POLLING_TAKEOVER=1` only if you really mean to take it over, then register the webhook again with `npm run telegram:webhook`). Run only one poller per bot.
3. **Production:** set `TELEGRAM_WEBHOOK_SECRET` (16+ chars of `A-Za-z0-9_-`), deploy, then register the webhook: `npm run telegram:webhook -- https://your.domain`. The endpoint `/api/telegram/webhook` stays closed (503) until the secret is set and rejects requests without it. Optional `APP_URL` adds an "open on the website" button.
4. In the app, open **Price tracking → Connect Telegram** on a tracker and press *Start* in the bot. The link is one-time and valid for 15 minutes.

The chat id is the user's identity in the bot, and only chats that linked through that one-time link can see or change a tracker. A chat id typed by hand still receives alerts but gets no bot access. The web API itself has no user accounts yet: anyone who can reach the server can list trackers and request a link for any of them, so put the app behind authentication before exposing it publicly.

## API

| Route | Body / params | Returns |
|---|---|---|
| `POST /api/search` | `SearchRequest` (origin, destination, departDate, returnDate?, adults, cabin, currency, filters) | ranked itineraries + per-provider status |
| `POST /api/explore` | `ExploreRequest` (origin, dates, maxFlightHours, filters) | destinations grouped by city with best and cheapest option |
| `POST /api/meetup` | `MeetupRequest` (friends[], destinations[], dates, valuePerHour, filters…) | ranked plans, Pareto frontier, unreachable friends |
| `POST /api/meetup/via` | same as `/api/meetup` | "meet on the way" plans: hub, shared flight, way back |
| `POST /api/flex` | origin, destination, date, direction | cheapest one-way fare that day |
| `POST /api/range` | origin, destination, departDate, departUntil, returnDate?, returnUntil?, minNights?, maxNights? | cheapest trip per day pair over the range (`supported: false` when no source can search ranges) |
| `POST /api/human` | `{ token }` (Turnstile) | sets the `remeeet_human` cookie (1 h) |
| `GET /api/airports?q=` | query | airports |

**Load on the flight sources** (`src/lib/providers/gate.ts`). Every upstream service (Kiwi, lastminute, Ryanair) has one gate shared by all visitors: at most N requests at once and M per minute (Kiwi 8 / 120, lastminute 6 / 90, Ryanair 4 / 120; override with `KIWI_CONCURRENCY`, `KIWI_PER_MINUTE`, `LASTMINUTE_PER_MINUTE`, `RYANAIR_PER_MINUTE`…). A request waits up to 20 s for a slot, then that source is reported as failed for this search. After a 429, or 5 failures in a row, the source is paused for 30 s (doubling up to 5 min) and requests to it fail at once. Once a minute the server logs `[upstream] minute {…}` with calls, errors, throttled and paused requests per source, and `[upstream] day …` with the daily totals (`journalctl -u remeeet | grep upstream`). Price grids, cheapest weekends and ranged meet-ups ask for `quick` searches: Kiwi and lastminute answer them with one price-sorted call per day instead of four departure-time windows.

**Bot protection of search** (`src/lib/api/guard.ts`). The search endpoints (`search`, `flex`, `explore`, `meetup`, `meetup/via`) need the signed `remeeet_human` cookie when `TURNSTILE_SECRET_KEY` is set; without it they answer `403 human_check`, and the browser (`src/lib/humanCheck.ts`, called from `api()` in `src/lib/client.ts`) runs an invisible Turnstile check, exchanges the token at `/api/human` and repeats the request (a small box appears only if Cloudflare wants a click). Each address also has a budget of search points, kept in memory: 600 per 10 minutes and 4000 per day (search 4, flex day 1, range 4, explore 10 per departure airport, meetup 1 per friend airport × place × searched day, via 30 per place for every 4 searched days); over it the answer is `429 search_limit` with `Retry-After`. The price tracker and the bot call the search code directly and are not limited. `robots.txt` keeps crawlers off `/api/` and any URL with a query (share links). Locally, Cloudflare's test keys (`1x00000000000000000000AA` / `1x0000000000000000000000000000000AA`, or site key `3x00000000000000000000FF` to force the click) exercise the whole flow.
| `GET/POST /api/watches`, `GET/PATCH/DELETE /api/watches/:id`, `POST /api/watches/:id/check`, `GET/POST /api/watches/check` | | watch CRUD, manual and scheduled checks |

## How the meetup engine works

Time together = `min(return departures) − max(arrivals)`. For a fixed pair of probe times *(T_start, T_end)*, every friend independently takes the cheapest outbound arriving ≤ T_start and the cheapest return departing ≥ T_end, so the problem decomposes: candidate T values are just the actual arrival/departure times in the data, prefix/suffix minima make each lookup O(log n), and the objective `hours × valuePerHour − total price` is evaluated exactly over all pairs. Results are de-duplicated, ranked, and the Pareto frontier (more time ↔ less money) is surfaced so the user can slide between "cheapest" and "longest".

Airports: a curated core list plus about 3,700 imported airports (OurAirports, Wikidata); see [docs/airports.md](docs/airports.md).
