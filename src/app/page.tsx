import { getGamesFromDb, getLatestSyncInfo, getMoviesFromDb } from "@/lib/db";
import type { GameItem } from "@/lib/game-source";
import type { MovieItem } from "@/lib/movie-source";

export const dynamic = "force-dynamic";

function proxiedImageUrl(url: string, referer?: string): string {
  if (referer) {
    return `/api/image?url=${encodeURIComponent(url)}&ref=${encodeURIComponent(referer)}`;
  }
  return `/api/image?url=${encodeURIComponent(url)}`;
}

function heatTag(heat: number): { label: string; level: "low" | "mid" | "high" } {
  if (heat >= 20000) return { label: "爆款", level: "high" };
  if (heat >= 10000) return { label: "热门", level: "mid" };
  return { label: "普通", level: "low" };
}

function movieWishTag(wish: number): { label: string; level: "low" | "mid" | "high" } {
  if (wish >= 50000) return { label: "爆款", level: "high" };
  if (wish >= 10000) return { label: "热门", level: "mid" };
  return { label: "普通", level: "low" };
}

export default async function Home() {
  let games: GameItem[] = [];
  let movies: MovieItem[] = [];
  let syncInfo: { status: string; createdAt: string } | null = null;
  let dbError = "";
  const currentYear = new Date().getFullYear();

  try {
    [games, movies, syncInfo] = await Promise.all([getGamesFromDb(), getMoviesFromDb(), getLatestSyncInfo()]);
  } catch (error) {
    dbError = error instanceof Error ? error.message : "database error";
  }

  return (
    <main className="container">
      <header className="header">
        <h1>热门游戏发售表</h1>
      </header>

      <section className="table-wrap">
        <table className="game-table">
          <thead>
            <tr>
              <th>海报</th>
              <th>发售日</th>
              <th>游戏名</th>
              <th>平台</th>
              <th>热度</th>
            </tr>
          </thead>
          <tbody>
            {games.length === 0 ? (
              <tr>
                <td colSpan={5} className="empty">
                  {dbError
                    ? `数据库不可用：${dbError}`
                    : `暂无数据，请先访问 /api/sync 触发一次同步${syncInfo ? `（最近同步：${syncInfo.status}，${syncInfo.createdAt}）` : ""}`}
                </td>
              </tr>
            ) : (
              games.map((game) => {
                const tag = heatTag(game.heat);
                const monthDay = game.releaseDate.slice(5);
                return (
                  <tr key={game.url}>
                    <td>
                      {game.coverUrl ? (
                        <img
                          className="cover"
                          src={proxiedImageUrl(game.coverUrl)}
                          alt={game.title}
                          width={54}
                          height={76}
                          loading="lazy"
                        />
                      ) : (
                        <div className="cover cover-placeholder">无图</div>
                      )}
                    </td>
                    <td className="mono">{monthDay}</td>
                    <td className="title-cell">
                      <a href={game.url} target="_blank" rel="noreferrer" className="title-link">
                        {game.title}
                      </a>
                    </td>
                    <td>{game.platforms.join(" / ")}</td>
                    <td>
                      <span className={`heat-tag heat-${tag.level}`}>{tag.label}</span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </section>

      <header className="header section-gap">
        <h1>电影放映表</h1>
      </header>

      <section className="table-wrap">
        <table className="game-table">
          <thead>
            <tr>
              <th>海报</th>
              <th>上映日</th>
              <th>电影名</th>
              <th>类型 / 地区</th>
              <th>热度</th>
            </tr>
          </thead>
          <tbody>
            {movies.length === 0 ? (
              <tr>
                <td colSpan={5} className="empty">
                  {dbError
                    ? `数据库不可用：${dbError}`
                    : `暂无电影数据，请先访问 /api/sync 触发同步${syncInfo ? `（最近同步：${syncInfo.status}，${syncInfo.createdAt}）` : ""}`}
                </td>
              </tr>
            ) : (
              movies.flatMap((movie, index) => {
                const tag = movieWishTag(movie.wish);
                const year = Number.parseInt(movie.releaseDate.slice(0, 4), 10);
                const monthDay = movie.releaseDate.slice(5);

                const previousYear =
                  index > 0 ? Number.parseInt(movies[index - 1].releaseDate.slice(0, 4), 10) : currentYear;

                const shouldShowYearHeader = year !== currentYear && year !== previousYear;
                const rows = [];

                if (shouldShowYearHeader) {
                  rows.push(
                    <tr key={`year-${year}`} className="year-divider-row">
                      <td colSpan={5} className="year-divider">
                        {year}
                      </td>
                    </tr>,
                  );
                }

                rows.push(
                  <tr key={movie.url}>
                    <td>
                      {movie.coverUrl ? (
                        <img
                          className="cover"
                          src={proxiedImageUrl(movie.coverUrl, movie.url)}
                          alt={movie.title}
                          width={54}
                          height={76}
                          loading="lazy"
                        />
                      ) : (
                        <div className="cover cover-placeholder">无图</div>
                      )}
                    </td>
                    <td className="mono">{monthDay}</td>
                    <td className="title-cell">
                      <a href={movie.url} target="_blank" rel="noreferrer" className="title-link">
                        {movie.title}
                      </a>
                    </td>
                    <td>{`${movie.genres || "-"} / ${movie.country || "-"}`}</td>
                    <td>
                      <span className={`heat-tag heat-${tag.level}`}>{tag.label}</span>
                    </td>
                  </tr>,
                );

                return rows;
              })
            )}
          </tbody>
        </table>
      </section>
    </main>
  );
}
