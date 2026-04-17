import { getGamesFromDb, getLatestSyncInfo, getMoviesFromDb } from "@/lib/db";
import type { GameItem } from "@/lib/game-source";
import type { MovieItem } from "@/lib/movie-source";
import TabbedContent from "./TabbedContent";

export const dynamic = "force-dynamic";

export default async function Home() {
  let games: GameItem[] = [];
  let movies: MovieItem[] = [];
  let syncInfo: { status: string; createdAt: string } | null = null;
  let dbError = "";

  try {
    [games, movies, syncInfo] = await Promise.all([getGamesFromDb(), getMoviesFromDb(), getLatestSyncInfo()]);
  } catch (error) {
    dbError = error instanceof Error ? error.message : "database error";
  }

  return (
    <main className="container">
      <TabbedContent games={games} movies={movies} dbError={dbError} syncInfo={syncInfo} />
    </main>
  );
}
