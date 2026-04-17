import { NextRequest } from "next/server";
import { syncGamesToDb } from "@/lib/db";

export const runtime = "nodejs";

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;

  const auth = req.headers.get("authorization") ?? "";
  if (auth === `Bearer ${secret}`) return true;

  const querySecret = req.nextUrl.searchParams.get("secret") ?? "";
  return querySecret === secret;
}

async function handle(req: NextRequest) {
  if (!isAuthorized(req)) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await syncGamesToDb();
    return Response.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
