import { NextResponse } from "next/server";
import { claimSecret, consumeClaim, verifyClaimToken } from "@/lib/telegram/claim";
import { ownedBy } from "@/lib/telegram/bot";
import { newOwnerToken, ownerToken, ownsWatch, setOwnerCookie, withOwner } from "@/lib/watch/owner";
import { watchStore } from "@/lib/watch/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const back = (state: "ok" | "bad") =>
  new NextResponse(null, { status: 303, headers: { location: `/watches?claim=${state}`, "cache-control": "no-store", "referrer-policy": "no-referrer" } });

/**
 * Target of the "Open on the website" button in the bot. A valid, unused link gives this browser access to every tracker that is
 * connected to the Telegram chat the link was made for. The link is not shown in the message text (only on a button), so link
 * previews do not use it up.
 */
export async function GET(req: Request) {
  const secret = claimSecret();
  const claim = secret ? verifyClaimToken(new URL(req.url).searchParams.get("c") ?? "", secret) : null;
  if (!claim || !consumeClaim(claim.nonce)) return back("bad");
  const store = watchStore();
  const mine = (await store.list()).filter((w) => ownedBy(w, claim.chatId));
  if (!mine.length) return back("bad");
  const token = ownerToken(req) ?? newOwnerToken();
  for (const w of mine) if (!ownsWatch(w, token)) await store.update(w.id, withOwner(w, token));
  return setOwnerCookie(back("ok"), token);
}
