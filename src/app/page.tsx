import { getGamesFromDb, getLatestSyncInfo, getMoviesFromDb } from "@/lib/db";
import TabbedContent from "./TabbedContent";

export const dynamic = "force-dynamic";

export default async function Home() {
  let games: any[] = [];
  let movies: any[] = [];
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
