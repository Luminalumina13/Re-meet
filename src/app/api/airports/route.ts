import { NextResponse } from "next/server";
import { AIRPORTS, searchAirports } from "@/lib/data/airports";

export function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q") ?? "";
  const list = q ? searchAirports(q, 10) : AIRPORTS;
  return NextResponse.json(list, { headers: { "cache-control": "public, max-age=3600" } });
}
