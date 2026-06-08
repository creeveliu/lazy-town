import { NextRequest } from "next/server";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const SOURCE_WEB = "https://www.gamersky.com";

const ALLOWED_HOSTS = new Set([
  "imgs.gamersky.com",
  "image.gamersky.com",
  "www.gamersky.com",
  "img.wmdb.tv",
  "image.tmdb.org",
  "images.justwatch.com",
]);

const ALLOWED_HOST_SUFFIXES = [
  ".doubanio.com",
  ".alicdn.com",
  ".ykimg.com",
  ".iqiyipic.com",
  ".qpic.cn",
  ".hdslb.com",
];

function isAllowed(url: URL): boolean {
  return ALLOWED_HOSTS.has(url.hostname) || ALLOWED_HOST_SUFFIXES.some((suffix) => url.hostname.endsWith(suffix));
}

function buildReferer(target: URL, rawRef: string): string {
  if (target.hostname.endsWith("doubanio.com")) {
    if (!rawRef) return "https://movie.douban.com/";

    try {
      const ref = new URL(rawRef);
      if (ref.hostname === "movie.douban.com") return ref.toString();
    } catch {
      return "https://movie.douban.com/";
    }

    return "https://movie.douban.com/";
  }

  if (target.hostname === "img.wmdb.tv") {
    return "https://api.wmdb.tv/";
  }

  if (target.hostname === "image.tmdb.org") {
    return "https://www.themoviedb.org/";
  }

  if (target.hostname === "images.justwatch.com") {
    return "https://www.justwatch.com/";
  }

  if (target.hostname.endsWith("alicdn.com") || target.hostname.endsWith("ykimg.com")) {
    return "https://www.youku.com/";
  }

  if (target.hostname.endsWith("iqiyipic.com")) {
    return "https://www.iqiyi.com/";
  }

  if (target.hostname.endsWith("qpic.cn")) {
    return "https://v.qq.com/";
  }

  if (target.hostname.endsWith("hdslb.com")) {
    return "https://www.bilibili.com/";
  }

  return `${SOURCE_WEB}/`;
}

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("url") ?? "";
  const rawRef = req.nextUrl.searchParams.get("ref") ?? "";
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
        Referer: buildReferer(target, rawRef),
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
