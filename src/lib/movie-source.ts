import { load } from "cheerio";

export type MovieItem = {
  title: string;
  url: string;
  releaseDate: string;
  wish: number;
  genres: string;
  country: string;
  coverUrl: string;
};

type DraftMovie = {
  title: string;
  url: string;
  month: number;
  day: number;
  wish: number;
  genres: string;
  country: string;
};

const SOURCE_URL = "https://movie.douban.com/coming?sequence=asc";
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const TMDB_SEARCH_URL = "https://api.themoviedb.org/3/search/movie";
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w342";
const MANUAL_COVER_MAP: Record<string, string> = {
  "https://movie.douban.com/subject/35882592/":
    "https://img3.doubanio.com/view/photo/s_ratio_poster/public/p2931367452.jpg",
};

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function parseMonthDay(raw: string): { month: number; day: number } | null {
  const m = raw.match(/(\d{1,2})月\s*(\d{1,2})日/);
  if (!m) return null;

  const month = Number.parseInt(m[1], 10);
  const day = Number.parseInt(m[2], 10);

  if (!month || !day || month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { month, day };
}

function formatDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
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

async function scrapeRawMovies(): Promise<DraftMovie[]> {
  const response = await fetch(SOURCE_URL, {
    headers: {
      "User-Agent": USER_AGENT,
      Referer: "https://movie.douban.com/",
    },
    cache: "no-store",
  });

  if (!response.ok) return [];
  const html = await response.text();
  const $ = load(html);

  const rows: DraftMovie[] = [];

  $("table.coming_list tbody tr").each((_, tr) => {
    const tds = $(tr).find("td");
    if (tds.length < 5) return;

    const dateText = normalizeText($(tds[0]).text());
    const md = parseMonthDay(dateText);
    if (!md) return;

    const link = $(tds[1]).find("a").first();
    const title = normalizeText(link.attr("title") ?? link.text());
    const url = normalizeText(link.attr("href") ?? "");

    const genres = normalizeText($(tds[2]).text());
    const country = normalizeText($(tds[3]).text());

    const wishText = normalizeText($(tds[4]).text());
    const wishMatch = wishText.match(/(\d+[\d,]*)\s*人/);
    const wish = Number.parseInt((wishMatch?.[1] ?? "0").replace(/,/g, ""), 10) || 0;

    if (!title || !url) return;

    rows.push({
      title,
      url,
      month: md.month,
      day: md.day,
      wish,
      genres,
      country,
    });
  });

  return rows;
}

type TmdbMovie = {
  title?: string;
  original_title?: string;
  poster_path?: string | null;
  release_date?: string;
  popularity?: number;
};

type TmdbSearchResponse = {
  results?: TmdbMovie[];
};

function titleVariants(title: string): string[] {
  const normalized = normalizeText(title);
  const set = new Set<string>([normalized]);
  const bySpace = normalizeText(normalized.split(" ")[0] ?? "");
  const byCnColon = normalizeText(normalized.split("：")[0] ?? "");
  const byColon = normalizeText(normalized.split(":")[0] ?? "");
  const byParen = normalizeText(normalized.split("(")[0] ?? "");

  [bySpace, byCnColon, byColon, byParen].filter(Boolean).forEach((item) => set.add(item));
  return Array.from(set);
}

function pickTmdbPoster(title: string, year: string, items: TmdbMovie[]): string {
  if (!items.length) return "";

  const normalizedTitle = normalizeText(title).toLowerCase();
  const scored = items
    .filter((item) => item.poster_path)
    .map((item) => {
      const itemTitle = normalizeText(item.title ?? "").toLowerCase();
      const itemOriginalTitle = normalizeText(item.original_title ?? "").toLowerCase();
      const itemYear = (item.release_date ?? "").slice(0, 4);

      let score = item.popularity ?? 0;
      if (itemYear === year) score += 100;
      if (itemTitle === normalizedTitle || itemOriginalTitle === normalizedTitle) score += 120;
      if (
        itemTitle.includes(normalizedTitle) ||
        itemOriginalTitle.includes(normalizedTitle) ||
        normalizedTitle.includes(itemTitle) ||
        normalizedTitle.includes(itemOriginalTitle)
      ) {
        score += 30;
      }

      return { item, score };
    })
    .sort((a, b) => b.score - a.score);

  const path = scored[0]?.item.poster_path ?? "";
  return path ? `${TMDB_IMAGE_BASE}${path}` : "";
}

async function fetchMovieCover(title: string, releaseDate: string, url: string): Promise<string> {
  const manual = MANUAL_COVER_MAP[url];
  if (manual) return manual;

  const token = process.env.TMDB_READ_ACCESS_TOKEN?.trim() ?? "";
  if (!token) return "";

  const year = releaseDate.slice(0, 4);

  try {
    for (const q of titleVariants(title)) {
      const response = await fetch(
        `${TMDB_SEARCH_URL}?query=${encodeURIComponent(q)}&language=zh-CN&page=1&include_adult=false&year=${year}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
            "User-Agent": USER_AGENT,
          },
          cache: "no-store",
          signal: AbortSignal.timeout(10_000),
        },
      );

      if (!response.ok) continue;
      const json = (await response.json()) as TmdbSearchResponse;
      const results = Array.isArray(json.results) ? json.results : [];
      const poster = pickTmdbPoster(title, year, results);
      if (poster) return poster;
    }

    return "";
  } catch {
    return "";
  }
}

export async function fetchUpcomingMovies(): Promise<MovieItem[]> {
  const rawItems = await scrapeRawMovies();
  const today = new Date();

  let year = today.getFullYear();
  let previousMonthDay = -1;

  const mapped = rawItems.map((item) => {
    const monthDay = item.month * 100 + item.day;

    if (previousMonthDay !== -1 && monthDay < previousMonthDay) {
      year += 1;
    }
    previousMonthDay = monthDay;

    return {
      ...item,
      releaseDate: formatDate(year, item.month, item.day),
      coverUrl: "",
    };
  });

  const rows = mapped
    .filter((item) => isWithinNextYear(item.releaseDate))
    .sort((a, b) => a.releaseDate.localeCompare(b.releaseDate))
    .map((item) => ({
      title: item.title,
      url: item.url,
      releaseDate: item.releaseDate,
      wish: item.wish,
      genres: item.genres,
      country: item.country,
      coverUrl: item.coverUrl,
    }));

  const rowsWithCover: MovieItem[] = [];

  for (const item of rows) {
    const coverUrl = item.coverUrl || (await fetchMovieCover(item.title, item.releaseDate, item.url));
    rowsWithCover.push({
      ...item,
      coverUrl,
    });
  }

  return rowsWithCover;
}
