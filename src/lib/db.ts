import { neon } from "@neondatabase/serverless";
import { fetchHotUpcomingGames, type GameItem } from "@/lib/game-source";
import { fetchGlobalOnlineMovies, type GlobalOnlineMovieItem } from "@/lib/global-online-movie-source";
import { fetchUpcomingMovies, type MovieItem } from "@/lib/movie-source";
import { fetchOnlineMovies, type OnlineMovieItem } from "@/lib/online-movie-source";

type DbGameRow = {
  title: string;
  source_url: string;
  release_date: string;
  heat: number;
  platforms: string[];
  cover_url: string;
};

type DbMovieRow = {
  title: string;
  source_url: string;
  release_date: string;
  wish: number;
  genres: string;
  country: string;
  cover_url: string;
};

type DbOnlineMovieRow = {
  title: string;
  source_url: string;
  online_date: string | null;
  platforms: string[];
  source_name: string;
  status: string;
  reservation_count: number;
  confidence: number;
  cover_url: string;
};

type DbGlobalOnlineMovieRow = {
  title: string;
  original_title: string;
  source_url: string;
  online_date: string;
  platforms: string[];
  source_name: string;
  popularity: number;
  imdb_votes: number;
  imdb_score: number | null;
  tmdb_score: number | null;
  cover_url: string;
};

export type SyncResult = {
  syncedCount: number;
  movieSyncedCount: number;
  onlineMovieSyncedCount: number;
  globalOnlineMovieSyncedCount: number;
  durationMs: number;
};

let schemaReady = false;

function getSql() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured");
  }
  return neon(databaseUrl);
}

export async function ensureSchema() {
  if (schemaReady) return;

  const sql = getSql();

  await sql`
    CREATE TABLE IF NOT EXISTS games (
      id BIGSERIAL PRIMARY KEY,
      source_url TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      release_date DATE NOT NULL,
      heat INTEGER NOT NULL,
      platforms TEXT[] NOT NULL,
      cover_url TEXT NOT NULL DEFAULT '',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_games_release_date ON games (release_date)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS sync_logs (
      id BIGSERIAL PRIMARY KEY,
      status TEXT NOT NULL,
      synced_count INTEGER NOT NULL DEFAULT 0,
      duration_ms INTEGER NOT NULL DEFAULT 0,
      error_message TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS movies (
      id BIGSERIAL PRIMARY KEY,
      source_url TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      release_date DATE NOT NULL,
      wish INTEGER NOT NULL DEFAULT 0,
      genres TEXT NOT NULL DEFAULT '',
      country TEXT NOT NULL DEFAULT '',
      cover_url TEXT NOT NULL DEFAULT '',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_movies_release_date ON movies (release_date)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS online_movies (
      id BIGSERIAL PRIMARY KEY,
      source_url TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      online_date DATE,
      platforms TEXT[] NOT NULL,
      source_name TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT '',
      reservation_count INTEGER NOT NULL DEFAULT 0,
      confidence INTEGER NOT NULL DEFAULT 0,
      cover_url TEXT NOT NULL DEFAULT '',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    ALTER TABLE online_movies ALTER COLUMN online_date DROP NOT NULL
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_online_movies_online_date ON online_movies (online_date)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS global_online_movies (
      id BIGSERIAL PRIMARY KEY,
      source_url TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      original_title TEXT NOT NULL DEFAULT '',
      online_date DATE NOT NULL,
      platforms TEXT[] NOT NULL,
      source_name TEXT NOT NULL DEFAULT '',
      popularity REAL NOT NULL DEFAULT 0,
      imdb_votes INTEGER NOT NULL DEFAULT 0,
      imdb_score REAL,
      tmdb_score REAL,
      cover_url TEXT NOT NULL DEFAULT '',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    ALTER TABLE global_online_movies ADD COLUMN IF NOT EXISTS tmdb_score REAL
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_global_online_movies_online_date ON global_online_movies (online_date)
  `;

  schemaReady = true;
}

export async function getGamesFromDb(): Promise<GameItem[]> {
  await ensureSchema();
  const sql = getSql();

  const rows = (await sql`
    SELECT
      title,
      source_url,
      release_date::text AS release_date,
      heat,
      platforms,
      cover_url
    FROM games
    WHERE release_date >= (CURRENT_DATE - INTERVAL '14 days')
      AND release_date <= (CURRENT_DATE + INTERVAL '365 days')
      AND heat > 4000
    ORDER BY release_date ASC
  `) as DbGameRow[];

  return rows.map((row) => ({
    title: row.title,
    url: row.source_url,
    releaseDate: row.release_date,
    heat: row.heat,
    platforms: row.platforms ?? [],
    coverUrl: row.cover_url,
  }));
}

export async function getLatestSyncInfo(): Promise<{ status: string; createdAt: string } | null> {
  await ensureSchema();
  const sql = getSql();

  const rows = (await sql`
    SELECT status, created_at::text AS created_at
    FROM sync_logs
    ORDER BY created_at DESC
    LIMIT 1
  `) as Array<{ status: string; created_at: string }>;

  if (!rows.length) return null;
  return {
    status: rows[0].status,
    createdAt: rows[0].created_at,
  };
}

export async function getMoviesFromDb(): Promise<MovieItem[]> {
  await ensureSchema();
  const sql = getSql();

  const rows = (await sql`
    SELECT
      title,
      source_url,
      release_date::text AS release_date,
      wish,
      genres,
      country,
      cover_url
    FROM movies
    WHERE release_date >= (CURRENT_DATE - INTERVAL '14 days')
      AND release_date <= (CURRENT_DATE + INTERVAL '365 days')
    ORDER BY release_date ASC
  `) as DbMovieRow[];

  return rows.map((row) => ({
    title: row.title,
    url: row.source_url,
    releaseDate: row.release_date,
    wish: row.wish,
    genres: row.genres,
    country: row.country,
    coverUrl: row.cover_url,
  }));
}

export async function getOnlineMoviesFromDb(): Promise<OnlineMovieItem[]> {
  await ensureSchema();
  const sql = getSql();

  const rows = (await sql`
    SELECT
      title,
      source_url,
      online_date::text AS online_date,
      platforms,
      source_name,
      status,
      reservation_count,
      confidence,
      cover_url
    FROM online_movies
    WHERE online_date IS NULL
      OR (
        online_date >= (CURRENT_DATE - INTERVAL '14 days')
        AND online_date <= (CURRENT_DATE + INTERVAL '365 days')
      )
    ORDER BY online_date ASC NULLS LAST, reservation_count DESC
  `) as DbOnlineMovieRow[];

  return rows.map((row) => ({
    title: row.title,
    url: row.source_url,
    onlineDate: row.online_date,
    platforms: row.platforms ?? [],
    sourceName: row.source_name,
    status: row.status,
    reservationCount: row.reservation_count,
    confidence: row.confidence,
    coverUrl: row.cover_url,
  }));
}

export async function getGlobalOnlineMoviesFromDb(): Promise<GlobalOnlineMovieItem[]> {
  await ensureSchema();
  const sql = getSql();

  const rows = (await sql`
    SELECT
      title,
      original_title,
      source_url,
      online_date::text AS online_date,
      platforms,
      source_name,
      popularity,
      imdb_votes,
      imdb_score,
      tmdb_score,
      cover_url
    FROM global_online_movies
    WHERE online_date >= (CURRENT_DATE - INTERVAL '14 days')
      AND online_date <= (CURRENT_DATE + INTERVAL '365 days')
    ORDER BY online_date ASC, popularity DESC
  `) as DbGlobalOnlineMovieRow[];

  return rows.map((row) => ({
    title: row.title,
    originalTitle: row.original_title,
    url: row.source_url,
    onlineDate: row.online_date,
    platforms: row.platforms ?? [],
    sourceName: row.source_name,
    popularity: row.popularity,
    imdbVotes: row.imdb_votes,
    imdbScore: row.imdb_score,
    tmdbScore: row.tmdb_score,
    coverUrl: row.cover_url,
  }));
}

export async function syncGamesToDb(): Promise<SyncResult> {
  await ensureSchema();
  const sql = getSql();

  const started = Date.now();

  try {
    const [games, movies, onlineMovieResult, globalOnlineMovieResult] = await Promise.all([
      fetchHotUpcomingGames(),
      fetchUpcomingMovies(),
      fetchOnlineMovies().catch(() => [] as OnlineMovieItem[]),
      fetchGlobalOnlineMovies().catch(() => [] as GlobalOnlineMovieItem[]),
    ]);

    await sql`BEGIN`;
    try {
      await sql`
        DELETE FROM games
        WHERE release_date < (CURRENT_DATE - INTERVAL '14 days')
      `;
      await sql`
        DELETE FROM movies
        WHERE release_date < (CURRENT_DATE - INTERVAL '14 days')
      `;
      await sql`
        DELETE FROM online_movies
        WHERE online_date IS NOT NULL
          AND online_date < (CURRENT_DATE - INTERVAL '14 days')
      `;
      await sql`
        DELETE FROM global_online_movies
        WHERE online_date < (CURRENT_DATE - INTERVAL '14 days')
      `;

      const onlineMovieUrls = onlineMovieResult.map((movie) => movie.url).filter(Boolean);
      if (onlineMovieUrls.length > 0) {
        await sql`
          DELETE FROM online_movies
          WHERE online_date IS NULL
            AND source_url <> ALL(${onlineMovieUrls})
        `;
      }

      const globalOnlineMovieUrls = globalOnlineMovieResult.map((movie) => movie.url).filter(Boolean);
      if (globalOnlineMovieUrls.length > 0) {
        await sql`
          DELETE FROM global_online_movies
          WHERE source_url <> ALL(${globalOnlineMovieUrls})
        `;
      }

      for (const movie of onlineMovieResult) {
        await sql`
          DELETE FROM online_movies
          WHERE title = ${movie.title}
            AND online_date IS NOT DISTINCT FROM ${movie.onlineDate}
            AND source_url <> ${movie.url}
        `;
      }

      for (const movie of globalOnlineMovieResult) {
        await sql`
          INSERT INTO global_online_movies (
            source_url,
            title,
            original_title,
            online_date,
            platforms,
            source_name,
            popularity,
            imdb_votes,
            imdb_score,
            tmdb_score,
            cover_url,
            updated_at
          )
          VALUES (
            ${movie.url},
            ${movie.title},
            ${movie.originalTitle},
            ${movie.onlineDate},
            ${movie.platforms},
            ${movie.sourceName},
            ${movie.popularity},
            ${movie.imdbVotes},
            ${movie.imdbScore},
            ${movie.tmdbScore},
            ${movie.coverUrl || ""},
            NOW()
          )
          ON CONFLICT (source_url) DO UPDATE SET
            title = EXCLUDED.title,
            original_title = EXCLUDED.original_title,
            online_date = EXCLUDED.online_date,
            platforms = EXCLUDED.platforms,
            source_name = EXCLUDED.source_name,
            popularity = EXCLUDED.popularity,
            imdb_votes = EXCLUDED.imdb_votes,
            imdb_score = EXCLUDED.imdb_score,
            tmdb_score = EXCLUDED.tmdb_score,
            cover_url = EXCLUDED.cover_url,
            updated_at = NOW()
        `;
      }

      for (const game of games) {
        await sql`
          INSERT INTO games (source_url, title, release_date, heat, platforms, cover_url, updated_at)
          VALUES (${game.url}, ${game.title}, ${game.releaseDate}, ${game.heat}, ${game.platforms}, ${game.coverUrl || ""}, NOW())
          ON CONFLICT (source_url) DO UPDATE SET
            title = EXCLUDED.title,
            release_date = EXCLUDED.release_date,
            heat = EXCLUDED.heat,
            platforms = EXCLUDED.platforms,
            cover_url = EXCLUDED.cover_url,
            updated_at = NOW()
        `;
      }

      for (const movie of movies) {
        await sql`
          INSERT INTO movies (source_url, title, release_date, wish, genres, country, cover_url, updated_at)
          VALUES (${movie.url}, ${movie.title}, ${movie.releaseDate}, ${movie.wish}, ${movie.genres}, ${movie.country}, ${movie.coverUrl || ""}, NOW())
          ON CONFLICT (source_url) DO UPDATE SET
            title = EXCLUDED.title,
            release_date = EXCLUDED.release_date,
            wish = EXCLUDED.wish,
            genres = EXCLUDED.genres,
            country = EXCLUDED.country,
            cover_url = EXCLUDED.cover_url,
            updated_at = NOW()
        `;
      }

      for (const movie of onlineMovieResult) {
        await sql`
          INSERT INTO online_movies (
            source_url,
            title,
            online_date,
            platforms,
            source_name,
            status,
            reservation_count,
            confidence,
            cover_url,
            updated_at
          )
          VALUES (
            ${movie.url},
            ${movie.title},
            ${movie.onlineDate},
            ${movie.platforms},
            ${movie.sourceName},
            ${movie.status},
            ${movie.reservationCount},
            ${movie.confidence},
            ${movie.coverUrl || ""},
            NOW()
          )
          ON CONFLICT (source_url) DO UPDATE SET
            title = EXCLUDED.title,
            online_date = EXCLUDED.online_date,
            platforms = EXCLUDED.platforms,
            source_name = EXCLUDED.source_name,
            status = EXCLUDED.status,
            reservation_count = EXCLUDED.reservation_count,
            confidence = EXCLUDED.confidence,
            cover_url = EXCLUDED.cover_url,
            updated_at = NOW()
        `;
      }

      await sql`
        WITH duplicate_groups AS (
          SELECT
            title,
            online_date,
            (ARRAY_AGG(id ORDER BY reservation_count DESC, updated_at DESC, id DESC))[1] AS keep_id,
            ARRAY_AGG(id) AS ids
          FROM online_movies
          GROUP BY title, online_date
          HAVING COUNT(*) > 1
        ),
        merged_platforms AS (
          SELECT
            duplicate_groups.keep_id,
            ARRAY_AGG(DISTINCT platform ORDER BY platform) AS platforms
          FROM duplicate_groups
          JOIN online_movies ON online_movies.id = ANY(duplicate_groups.ids)
          CROSS JOIN LATERAL UNNEST(online_movies.platforms) AS platform
          GROUP BY duplicate_groups.keep_id
        )
        UPDATE online_movies
        SET platforms = merged_platforms.platforms
        FROM merged_platforms
        WHERE online_movies.id = merged_platforms.keep_id
      `;

      await sql`
        WITH duplicate_groups AS (
          SELECT
            (ARRAY_AGG(id ORDER BY reservation_count DESC, updated_at DESC, id DESC))[1] AS keep_id,
            ARRAY_AGG(id) AS ids
          FROM online_movies
          GROUP BY title, online_date
          HAVING COUNT(*) > 1
        )
        DELETE FROM online_movies
        USING duplicate_groups
        WHERE online_movies.id = ANY(duplicate_groups.ids)
          AND online_movies.id <> duplicate_groups.keep_id
      `;

      const durationMs = Date.now() - started;
      await sql`
        INSERT INTO sync_logs (status, synced_count, duration_ms)
        VALUES ('ok', ${games.length + movies.length + onlineMovieResult.length + globalOnlineMovieResult.length}, ${durationMs})
      `;

      await sql`COMMIT`;
      return {
        syncedCount: games.length,
        movieSyncedCount: movies.length,
        onlineMovieSyncedCount: onlineMovieResult.length,
        globalOnlineMovieSyncedCount: globalOnlineMovieResult.length,
        durationMs,
      };
    } catch (error) {
      await sql`ROLLBACK`;
      throw error;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    const durationMs = Date.now() - started;

    await sql`
      INSERT INTO sync_logs (status, synced_count, duration_ms, error_message)
      VALUES ('error', 0, ${durationMs}, ${message})
    `;

    throw error;
  }
}
