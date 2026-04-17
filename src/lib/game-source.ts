import { load } from "cheerio";

export type GameItem = {
  title: string;
  url: string;
  releaseDate: string;
  heat: number;
  platforms: string[];
  coverUrl: string;
};

type DraftGame = {
  title: string;
  url: string;
  releaseDate: string;
  heat: number;
  platforms: Set<string>;
  coverUrl: string;
};

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const SOURCE_WEB = "https://www.gamersky.com";
const SOURCE_RELEASE = "https://ku.gamersky.com";
const PLATFORM_CONFIG = [
  { key: "pc", label: "PC" },
  { key: "ps5", label: "PS5" },
  { key: "switch", label: "Switch" },
] as const;
const HEAT_THRESHOLD = 4000;

function getMonthKeys(months = 12): string[] {
  const now = new Date();
  const keys: string[] = [];

  for (let i = 0; i < months; i += 1) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    keys.push(`${year}${month}`);
  }

  return keys;
}

function normalizeUrl(url: string): string {
  if (!url) return "";
  if (url.startsWith("//")) return `https:${url}`;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("/")) return `${SOURCE_WEB}${url}`;
  return `${SOURCE_WEB}/${url}`;
}

function parseExactDate(rawDate: string): string | null {
  const raw = rawDate.replace("(EA)", "").trim();

  const ymd = raw.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (ymd) {
    const [, y, m, d] = ymd;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  const chineseYmd = raw.match(/(\d{4})年(\d{1,2})月(\d{1,2})日?/);
  if (chineseYmd) {
    const [, y, m, d] = chineseYmd;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  return null;
}

function isWithinNextYear(dateText: string): boolean {
  const target = new Date(`${dateText}T00:00:00+08:00`);
  if (Number.isNaN(target.getTime())) return false;

  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + 365);

  return target >= start && target <= end;
}

function comparePlatforms(a: string, b: string): number {
  const order: Record<string, number> = { PC: 1, PS5: 2, Switch: 3 };
  return (order[a] ?? 99) - (order[b] ?? 99);
}

async function scrapeOne(url: string, platformLabel: string): Promise<DraftGame[]> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Referer: `${SOURCE_RELEASE}/`,
    },
    cache: "no-store",
  });

  if (!response.ok) return [];
  const html = await response.text();
  const $ = load(html);
  const rows: DraftGame[] = [];

  $("li.lx1").each((_, li) => {
    const titleNode = $(li).find(".tit a").first();
    const title = titleNode.text().trim();
    const urlValue = normalizeUrl(titleNode.attr("href") ?? "");

    const dateLine =
      $(li)
        .find(".txt")
        .toArray()
        .map((n) => $(n).text().trim())
        .find((v) => v.startsWith("发行日期：")) ?? "";

    const releaseDate = parseExactDate(dateLine.replace("发行日期：", "").trim());

    const cover = normalizeUrl(
      $(li).find(".img img").first().attr("src") ?? $(li).find(".img img").first().attr("data-src") ?? "",
    );

    const ratingRaw = $(li).find(".more a[data-ratingtotal]").first().attr("data-ratingtotal") ?? "0";
    const heat = Number.parseInt(ratingRaw, 10) || 0;

    if (!title || !urlValue || !releaseDate) return;

    rows.push({
      title,
      url: urlValue,
      releaseDate,
      heat,
      platforms: new Set([platformLabel]),
      coverUrl: cover,
    });
  });

  return rows;
}

export async function fetchHotUpcomingGames(): Promise<GameItem[]> {
  const monthKeys = getMonthKeys(12);
  const merged = new Map<string, DraftGame>();

  for (const monthKey of monthKeys) {
    for (const platform of PLATFORM_CONFIG) {
      const url = `${SOURCE_RELEASE}/release/${platform.key}_${monthKey}/`;

      let items: DraftGame[] = [];
      try {
        items = await scrapeOne(url, platform.label);
      } catch {
        items = [];
      }

      for (const item of items) {
        const key = item.url || `${item.title}-${item.releaseDate}`;
        const existing = merged.get(key);

        if (!existing) {
          merged.set(key, item);
          continue;
        }

        existing.platforms.add(platform.label);
        if (item.heat > existing.heat) existing.heat = item.heat;
        if (!existing.coverUrl && item.coverUrl) existing.coverUrl = item.coverUrl;
      }
    }
  }

  return Array.from(merged.values())
    .filter((item) => item.heat > HEAT_THRESHOLD)
    .filter((item) => isWithinNextYear(item.releaseDate))
    .sort((a, b) => {
      if (a.releaseDate !== b.releaseDate) {
        return a.releaseDate.localeCompare(b.releaseDate);
      }
      return b.heat - a.heat;
    })
    .map((item) => ({
      title: item.title,
      url: item.url,
      releaseDate: item.releaseDate,
      heat: item.heat,
      platforms: Array.from(item.platforms).sort(comparePlatforms),
      coverUrl: item.coverUrl,
    }));
}
