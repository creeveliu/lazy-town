import { NextRequest } from "next/server";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const SOURCE_WEB = "https://www.gamersky.com";

const ALLOWED_HOSTS = new Set([
  "imgs.gamersky.com",
  "image.gamersky.com",
  "www.gamersky.com",
]);

function isAllowed(url: URL): boolean {
  return ALLOWED_HOSTS.has(url.hostname);
}

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("url") ?? "";
  if (!raw) {
    return new Response("missing url", { status: 400 });
  }

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return new Response("invalid url", { status: 400 });
  }

  if (!isAllowed(target)) {
    return new Response("forbidden host", { status: 403 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(target.toString(), {
      headers: {
        "User-Agent": USER_AGENT,
        Referer: `${SOURCE_WEB}/`,
      },
      cache: "no-store",
    });
  } catch {
    return new Response("upstream fetch failed", { status: 502 });
  }

  if (!upstream.ok || !upstream.body) {
    return new Response("upstream not ok", { status: 502 });
  }

  const contentType = upstream.headers.get("content-type") ?? "image/jpeg";
  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
