# Airports

The airport list has two parts.

- **Curated core** (`src/lib/data/airports.ts`, about 170 rows, with Ukrainian names in `airportsUk.ts`): hand-picked, the first in search results and the only ones the demo "anywhere" search may suggest together with the large imported ones.
- **Imported** (`src/lib/data/airportsExtra.ts`, about 3,700 airports, **generated, do not edit by hand**): every airport in the world with scheduled service and an IATA code that the core list does not have, except Russia, Belarus and North Korea, and new Ukrainian ones.

On the server both are always loaded. In the browser only the core ships with the page; the imported part is a separate chunk (`loadExtraAirports`, started when the page is idle and by the airport field), so the first load stays small.

## Where the data comes from

| What | Source | Licence |
| --- | --- | --- |
| IATA code, name, city, country, coordinates, size | [OurAirports](https://ourairports.com/data/) `airports.csv` (types large, medium and small, `scheduled_service = yes`) | public domain |
| Time zone | computed from the coordinates with the `tz-lookup` npm package | MIT |
| Ukrainian city names | [Wikidata](https://www.wikidata.org/) (`P238` IATA code, `P931` place served, label `uk`) | CC0 |

A Ukrainian name is attached only when Wikidata's English label agrees with the airport's city; otherwise the city stays in English (the search still finds it by its English name, code and country). Several airports of one metropolitan area share a city (for example both Tenerife airports, Tokyo Haneda and Narita); the exceptions are listed in `OVERRIDE_CITY` in `scripts/airports/generate.py`.

## Refreshing the list

1. Download `airports.csv` from OurAirports into an empty working directory.
2. `tz.json`: `{ "IATA": "Time/Zone" }` for every selected airport, computed with `tz-lookup` from its latitude and longitude.
3. `wd.json`: `[{ "iata", "en", "uk" }]` from the Wikidata SPARQL endpoint (`?a wdt:P238 ?iata . ?a wdt:P931 ?city` with the `en` and `uk` labels of `?city`), in chunks of about 400 codes.
4. `python3 scripts/airports/generate.py <workdir>` rewrites `airportsExtra.ts`. Run the tests (`npm test`) and look at the diff before committing.
