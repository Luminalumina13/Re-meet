import { beforeEach, describe, expect, it } from "vitest";
import { MemoryWatchStore, setWatchStore } from "@/lib/watch/store";
import { GET as list, POST as create } from "@/app/api/watches/route";
import { DELETE as del, GET as getOne, PATCH as patch } from "@/app/api/watches/[id]/route";
import { POST as checkOne } from "@/app/api/watches/[id]/check/route";
import { newOwnerToken } from "@/lib/watch/owner";

const body = { label: "WAW→BCN", params: { kind: "search", request: { origin: "WAW", destination: "BCN", departDate: "2026-12-05", adults: 1, cabin: "economy", currency: "EUR" } } };
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const req = (method: string, headers: Record<string, string> = {}, data?: unknown) =>
  new Request("http://x/api/watches", { method, headers: { "content-type": "application/json", ...headers }, body: data ? JSON.stringify(data) : undefined });
const bearer = (t: string) => ({ authorization: `Bearer ${t}` });

describe("watch ownership", () => {
  beforeEach(() => {
    process.env.PROVIDERS = "mock";
    setWatchStore(new MemoryWatchStore());
  });

  it("anonymous callers see nothing", async () => {
    expect(await (await list(req("GET"))).json()).toEqual([]);
  });

  it("the first create hands out an httpOnly cookie, and it unlocks the tracker", async () => {
    const res = await create(req("POST", {}, body));
    expect(res.status).toBe(201);
    const set = res.headers.get("set-cookie") ?? "";
    expect(set).toMatch(/remeeet_owner=/);
    expect(set.toLowerCase()).toContain("httponly");
    const created = await res.json();
    expect(created.ownerHash).toBeUndefined();
    const cookie = set.split(";")[0];
    expect((await (await list(req("GET", { cookie }))).json()).map((w: { id: string }) => w.id)).toEqual([created.id]);
    expect((await getOne(req("GET", { cookie }), ctx(created.id))).status).toBe(200);
  });

  it("another caller cannot read, change, delete or trigger it", async () => {
    const a = newOwnerToken();
    const created = await (await create(req("POST", bearer(a), body))).json();
    const b = bearer(newOwnerToken());
    expect(await (await list(req("GET", b))).json()).toEqual([]);
    for (const res of [
      await getOne(req("GET", b), ctx(created.id)),
      await patch(req("PATCH", b, { active: false }), ctx(created.id)),
      await del(req("DELETE", b), ctx(created.id)),
      await checkOne(req("POST", b), ctx(created.id)),
      await getOne(req("GET"), ctx(created.id)),
    ]) {
      expect(res.status).toBe(404);
    }
    // still there for the owner, and untouched
    const mine = await (await getOne(req("GET", bearer(a)), ctx(created.id))).json();
    expect(mine.active).toBe(true);
    expect((await del(req("DELETE", bearer(a)), ctx(created.id))).status).toBe(204);
  });

  it("rejects malformed tokens", async () => {
    const created = await (await create(req("POST", bearer(newOwnerToken()), body))).json();
    expect((await getOne(req("GET", bearer("short")), ctx(created.id))).status).toBe(404);
  });
});
