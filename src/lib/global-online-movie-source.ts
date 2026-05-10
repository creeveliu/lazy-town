export type GlobalOnlineMovieItem = {
  title: string;
  originalTitle: string;
  url: string;
  onlineDate: string;
  platforms: string[];
  sourceName: string;
  popularity: number;
  imdbVotes: number;
  imdbScore: number | null;
  tmdbScore: number | null;
  coverUrl: string;
};

type JustWatchOffer = {
  dateCreated?: string;
  package?: {
    clearName?: string;
  } | null;
};

type JustWatchRelease = {
  releaseDate?: string;
  package?: {
    clearName?: string;
  } | null;
};

type JustWatchScoring = {
  imdbScore?: number | null;
  imdbVotes?: number | null;
  tmdbPopularity?: number | null;
  tmdbScore?: number | null;
};

type JustWatchContent = {
  title?: string;
  fullPath?: string;
  posterUrl?: string | null;
  originalReleaseYear?: number | null;
  upcomingReleases?: JustWatchRelease[];
  scoring?: JustWatchScoring | null;
};

type JustWatchEdge = {
  node?: {
    objectType?: string;
    content?: JustWatchContent | null;
    watchNowOffer?: JustWatchOffer | null;
  } | null;
};

type JustWatchResponse = {
  data?: {
    newTitles?: {
      pageInfo?: {
        endCursor?: string;
        hasNextPage?: boolean;
      };
      edges?: JustWatchEdge[];
    } | null;
  } | null;
};

type TmdbSearchResponse = {
  results?: Array<{
    id?: number;
    title?: string;
    original_title?: string;
    popularity?: number;
    release_date?: string;
    poster_path?: string | null;
  }>;
};

type TmdbDiscoverResponse = {
  results?: Array<{
    id?: number;
    title?: string;
    original_title?: string;
    popularity?: number;
    release_date?: string;
    poster_path?: string | null;
    vote_count?: number;
    vote_average?: number;
  }>;
};

type TmdbReleaseDatesResponse = {
  results?: Array<{
    iso_3166_1?: string;
    release_dates?: Array<{
      release_date?: string;
      type?: number;
    }>;
  }>;
};

type TmdbMovieMetadata = {
  title: string;
  posterUrl: string;
  url: string;
  hasChineseTitle: boolean;
};

const JUSTWATCH_GRAPHQL_URL = "https://apis.justwatch.com/graphql";
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const REQUEST_TIMEOUT_MS = 15000;
const SUPPORTED_PLATFORMS = new Set([
  "Netflix",
  "Apple TV",
  "Apple TV Plus",
  "Amazon Prime Video",
  "Disney Plus",
  "HBO Max",
  "Hulu",
]);
const MIN_TMDB_POPULARITY = 10;
const MIN_UPCOMING_TMDB_POPULARITY = 2;
const MIN_IMDB_VOTES = 1000;
const MIN_APPLE_TV_FALLBACK_POPULARITY = 80;
const RECENT_RELEASE_YEAR_WINDOW = 2;
const JUSTWATCH_QUERY = `
  query GetUpcoming($country: Country!, $first: Int!, $after: String, $filter: TitleFilter, $pageType: NewPageType!) {
    newTitles(country: $country, first: $first, after: $after, filter: $filter, pageType: $pageType) {
      pageInfo {
        endCursor
        hasNextPage
      }
      edges {
        node {
          objectType
          content(country: $country, language: "en") {
            title
            fullPath
            posterUrl
            originalReleaseYear
            upcomingReleases {
              releaseDate
              package {
                clearName
              }
            }
            scoring {
              imdbScore
              imdbVotes
              tmdbPopularity
              tmdbScore
            }
          }
        }
      }
    }
  }
`;
const JUSTWATCH_NEW_RELEASES_QUERY = `
  query GetNewReleases($country: Country!, $first: Int!, $after: String, $filter: TitleFilter, $pageType: NewPageType!) {
    newTitles(country: $country, first: $first, after: $after, filter: $filter, pageType: $pageType) {
      pageInfo {
        endCursor
        hasNextPage
      }
      edges {
        node {
          objectType
          watchNowOffer(country: $country, platform: WEB) {
            dateCreated
            package {
              clearName
            }
          }
          content(country: $country, language: "en") {
            title
            fullPath
            posterUrl
            originalReleaseYear
            scoring {
              imdbScore
              imdbVotes
              tmdbPopularity
              tmdbScore
            }
          }
        }
      }
    }
  }
`;

function formatDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function normalizePosterUrl(url: string | null | undefined): string {
  if (!url) return "";
  return `https://images.justwatch.com${url.replace("{profile}", "s332").replace("{format}", "webp")}`;
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchJustWatchPage(after: string, year: number): Promise<JustWatchResponse | null> {
  const response = await fetchWithTimeout(JUSTWATCH_GRAPHQL_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": USER_AGENT,
    },
    body: JSON.stringify({
      operationName: "GetUpcoming",
      query: JUSTWATCH_QUERY,
      variables: {
        country: "US",
        first: 100,
        after,
        pageType: "UPCOMING",
        filter: {
          objectTypes: ["MOVIE"],
          releaseYear: { min: year, max: year },
          packages: [],
          monetizationTypes: [],
          genres: [],
          excludeGenres: [],
          presentationTypes: [],
          ageCertifications: [],
          productionCountries: [],
          excludeProductionCountries: [],
          subgenres: [],
          excludeIrrelevantTitles: false,
        },
      },
    }),
  });

  if (!response?.ok) return null;
  return response.json() as Promise<JustWatchResponse>;
}

async function fetchJustWatchNewReleasesPage(after: string): Promise<JustWatchResponse | null> {
  const response = await fetchWithTimeout(JUSTWATCH_GRAPHQL_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": USER_AGENT,
    },
    body: JSON.stringify({
      operationName: "GetNewReleases",
      query: JUSTWATCH_NEW_RELEASES_QUERY,
      variables: {
        country: "US",
        first: 100,
        after,
        pageType: "NEW",
        filter: {
          objectTypes: ["MOVIE"],
          packages: [],
          monetizationTypes: [],
          genres: [],
          excludeGenres: [],
          presentationTypes: [],
          ageCertifications: [],
          productionCountries: [],
          excludeProductionCountries: [],
          subgenres: [],
          excludeIrrelevantTitles: false,
        },
      },
    }),
  });

  if (!response?.ok) return null;
  return response.json() as Promise<JustWatchResponse>;
}

async function fetchTmdbMovieMetadata(title: string, date: string): Promise<TmdbMovieMetadata> {
  const token = process.env.TMDB_READ_ACCESS_TOKEN;
  const params = new URLSearchParams({
    query: title,
    language: "zh-CN",
    include_adult: "false",
    year: date.slice(0, 4),
  });
  const apiKey = process.env.TMDB_API_KEY;
  if (!token && !apiKey) return { title: "", posterUrl: "", url: "", hasChineseTitle: false };
  if (apiKey && !token) params.set("api_key", apiKey);

  const response = await fetchWithTimeout(`https://api.themoviedb.org/3/search/movie?${params}`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      "User-Agent": USER_AGENT,
    },
  });

  if (!response?.ok) return { title: "", posterUrl: "", url: "", hasChineseTitle: false };

  const data = (await response.json()) as TmdbSearchResponse;
  const first = data.results?.[0];
  if (!first) return { title: "", posterUrl: "", url: "", hasChineseTitle: false };

  const hasChineseTitle = Boolean(first.title && first.title !== first.original_title);

  return {
    title: hasChineseTitle ? first.title ?? "" : "",
    posterUrl: first.poster_path ? `https://image.tmdb.org/t/p/w342${first.poster_path}` : "",
    url: first.id ? `https://www.themoviedb.org/movie/${first.id}?language=zh-CN` : "",
    hasChineseTitle,
  };
}

async function fetchTmdbPopularRecentMovies(): Promise<GlobalOnlineMovieItem[]> {
  const token = process.env.TMDB_READ_ACCESS_TOKEN;
  const apiKey = process.env.TMDB_API_KEY;
  if (!token && !apiKey) return [];

  const today = new Date();
  const twoMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 2, today.getDate());
  const params = new URLSearchParams({
    language: "zh-CN",
    include_adult: "false",
    include_video: "false",
    sort_by: "popularity.desc",
    "primary_release_date.gte": formatDate(twoMonthsAgo),
    "primary_release_date.lte": formatDate(today),
    "vote_count.gte": "100",
  });
  if (apiKey && !token) params.set("api_key", apiKey);

  const response = await fetchWithTimeout(`https://api.themoviedb.org/3/discover/movie?${params}`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      "User-Agent": USER_AGENT,
    },
  });
  if (!response?.ok) return [];

  const data = (await response.json()) as TmdbDiscoverResponse;
  const rows: GlobalOnlineMovieItem[] = [];

  for (const movie of data.results ?? []) {
    if (
      !movie.id ||
      !movie.title ||
      (movie.popularity ?? 0) < MIN_APPLE_TV_FALLBACK_POPULARITY
    ) {
      continue;
    }

    const digitalDate = await fetchTmdbUsDigitalDate(movie.id);
    if (!digitalDate) continue;

    rows.push({
      title: movie.title,
      originalTitle: movie.original_title ?? movie.title,
      url: `https://www.themoviedb.org/movie/${movie.id}?language=zh-CN`,
      onlineDate: digitalDate,
      platforms: ["iTunes"],
      sourceName: "TMDB US digital",
      popularity: movie.popularity ?? 0,
      imdbVotes: movie.vote_count ?? 0,
      imdbScore: movie.vote_average ?? null,
      tmdbScore: movie.vote_average ?? null,
      coverUrl: movie.poster_path ? `https://image.tmdb.org/t/p/w342${movie.poster_path}` : "",
    });
  }

  return rows;
}

async function fetchTmdbUsDigitalDate(movieId: number): Promise<string> {
  const token = process.env.TMDB_READ_ACCESS_TOKEN;
  const apiKey = process.env.TMDB_API_KEY;
  if (!token && !apiKey) return "";

  const params = new URLSearchParams();
  if (apiKey && !token) params.set("api_key", apiKey);
  const response = await fetchWithTimeout(`https://api.themoviedb.org/3/movie/${movieId}/release_dates?${params}`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      "User-Agent": USER_AGENT,
    },
  });
  if (!response?.ok) return "";

  const data = (await response.json()) as TmdbReleaseDatesResponse;
  const us = data.results?.find((item) => item.iso_3166_1 === "US");
  const digital = us?.release_dates
    ?.filter((item) => item.type === 4 && item.release_date)
    .map((item) => item.release_date?.slice(0, 10) ?? "")
    .sort()[0];

  return digital ?? "";
}

function shouldKeepMovie(popularity: number, imdbVotes: number, tmdbScore: number | null | undefined): boolean {
  if ((tmdbScore ?? 0) < 6.5 && popularity < 20) return false;
  return popularity >= MIN_TMDB_POPULARITY || imdbVotes >= MIN_IMDB_VOTES;
}

function shouldKeepUpcomingMovie(popularity: number, hasChineseTitle: boolean): boolean {
  return hasChineseTitle && popularity >= MIN_UPCOMING_TMDB_POPULARITY;
}

function shouldKeepForChineseAudience(hasChineseTitle: boolean, popularity: number): boolean {
  return hasChineseTitle || popularity >= 20;
}

function isRecentMovie(content: JustWatchContent, year: number): boolean {
  return !content.originalReleaseYear || content.originalReleaseYear >= year - RECENT_RELEASE_YEAR_WINDOW;
}

export async function fetchGlobalOnlineMovies(): Promise<GlobalOnlineMovieItem[]> {
  const today = new Date();
  const minDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 14);
  const maxDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 365);
  const years = Array.from(new Set([today.getFullYear(), maxDate.getFullYear()]));
  const rows = new Map<string, GlobalOnlineMovieItem>();

  for (const item of await fetchTmdbPopularRecentMovies()) {
    rows.set(`${item.originalTitle}-${item.onlineDate}`, item);
  }

  for (let page = 0, after = ""; page < 5; page += 1) {
    const result = await fetchJustWatchNewReleasesPage(after);
    const newTitles = result?.data?.newTitles;
    if (!newTitles) break;

    for (const edge of newTitles.edges ?? []) {
      const content = edge.node?.content;
      const offer = edge.node?.watchNowOffer;
      const platform = offer?.package?.clearName ?? "";
      const onlineDate = offer?.dateCreated ?? "";
      if (edge.node?.objectType !== "MOVIE" || !content?.title || !content.fullPath) continue;
      if (!onlineDate || onlineDate < formatDate(minDate) || onlineDate > formatDate(maxDate)) continue;
      if (!SUPPORTED_PLATFORMS.has(platform) || !isRecentMovie(content, today.getFullYear())) continue;

      const scoring = content.scoring ?? {};
      const popularity = scoring.tmdbPopularity ?? 0;
      const imdbVotes = scoring.imdbVotes ?? 0;
      if (!shouldKeepMovie(popularity, imdbVotes, scoring.tmdbScore)) continue;

      const tmdb = await fetchTmdbMovieMetadata(content.title, onlineDate);
      if (!shouldKeepForChineseAudience(tmdb.hasChineseTitle, popularity)) continue;
      const item = {
        title: tmdb.title || content.title,
        originalTitle: content.title,
        url: tmdb.url || `https://www.justwatch.com${content.fullPath}`,
        onlineDate,
        platforms: [platform],
        sourceName: "JustWatch US",
        popularity,
        imdbVotes,
        imdbScore: scoring.imdbScore ?? null,
        tmdbScore: scoring.tmdbScore ?? null,
        coverUrl: tmdb.posterUrl || normalizePosterUrl(content.posterUrl),
      };

      rows.set(`${item.originalTitle}-${item.onlineDate}`, item);
    }

    if (!newTitles.pageInfo?.hasNextPage || !newTitles.pageInfo.endCursor) break;
    after = newTitles.pageInfo.endCursor;
  }

  for (const year of years) {
    let after = "";
    for (let page = 0; page < 5; page += 1) {
      const result = await fetchJustWatchPage(after, year);
      const newTitles = result?.data?.newTitles;
      if (!newTitles) break;

      for (const edge of newTitles.edges ?? []) {
        const content = edge.node?.content;
        if (edge.node?.objectType !== "MOVIE" || !content?.title || !content.fullPath) continue;

        const releases = (content.upcomingReleases ?? []).filter((release) => {
          const platform = release.package?.clearName ?? "";
          return Boolean(release.releaseDate) && SUPPORTED_PLATFORMS.has(platform);
        });
        if (!releases.length) continue;

        const onlineDate = releases.map((release) => release.releaseDate ?? "").sort()[0];
        if (onlineDate < formatDate(minDate) || onlineDate > formatDate(maxDate)) continue;
        if (!isRecentMovie(content, year)) continue;

        const scoring = content.scoring ?? {};
        const popularity = scoring.tmdbPopularity ?? 0;
        const imdbVotes = scoring.imdbVotes ?? 0;

        const platforms = Array.from(new Set(releases.map((release) => release.package?.clearName ?? "").filter(Boolean)));
        const tmdb = await fetchTmdbMovieMetadata(content.title, onlineDate);
        if (!shouldKeepUpcomingMovie(popularity, tmdb.hasChineseTitle)) continue;
        if (!shouldKeepForChineseAudience(tmdb.hasChineseTitle, popularity)) continue;
        const item = {
          title: tmdb.title || content.title,
          originalTitle: content.title,
          url: tmdb.url || `https://www.justwatch.com${content.fullPath}`,
          onlineDate,
          platforms,
          sourceName: "JustWatch US",
          popularity,
          imdbVotes,
          imdbScore: scoring.imdbScore ?? null,
          tmdbScore: scoring.tmdbScore ?? null,
          coverUrl: tmdb.posterUrl || normalizePosterUrl(content.posterUrl),
        };

        rows.set(`${item.originalTitle}-${item.onlineDate}`, item);
      }

      if (!newTitles.pageInfo?.hasNextPage || !newTitles.pageInfo.endCursor) break;
      after = newTitles.pageInfo.endCursor;
    }
  }

  return Array.from(rows.values()).sort((a, b) => a.onlineDate.localeCompare(b.onlineDate));
}
