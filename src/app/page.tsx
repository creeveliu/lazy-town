import {
  getGamesFromDb,
  getGlobalOnlineMoviesFromDb,
  getLatestSyncInfo,
  getLaunchEventsFromDb,
  getMoviesFromDb,
  getOnlineMoviesFromDb,
} from "@/lib/db";
import type { GameItem } from "@/lib/game-source";
import type { GlobalOnlineMovieItem } from "@/lib/global-online-movie-source";
import type { LaunchEventItem } from "@/lib/launch-source";
import type { MovieItem } from "@/lib/movie-source";
import type { OnlineMovieItem } from "@/lib/online-movie-source";
import TabbedContent from "./TabbedContent";

export const dynamic = "force-dynamic";

export default async function Home() {
  let games: GameItem[] = [];
  let movies: MovieItem[] = [];
  let onlineMovies: OnlineMovieItem[] = [];
  let globalOnlineMovies: GlobalOnlineMovieItem[] = [];
  let launchEvents: LaunchEventItem[] = [];
  let syncInfo: { status: string; createdAt: string } | null = null;
  let dbError = "";

  try {
    [games, movies, onlineMovies, globalOnlineMovies, launchEvents, syncInfo] = await Promise.all([
      getGamesFromDb(),
      getMoviesFromDb(),
      getOnlineMoviesFromDb(),
      getGlobalOnlineMoviesFromDb(),
      getLaunchEventsFromDb(),
      getLatestSyncInfo(),
    ]);
  } catch (error) {
    dbError = error instanceof Error ? error.message : "database error";
  }

  return (
    <main className="container">
      <TabbedContent
        games={games}
        movies={movies}
        onlineMovies={onlineMovies}
        globalOnlineMovies={globalOnlineMovies}
        launchEvents={launchEvents}
        dbError={dbError}
        syncInfo={syncInfo}
      />
    </main>
  );
}
