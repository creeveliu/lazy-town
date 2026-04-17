import { getGamesFromDb, getLatestSyncInfo } from "@/lib/db";
import type { GameItem } from "@/lib/game-source";

export const dynamic = "force-dynamic";

function proxiedImageUrl(url: string): string {
  return `/api/image?url=${encodeURIComponent(url)}`;
}

function heatTag(heat: number): { label: string; level: "low" | "mid" | "high" } {
  if (heat >= 20000) return { label: "爆款", level: "high" };
  if (heat >= 10000) return { label: "热门", level: "mid" };
  return { label: "普通", level: "low" };
}

export default async function Home() {
  let games: GameItem[] = [];
  let syncInfo: { status: string; createdAt: string } | null = null;
  let dbError = "";

  try {
    [games, syncInfo] = await Promise.all([getGamesFromDb(), getLatestSyncInfo()]);
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
                  <td className="mono">{game.releaseDate}</td>
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
              )})
            )}
          </tbody>
        </table>
      </section>
    </main>
  );
}
