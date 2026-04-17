import { fetchHotUpcomingGames } from "@/lib/gamersky";

export const revalidate = 21600;

function proxiedImageUrl(url: string): string {
  return `/api/image?url=${encodeURIComponent(url)}`;
}

function heatTag(heat: number): { label: string; level: "low" | "mid" | "high" } {
  if (heat >= 20000) return { label: "爆款", level: "high" };
  if (heat >= 10000) return { label: "热门", level: "mid" };
  return { label: "普通", level: "low" };
}

export default async function Home() {
  const games = await fetchHotUpcomingGames();

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
                  暂无满足条件的游戏
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
