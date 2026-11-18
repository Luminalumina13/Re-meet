/** The `other` metadata for AdSense site verification, or nothing when the client id is missing or malformed. */
export function adsenseMeta(client: string | undefined): { other?: Record<string, string> } {
  return client && /^ca-pub-\d+$/.test(client) ? { other: { "google-adsense-account": client } } : {};
}
