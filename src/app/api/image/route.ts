import { NextRequest } from "next/server";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const SOURCE_WEB = "https://www.gamersky.com";

const ALLOWED_HOSTS = new Set([
  "imgs.gamersky.com",
  "image.gamersky.com",
  "www.gamersky.com",
  "img1.doubanio.com",
  "img2.doubanio.com",
  "img3.doubanio.com",
  "img9.doubanio.com",
  "img.wmdb.tv",
  "image.tmdb.org",
  "liangcang-material.alicdn.com",
  "m.ykimg.com",
  "pic1.iqiyipic.com",
  "pic2.iqiyipic.com",
  "pic3.iqiyipic.com",
  "pic4.iqiyipic.com",
  "pic5.iqiyipic.com",
  "pic6.iqiyipic.com",
  "pic7.iqiyipic.com",
  "pic8.iqiyipic.com",
  "pic9.iqiyipic.com",
  "puui.qpic.cn",
  "tv.puui.qpic.cn",
  "vmmp.qpic.cn",
  "vcover-hz-pic.puui.qpic.cn",
  "gif.media.qpic.cn",
  "images.justwatch.com",
]);

function isAllowed(url: URL): boolean {
  return ALLOWED_HOSTS.has(url.hostname);
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
