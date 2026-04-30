import { getGamesFromDb, getLatestSyncInfo, getMoviesFromDb, getOnlineMoviesFromDb } from "@/lib/db";
import type { GameItem } from "@/lib/game-source";
import type { MovieItem } from "@/lib/movie-source";
import type { OnlineMovieItem } from "@/lib/online-movie-source";
import TabbedContent from "./TabbedContent";

export const dynamic = "force-dynamic";

export default async function Home() {
  let games: GameItem[] = [];
  let movies: MovieItem[] = [];
  let onlineMovies: OnlineMovieItem[] = [];
  let syncInfo: { status: string; createdAt: string } | null = null;
  let dbError = "";

  try {
    [games, movies, onlineMovies, syncInfo] = await Promise.all([
      getGamesFromDb(),
      getMoviesFromDb(),
      getOnlineMoviesFromDb(),
      getLatestSyncInfo(),
    ]);
  } catch (error) {
    dbError = error instanceof Error ? error.message : "database error";
  }

  return (
    <main className="container">
      <TabbedContent games={games} movies={movies} onlineMovies={onlineMovies} dbError={dbError} syncInfo={syncInfo} />
    </main>
  );
}
