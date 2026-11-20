/** Cloudflare Turnstile: server-side check of the token the widget puts into the form. */
const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** Without a secret key (local development) the check is skipped. */
export function turnstileEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.TURNSTILE_SECRET_KEY?.trim());
}

export async function verifyTurnstile(token: string | undefined, ip: string | undefined, env: NodeJS.ProcessEnv = process.env, doFetch: typeof fetch = fetch): Promise<boolean> {
  const secret = env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret) return true;
  if (!token || token.length > 2048) return false;
  const body = new URLSearchParams({ secret, response: token });
  if (ip && ip !== "unknown") body.set("remoteip", ip);
  try {
    const res = await doFetch(VERIFY_URL, { method: "POST", body, signal: AbortSignal.timeout(5000) });
    if (!res.ok) return false;
    return ((await res.json()) as { success?: boolean }).success === true;
  } catch {
    return false;
  }
}
