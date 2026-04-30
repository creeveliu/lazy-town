import { load } from "cheerio";

export type OnlineMovieItem = {
  title: string;
  url: string;
  onlineDate: string;
  platforms: string[];
  sourceName: string;
  status: string;
  reservationCount: number;
  confidence: number;
  coverUrl: string;
};

type DraftOnlineMovie = OnlineMovieItem;

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const YOUKU_MOVIE_URL = "https://www.youku.com/ku/webmovie";
const IQIYI_NEW_ONLINE_URL =
  "https://www.iqiyi.com/newOnlinePCW?deviceId=9abd3d88d08f1d65da7036e973c139bd&v=12.112.20682";
const TENCENT_MOVIE_URL = "https://v.qq.com/channel/movie";
const RESERVATION_THRESHOLD = 5000;

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeUrl(url: string, base: string): string {
  if (!url) return "";
  if (url.startsWith("//")) return `https:${url}`;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("/")) return `${base}${url}`;
  return `${base}/${url}`;
}

function formatDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function parseOnlineDate(raw: string): string | null {
  const value = normalizeText(raw);
  const now = new Date();

  if (value.includes("今天")) {
    return formatDate(now);
  }

  if (value.includes("明天")) {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return formatDate(tomorrow);
  }

  const ymd = value.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (ymd) {
    const [, y, m, d] = ymd;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  const chineseYmd = value.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (chineseYmd) {
    const [, y, m, d] = chineseYmd;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  const monthDay = value.match(/(\d{1,2})月(\d{1,2})日/);
  if (!monthDay) return null;

  const [, m, d] = monthDay;
  const target = new Date(now.getFullYear(), Number.parseInt(m, 10) - 1, Number.parseInt(d, 10));
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (target < today) target.setFullYear(target.getFullYear() + 1);
  return formatDate(target);
}

function parseReservationCount(raw: string): number {
  const value = normalizeText(raw).replace(/,/g, "");
  const match = value.match(/(\d+(?:\.\d+)?)\s*万?人?(?:已)?预约/);
  if (!match) return 0;

  const count = Number.parseFloat(match[1]);
  if (!Number.isFinite(count)) return 0;
  return value.includes("万") ? Math.round(count * 10000) : Math.round(count);
}

function isLikelyMovie(title: string, actors = ""): boolean {
  const text = `${title} ${actors}`;
  if (/纪录|剧集|电视剧|综艺|动漫|漫剧|少儿|体育|课程/.test(text)) return false;
  return true;
}

async function fetchHtml(url: string, referer?: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      ...(referer ? { Referer: referer } : {}),
    },
    cache: "no-store",
  });

  if (!response.ok) return "";
  return response.text();
}

async function fetchYoukuOnlineMovies(): Promise<DraftOnlineMovie[]> {
  const html = await fetchHtml(YOUKU_MOVIE_URL, "https://www.youku.com/");
  if (!html) return [];

  const $ = load(html);
  const rows: DraftOnlineMovie[] = [];

  $('div[class^="pack_title"], div[class*=" pack_title"]').each((_, el) => {
    const title = normalizeText($(el).text());
    const link = $(el).closest("a");
    const container = link.parent().parent();
    const status = normalizeText(container.find('div[class^="subtitle"], div[class*=" subtitle"]').first().text());
    const onlineDate = parseOnlineDate(status);
    const reservationCount = parseReservationCount(container.text());

    if (!title || !onlineDate || status.includes("敬请期待") || reservationCount < RESERVATION_THRESHOLD) return;

    rows.push({
      title,
      url: normalizeUrl(link.attr("href") ?? "", "https://v.youku.com"),
      onlineDate,
      platforms: ["优酷"],
      sourceName: "优酷电影",
      status: "上线",
      reservationCount,
      confidence: 90,
      coverUrl: normalizeUrl(link.find("img").first().attr("src") ?? "", "https://www.youku.com"),
    });
  });

  return rows;
}

async function fetchIqiyiOnlineMovies(): Promise<DraftOnlineMovie[]> {
  const html = await fetchHtml(IQIYI_NEW_ONLINE_URL, "https://www.iqiyi.com/");
  if (!html) return [];

  const $ = load(html);
  const rows: DraftOnlineMovie[] = [];

  $("a.vp__thumb__inner").each((_, el) => {
    const link = $(el);
    const title = normalizeText(link.find(".vp__thumb__title").first().text());
    const subs = link
      .find(".vp__thumb__sub")
      .toArray()
      .map((node) => normalizeText($(node).text()));
    const status = subs.find((item) => item.includes("上线")) ?? "";
    const actors = link
      .find(".vp__thumb__actorli")
      .toArray()
      .map((node) => normalizeText($(node).text()))
      .join("");
    const onlineDate = parseOnlineDate(status);
    const reservationCount = parseReservationCount(link.text());

    if (!title || !onlineDate || reservationCount < RESERVATION_THRESHOLD) return;
    if (!actors || !isLikelyMovie(title, actors)) return;

    rows.push({
      title,
      url: normalizeUrl(link.attr("href") ?? "", "https://www.iqiyi.com"),
      onlineDate,
      platforms: ["爱奇艺"],
      sourceName: "爱奇艺新片速递",
      status: "上线",
      reservationCount,
      confidence: 75,
      coverUrl: normalizeUrl(link.find("img.i71-img").first().attr("src") ?? "", "https://www.iqiyi.com"),
    });
  });

  return rows;
}

function extractTencentComingBlock(html: string): string {
  const tabIndex = html.indexOf('tab_type:"coming_soon"');
  if (tabIndex < 0) return "";
  return html.slice(tabIndex, tabIndex + 80_000);
}

async function fetchTencentOnlineMovies(): Promise<DraftOnlineMovie[]> {
  const html = await fetchHtml(TENCENT_MOVIE_URL, "https://v.qq.com/");
  if (!html) return [];

  const rows: DraftOnlineMovie[] = [];
  const block = extractTencentComingBlock(html);
  const itemPattern =
    /{id:"([^"]+)"[\s\S]*?title:"([^"]+)"[\s\S]*?subTitle:"([^"]*)"[\s\S]*?coverPic:"([^"]*)"[\s\S]*?onlineTimeInfo:"([^"]*)"[\s\S]*?orderPersonCount:(\d+)/g;
  let match: RegExpExecArray | null;

  while ((match = itemPattern.exec(block))) {
    const [, id, rawTitle, subTitle, coverUrl, onlineTimeInfo, rawReservationCount] = match;
    const title = normalizeText(rawTitle.replace(/·首播|·热播|·会员免费看/g, ""));
    const dateSource = onlineTimeInfo || subTitle;
    const onlineDate = parseOnlineDate(dateSource);
    const reservationCount = Number.parseInt(rawReservationCount, 10) || 0;

    if (!title || !onlineDate || reservationCount < RESERVATION_THRESHOLD) continue;

    rows.push({
      title,
      url: `https://v.qq.com/x/cover/${id}.html`,
      onlineDate,
      platforms: ["腾讯视频"],
      sourceName: "腾讯视频电影",
      status: "上线",
      reservationCount,
      confidence: 65,
      coverUrl: normalizeUrl(coverUrl, "https://v.qq.com"),
    });
  }

  return rows;
}

function mergeRows(rows: DraftOnlineMovie[]): OnlineMovieItem[] {
  const merged = new Map<string, DraftOnlineMovie>();

  for (const row of rows) {
    const key = `${row.title}-${row.onlineDate}`;
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, { ...row, platforms: [...row.platforms] });
      continue;
    }

    for (const platform of row.platforms) {
      if (!existing.platforms.includes(platform)) existing.platforms.push(platform);
    }

    if (row.reservationCount > existing.reservationCount) existing.reservationCount = row.reservationCount;
    if (row.confidence > existing.confidence) {
      existing.sourceName = row.sourceName;
      existing.url = row.url;
      existing.confidence = row.confidence;
      if (row.coverUrl) existing.coverUrl = row.coverUrl;
    }
  }

  return Array.from(merged.values()).sort((a, b) => a.onlineDate.localeCompare(b.onlineDate));
}

export async function fetchOnlineMovies(): Promise<OnlineMovieItem[]> {
  const results = await Promise.allSettled([
    fetchYoukuOnlineMovies(),
    fetchIqiyiOnlineMovies(),
    fetchTencentOnlineMovies(),
  ]);

  return mergeRows(results.flatMap((result) => (result.status === "fulfilled" ? result.value : [])));
}
