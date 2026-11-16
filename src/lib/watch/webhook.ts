import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/** True for loopback, private, link-local (cloud metadata) and other non-public addresses. */
export function isPrivateAddress(ip: string): boolean {
  const v = ip.toLowerCase();
  if (v.startsWith("::ffff:")) return isPrivateAddress(v.slice(7));
  if (isIP(v) === 6) {
    return v === "::" || v === "::1" || /^f[cd]/.test(v) || /^fe[89ab]/.test(v);
  }
  const p = v.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n))) return true;
  const [a, b] = p;
  return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224;
}

/** Cheap, DNS-free check used when the URL is saved. */
export function isSafeWebhookSyntax(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return false;
  if (u.username || u.password) return false;
  const host = u.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal") || host.endsWith(".local")) return false;
  return isIP(host) ? !isPrivateAddress(host) : true;
}

/** Resolves the host and refuses non-public targets (also catches DNS names that point inside). */
export async function assertPublicWebhook(raw: string): Promise<void> {
  if (!isSafeWebhookSyntax(raw)) throw new Error("webhook URL is not allowed");
  const host = new URL(raw).hostname.replace(/^\[|\]$/g, "");
  if (isIP(host)) return;
  const addrs = await lookup(host, { all: true });
  if (!addrs.length || addrs.some((a) => isPrivateAddress(a.address))) throw new Error("webhook host resolves to a non-public address");
}

export async function postWebhook(url: string, payload: unknown): Promise<void> {
  await assertPublicWebhook(url);
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    redirect: "manual", // a redirect could point back inside the network
    signal: AbortSignal.timeout(10_000),
  });
  if (res.status >= 400) throw new Error(`webhook responded ${res.status}`);
}
