// AdSense requires /ads.txt at the site root. The publisher id comes from the same build variable as the ad script.
export const dynamic = "force-static";

export function GET() {
  const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT ?? "";
  if (!/^ca-pub-\d+$/.test(client)) return new Response("Not found", { status: 404 });
  return new Response(`google.com, ${client.replace("ca-", "")}, DIRECT, f08c47fec0942fa0\n`, { headers: { "content-type": "text/plain; charset=utf-8" } });
}
