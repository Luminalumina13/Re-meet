import type { Airport } from "@/lib/domain/types";

type Row = [iata: string, name: string, city: string, country: string, tz: string, lat: number, lon: number];

// Curated list of major airports. Extend freely; providers accept any IATA code,
// this table is used for autocomplete, time zones and distance estimates.
const ROWS: Row[] = [
  // Ukraine & neighbours
  ["KBP", "Boryspil", "Kyiv", "UA", "Europe/Kyiv", 50.345, 30.8947],
  ["IEV", "Zhuliany", "Kyiv", "UA", "Europe/Kyiv", 50.4018, 30.4519],
  ["LWO", "Danylo Halytskyi", "Lviv", "UA", "Europe/Kyiv", 49.8125, 23.9561],
  ["ODS", "Odesa International", "Odesa", "UA", "Europe/Kyiv", 46.4268, 30.6765],
  ["WAW", "Chopin", "Warsaw", "PL", "Europe/Warsaw", 52.1657, 20.9671],
  ["WMI", "Modlin", "Warsaw", "PL", "Europe/Warsaw", 52.4511, 20.6518],
  ["KRK", "John Paul II", "Kraków", "PL", "Europe/Warsaw", 50.0777, 19.7848],
  ["KTW", "Katowice", "Katowice", "PL", "Europe/Warsaw", 50.4743, 19.08],
  ["RZE", "Jasionka", "Rzeszów", "PL", "Europe/Warsaw", 50.11, 22.019],
  ["GDN", "Lech Wałęsa", "Gdańsk", "PL", "Europe/Warsaw", 54.3776, 18.4662],
  ["WRO", "Copernicus", "Wrocław", "PL", "Europe/Warsaw", 51.1027, 16.8858],
  ["POZ", "Ławica", "Poznań", "PL", "Europe/Warsaw", 52.421, 16.8263],
  ["KIV", "Chișinău", "Chișinău", "MD", "Europe/Chisinau", 46.9277, 28.931],
  ["IAS", "Iași", "Iași", "RO", "Europe/Bucharest", 47.1785, 27.6206],
  ["OTP", "Henri Coandă", "Bucharest", "RO", "Europe/Bucharest", 44.5711, 26.085],
  ["CLJ", "Avram Iancu", "Cluj-Napoca", "RO", "Europe/Bucharest", 46.7852, 23.6862],
  ["BUD", "Ferenc Liszt", "Budapest", "HU", "Europe/Budapest", 47.4298, 19.2611],
  ["KSC", "Košice", "Košice", "SK", "Europe/Bratislava", 48.6631, 21.2411],
  ["BTS", "M. R. Štefánik", "Bratislava", "SK", "Europe/Bratislava", 48.1702, 17.2127],
  ["VNO", "Vilnius", "Vilnius", "LT", "Europe/Vilnius", 54.6341, 25.2858],
  ["KUN", "Kaunas", "Kaunas", "LT", "Europe/Vilnius", 54.9639, 24.0848],
  ["RIX", "Riga", "Riga", "LV", "Europe/Riga", 56.9236, 23.9711],
  ["TLL", "Lennart Meri", "Tallinn", "EE", "Europe/Tallinn", 59.4133, 24.8328],
  // Central Europe
  ["PRG", "Václav Havel", "Prague", "CZ", "Europe/Prague", 50.1008, 14.26],
  ["VIE", "Schwechat", "Vienna", "AT", "Europe/Vienna", 48.1103, 16.5697],
  ["BER", "Brandenburg", "Berlin", "DE", "Europe/Berlin", 52.3667, 13.5033],
  ["MUC", "Franz Josef Strauss", "Munich", "DE", "Europe/Berlin", 48.3538, 11.7861],
  ["FRA", "Frankfurt", "Frankfurt", "DE", "Europe/Berlin", 50.0333, 8.5706],
  ["HAM", "Hamburg", "Hamburg", "DE", "Europe/Berlin", 53.6304, 9.9882],
  ["DUS", "Düsseldorf", "Düsseldorf", "DE", "Europe/Berlin", 51.2895, 6.7668],
  ["CGN", "Cologne Bonn", "Cologne", "DE", "Europe/Berlin", 50.8659, 7.1427],
  ["STR", "Stuttgart", "Stuttgart", "DE", "Europe/Berlin", 48.69, 9.222],
  ["LEJ", "Leipzig/Halle", "Leipzig", "DE", "Europe/Berlin", 51.4324, 12.2416],
  ["NUE", "Nuremberg", "Nuremberg", "DE", "Europe/Berlin", 49.4987, 11.0669],
  ["ZRH", "Zürich", "Zürich", "CH", "Europe/Zurich", 47.4647, 8.5492],
  ["GVA", "Geneva", "Geneva", "CH", "Europe/Zurich", 46.2381, 6.1089],
  ["BSL", "EuroAirport", "Basel", "CH", "Europe/Zurich", 47.59, 7.5291],
  ["LJU", "Jože Pučnik", "Ljubljana", "SI", "Europe/Ljubljana", 46.2237, 14.4576],
  ["ZAG", "Franjo Tuđman", "Zagreb", "HR", "Europe/Zagreb", 45.7429, 16.0688],
  ["SPU", "Split", "Split", "HR", "Europe/Zagreb", 43.5389, 16.2981],
  ["DBV", "Dubrovnik", "Dubrovnik", "HR", "Europe/Zagreb", 42.5614, 18.2682],
  ["BEG", "Nikola Tesla", "Belgrade", "RS", "Europe/Belgrade", 44.8184, 20.3091],
  ["SOF", "Sofia", "Sofia", "BG", "Europe/Sofia", 42.6952, 23.4062],
  ["VAR", "Varna", "Varna", "BG", "Europe/Sofia", 43.2321, 27.8251],
  ["TIA", "Tirana", "Tirana", "AL", "Europe/Tirane", 41.4147, 19.7206],
  ["SKP", "Skopje", "Skopje", "MK", "Europe/Skopje", 41.9616, 21.6214],
  ["TGD", "Podgorica", "Podgorica", "ME", "Europe/Podgorica", 42.3594, 19.2519],
  // Western Europe
  ["AMS", "Schiphol", "Amsterdam", "NL", "Europe/Amsterdam", 52.3086, 4.7639],
  ["EIN", "Eindhoven", "Eindhoven", "NL", "Europe/Amsterdam", 51.4501, 5.3745],
  ["BRU", "Zaventem", "Brussels", "BE", "Europe/Brussels", 50.9014, 4.4844],
  ["CRL", "Charleroi", "Brussels", "BE", "Europe/Brussels", 50.4592, 4.4538],
  ["LUX", "Findel", "Luxembourg", "LU", "Europe/Luxembourg", 49.6233, 6.2044],
  ["CDG", "Charles de Gaulle", "Paris", "FR", "Europe/Paris", 49.0097, 2.5479],
  ["ORY", "Orly", "Paris", "FR", "Europe/Paris", 48.7233, 2.3794],
  ["BVA", "Beauvais", "Paris", "FR", "Europe/Paris", 49.4544, 2.1128],
  ["LYS", "Saint-Exupéry", "Lyon", "FR", "Europe/Paris", 45.7256, 5.0811],
  ["NCE", "Côte d'Azur", "Nice", "FR", "Europe/Paris", 43.6584, 7.2159],
  ["MRS", "Provence", "Marseille", "FR", "Europe/Paris", 43.4393, 5.2214],
  ["TLS", "Blagnac", "Toulouse", "FR", "Europe/Paris", 43.629, 1.3638],
  ["BOD", "Mérignac", "Bordeaux", "FR", "Europe/Paris", 44.8283, -0.7156],
  ["NTE", "Atlantique", "Nantes", "FR", "Europe/Paris", 47.1532, -1.6107],
  ["LHR", "Heathrow", "London", "GB", "Europe/London", 51.47, -0.4543],
  ["LGW", "Gatwick", "London", "GB", "Europe/London", 51.1537, -0.1821],
  ["STN", "Stansted", "London", "GB", "Europe/London", 51.885, 0.235],
  ["LTN", "Luton", "London", "GB", "Europe/London", 51.8747, -0.3683],
  ["LCY", "City", "London", "GB", "Europe/London", 51.5053, 0.0553],
  ["MAN", "Manchester", "Manchester", "GB", "Europe/London", 53.3537, -2.275],
  ["BHX", "Birmingham", "Birmingham", "GB", "Europe/London", 52.4539, -1.748],
  ["EDI", "Edinburgh", "Edinburgh", "GB", "Europe/London", 55.95, -3.3725],
  ["GLA", "Glasgow", "Glasgow", "GB", "Europe/London", 55.8719, -4.4331],
  ["BRS", "Bristol", "Bristol", "GB", "Europe/London", 51.3827, -2.7191],
  ["DUB", "Dublin", "Dublin", "IE", "Europe/Dublin", 53.4213, -6.27],
  // Nordics
  ["CPH", "Kastrup", "Copenhagen", "DK", "Europe/Copenhagen", 55.618, 12.656],
  ["ARN", "Arlanda", "Stockholm", "SE", "Europe/Stockholm", 59.6519, 17.9186],
  ["GOT", "Landvetter", "Gothenburg", "SE", "Europe/Stockholm", 57.6628, 12.2798],
  ["OSL", "Gardermoen", "Oslo", "NO", "Europe/Oslo", 60.1939, 11.1004],
  ["BGO", "Flesland", "Bergen", "NO", "Europe/Oslo", 60.2934, 5.2181],
  ["HEL", "Vantaa", "Helsinki", "FI", "Europe/Helsinki", 60.3172, 24.9633],
  ["KEF", "Keflavík", "Reykjavík", "IS", "Atlantic/Reykjavik", 63.985, -22.6056],
  // Southern Europe
  ["MAD", "Barajas", "Madrid", "ES", "Europe/Madrid", 40.4983, -3.5676],
  ["BCN", "El Prat", "Barcelona", "ES", "Europe/Madrid", 41.2971, 2.0785],
  ["PMI", "Palma de Mallorca", "Palma", "ES", "Europe/Madrid", 39.5517, 2.7388],
  ["AGP", "Málaga", "Málaga", "ES", "Europe/Madrid", 36.6749, -4.4991],
  ["VLC", "Valencia", "Valencia", "ES", "Europe/Madrid", 39.4893, -0.4816],
  ["SVQ", "Seville", "Seville", "ES", "Europe/Madrid", 37.418, -5.8931],
  ["ALC", "Alicante", "Alicante", "ES", "Europe/Madrid", 38.2822, -0.5582],
  ["LIS", "Humberto Delgado", "Lisbon", "PT", "Europe/Lisbon", 38.7813, -9.1359],
  ["OPO", "Francisco Sá Carneiro", "Porto", "PT", "Europe/Lisbon", 41.2481, -8.6814],
  ["FAO", "Faro", "Faro", "PT", "Europe/Lisbon", 37.0144, -7.9659],
  ["FCO", "Fiumicino", "Rome", "IT", "Europe/Rome", 41.8003, 12.2389],
  ["CIA", "Ciampino", "Rome", "IT", "Europe/Rome", 41.7994, 12.5949],
  ["MXP", "Malpensa", "Milan", "IT", "Europe/Rome", 45.63, 8.7231],
  ["LIN", "Linate", "Milan", "IT", "Europe/Rome", 45.4451, 9.2767],
  ["BGY", "Orio al Serio", "Milan", "IT", "Europe/Rome", 45.6739, 9.7042],
  ["VCE", "Marco Polo", "Venice", "IT", "Europe/Rome", 45.5053, 12.3519],
  ["BLQ", "Marconi", "Bologna", "IT", "Europe/Rome", 44.5354, 11.2887],
  ["FLR", "Peretola", "Florence", "IT", "Europe/Rome", 43.81, 11.2051],
  ["NAP", "Capodichino", "Naples", "IT", "Europe/Rome", 40.886, 14.2908],
  ["CTA", "Fontanarossa", "Catania", "IT", "Europe/Rome", 37.4668, 15.0664],
  ["PMO", "Falcone Borsellino", "Palermo", "IT", "Europe/Rome", 38.176, 13.091],
  ["BRI", "Karol Wojtyła", "Bari", "IT", "Europe/Rome", 41.1389, 16.7606],
  ["ATH", "Eleftherios Venizelos", "Athens", "GR", "Europe/Athens", 37.9364, 23.9445],
  ["SKG", "Makedonia", "Thessaloniki", "GR", "Europe/Athens", 40.5197, 22.9709],
  ["HER", "Heraklion", "Heraklion", "GR", "Europe/Athens", 35.3397, 25.1803],
  ["MLA", "Malta", "Valletta", "MT", "Europe/Malta", 35.8575, 14.4775],
  ["LCA", "Larnaca", "Larnaca", "CY", "Asia/Nicosia", 34.8751, 33.6249],
  ["IST", "Istanbul", "Istanbul", "TR", "Europe/Istanbul", 41.2753, 28.7519],
  ["SAW", "Sabiha Gökçen", "Istanbul", "TR", "Europe/Istanbul", 40.8986, 29.3092],
  ["AYT", "Antalya", "Antalya", "TR", "Europe/Istanbul", 36.8987, 30.8005],
  // Caucasus & Middle East
  ["TBS", "Shota Rustaveli", "Tbilisi", "GE", "Asia/Tbilisi", 41.6692, 44.9547],
  ["EVN", "Zvartnots", "Yerevan", "AM", "Asia/Yerevan", 40.1473, 44.3959],
  ["TLV", "Ben Gurion", "Tel Aviv", "IL", "Asia/Jerusalem", 32.0114, 34.8867],
  ["DXB", "Dubai International", "Dubai", "AE", "Asia/Dubai", 25.2528, 55.3644],
  ["DOH", "Hamad", "Doha", "QA", "Asia/Qatar", 25.2731, 51.6081],
  // North America
  ["JFK", "John F. Kennedy", "New York", "US", "America/New_York", 40.6413, -73.7781],
  ["EWR", "Newark Liberty", "New York", "US", "America/New_York", 40.6895, -74.1745],
  ["BOS", "Logan", "Boston", "US", "America/New_York", 42.3656, -71.0096],
  ["ORD", "O'Hare", "Chicago", "US", "America/Chicago", 41.9742, -87.9073],
  ["MIA", "Miami", "Miami", "US", "America/New_York", 25.7959, -80.287],
  ["LAX", "Los Angeles", "Los Angeles", "US", "America/Los_Angeles", 33.9416, -118.4085],
  ["SFO", "San Francisco", "San Francisco", "US", "America/Los_Angeles", 37.6213, -122.379],
  ["YYZ", "Pearson", "Toronto", "CA", "America/Toronto", 43.6777, -79.6248],
  ["YUL", "Trudeau", "Montréal", "CA", "America/Toronto", 45.4706, -73.7408],
  ["YVR", "Vancouver", "Vancouver", "CA", "America/Vancouver", 49.1947, -123.1792],
];

export const AIRPORTS: Airport[] = ROWS.map(([iata, name, city, country, tz, lat, lon]) => ({
  iata,
  name,
  city,
  country,
  tz,
  lat,
  lon,
}));

const BY_IATA = new Map(AIRPORTS.map((a) => [a.iata, a]));

export function getAirport(iata: string): Airport | undefined {
  return BY_IATA.get(iata.toUpperCase());
}

/** Time zone for an airport, falling back to UTC for unknown codes. */
export function airportTz(iata: string): string {
  return getAirport(iata)?.tz ?? "UTC";
}

export function searchAirports(query: string, limit = 8): Airport[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const scored = AIRPORTS.map((a) => {
    let s = 0;
    if (a.iata.toLowerCase() === q) s = 100;
    else if (a.iata.toLowerCase().startsWith(q)) s = 80;
    else if (a.city.toLowerCase().startsWith(q)) s = 70;
    else if (a.city.toLowerCase().includes(q)) s = 50;
    else if (a.name.toLowerCase().includes(q)) s = 40;
    else if (a.country.toLowerCase() === q) s = 20;
    return { a, s };
  })
    .filter((x) => x.s > 0)
    .sort((x, y) => y.s - x.s || x.a.city.localeCompare(y.a.city));
  return scored.slice(0, limit).map((x) => x.a);
}

/** Great-circle distance in km. */
export function distanceKm(a: Airport, b: Airport): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
