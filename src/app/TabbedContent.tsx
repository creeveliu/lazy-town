"use client";

import { useState } from "react";
import type { GameItem } from "@/lib/game-source";
import type { GlobalOnlineMovieItem } from "@/lib/global-online-movie-source";
import type { LaunchEventItem } from "@/lib/launch-source";
import type { MovieItem } from "@/lib/movie-source";
import type { OnlineMovieItem } from "@/lib/online-movie-source";

type TabbedContentProps = {
  games: GameItem[];
  movies: MovieItem[];
  onlineMovies: OnlineMovieItem[];
  globalOnlineMovies: GlobalOnlineMovieItem[];
  launchEvents: LaunchEventItem[];
  dbError: string;
  syncInfo: { status: string; createdAt: string } | null;
};

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

function onlineReservationTag(count: number): { label: string; level: "low" | "mid" | "high" } {
  if (count >= 50000) return { label: "爆款", level: "high" };
  if (count >= 10000) return { label: "热门", level: "mid" };
  return { label: "普通", level: "low" };
}

function globalPopularityTag(popularity: number, imdbVotes: number): { label: string; level: "low" | "mid" | "high" } {
  if (popularity >= 8 || imdbVotes >= 10000) return { label: "爆款", level: "high" };
  if (popularity >= 4 || imdbVotes >= 3000) return { label: "热门", level: "mid" };
  return { label: "普通", level: "low" };
}

function launchTimeLabel(event: LaunchEventItem): string {
  if (!event.startTime) return event.date.slice(5);

  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(event.startTime));
}

type ActiveTab = "games" | "movies" | "onlineMovies" | "launchEvents";

export default function TabbedContent({
  games,
  movies,
  onlineMovies,
  globalOnlineMovies,
  launchEvents,
  dbError,
  syncInfo,
}: TabbedContentProps) {
  const currentYear = new Date().getFullYear();
  const [activeTab, setActiveTab] = useState<ActiveTab>("games");
  const [onlineRegion, setOnlineRegion] = useState<"domestic" | "global">("domestic");
  const [showCalendar, setShowCalendar] = useState(false);

  const handleSubscribe = (path: string) => {
    window.location.href = `webcal://${window.location.host}${path}`;
  };

  const gameRows = games.map((game) => {
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
  });

  const movieRows = movies.flatMap((movie, index) => {
    const tag = movieWishTag(movie.wish);
    const year = Number.parseInt(movie.releaseDate.slice(0, 4), 10);
    const monthDay = movie.releaseDate.slice(5);

    const previousYear =
      index > 0 ? Number.parseInt(movies[index - 1].releaseDate.slice(0, 4), 10) : currentYear;

    const shouldShowYearHeader = year !== currentYear && year !== previousYear;
    const rows: React.ReactNode[] = [];

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
              className="cover global-cover"
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
  });

  const onlineMovieRows = onlineMovies.map((movie) => {
    const tag = onlineReservationTag(movie.reservationCount);
    const monthDay = movie.onlineDate ? movie.onlineDate.slice(5) : "待定";

    return (
      <tr key={movie.url}>
        <td>
          {movie.coverUrl ? (
            <img
              className="cover online-cover"
              src={proxiedImageUrl(movie.coverUrl, movie.url)}
              alt={movie.title}
              width={54}
              height={76}
              loading="lazy"
            />
          ) : (
            <div className="cover online-cover cover-placeholder">无图</div>
          )}
        </td>
        <td className={movie.onlineDate ? "mono" : ""}>{monthDay}</td>
        <td className="title-cell">
          <a href={movie.url} target="_blank" rel="noreferrer" className="title-link">
            {movie.title}
          </a>
        </td>
        <td>{movie.platforms.join(" / ")}</td>
        <td>
          <span className={`heat-tag heat-${tag.level}`}>{tag.label}</span>
        </td>
      </tr>
    );
  });

  const globalOnlineMovieRows = globalOnlineMovies.flatMap((movie, index) => {
    const tag = globalPopularityTag(movie.popularity, movie.imdbVotes);
    const year = Number.parseInt(movie.onlineDate.slice(0, 4), 10);
    const monthDay = movie.onlineDate.slice(5);
    const title = movie.title === movie.originalTitle ? movie.title : `${movie.title} / ${movie.originalTitle}`;
    const previousYear =
      index > 0 ? Number.parseInt(globalOnlineMovies[index - 1].onlineDate.slice(0, 4), 10) : currentYear;
    const shouldShowYearHeader = year !== currentYear && year !== previousYear;
    const rows: React.ReactNode[] = [];

    if (shouldShowYearHeader) {
      rows.push(
        <tr key={`global-year-${year}`} className="year-divider-row">
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
            {title}
          </a>
          {movie.tmdbScore ? <span className="score-badge">TMDB {movie.tmdbScore.toFixed(1)}</span> : null}
        </td>
        <td>{movie.platforms.join(" / ")}</td>
        <td>
          <span className={`heat-tag heat-${tag.level}`}>{tag.label}</span>
        </td>
      </tr>,
    );

    return rows;
  });

  const launchEventRows = launchEvents.map((event) => {
    const tag = heatTag(event.heat);
    const timeLabel = launchTimeLabel(event);

    return (
      <tr key={event.url}>
        <td className="mono">{timeLabel}</td>
        <td className="title-cell">
          <a href={event.url} target="_blank" rel="noreferrer" className="title-link">
            {event.title}
          </a>
        </td>
        <td>{event.platform}</td>
        <td>
          <span className={`heat-tag heat-${tag.level}`}>{tag.label}</span>
        </td>
      </tr>
    );
  });

  const emptyMessage = (type: string) =>
    dbError
      ? `数据库不可用：${dbError}`
      : `暂无${type}数据，请先访问 /api/sync 触发一次同步${syncInfo ? `（最近同步：${syncInfo.status}，${syncInfo.createdAt}）` : ""}`;

  return (
    <>
      <header className="header">
        <h1>专属兴趣日历</h1>
        <button className="calendar-btn" onClick={() => setShowCalendar(true)}>
          订阅日历
        </button>
      </header>

      <nav className="tab-bar" role="tablist">
        <button
          role="tab"
          aria-selected={activeTab === "games"}
          className={`tab-button ${activeTab === "games" ? "active" : ""}`}
          onClick={() => setActiveTab("games")}
        >
          游戏
        </button>
        <button
          role="tab"
          aria-selected={activeTab === "movies"}
          className={`tab-button ${activeTab === "movies" ? "active" : ""}`}
          onClick={() => setActiveTab("movies")}
        >
          院线电影
        </button>
        <button
          role="tab"
          aria-selected={activeTab === "onlineMovies"}
          className={`tab-button tab-button-with-switch ${activeTab === "onlineMovies" ? "active" : ""}`}
          onClick={() => setActiveTab("onlineMovies")}
        >
          <span>在线电影</span>
          {activeTab === "onlineMovies" ? (
            <span className={`inline-switch switch-${onlineRegion}`} aria-label="在线电影地区">
              <span className="inline-switch-thumb" aria-hidden="true" />
              <span
                role="button"
                tabIndex={0}
                className={`inline-switch-option ${onlineRegion === "domestic" ? "active" : ""}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setOnlineRegion("domestic");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.stopPropagation();
                    setOnlineRegion("domestic");
                  }
                }}
              >
                国内
              </span>
              <span
                role="button"
                tabIndex={0}
                className={`inline-switch-option ${onlineRegion === "global" ? "active" : ""}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setOnlineRegion("global");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.stopPropagation();
                    setOnlineRegion("global");
                  }
                }}
              >
                海外
              </span>
            </span>
          ) : null}
        </button>
        <button
          role="tab"
          aria-selected={activeTab === "launchEvents"}
          className={`tab-button ${activeTab === "launchEvents" ? "active" : ""}`}
          onClick={() => setActiveTab("launchEvents")}
        >
          发布会
        </button>
      </nav>

      <section className="table-wrap tab-panel" hidden={activeTab !== "games"}>
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
                  {emptyMessage("游戏")}
                </td>
              </tr>
            ) : (
              gameRows
            )}
          </tbody>
        </table>
      </section>

      <section className="table-wrap tab-panel" hidden={activeTab !== "movies"}>
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
                  {emptyMessage("电影")}
                </td>
              </tr>
            ) : (
              movieRows
            )}
          </tbody>
        </table>
      </section>

      <section className="table-wrap tab-panel" hidden={activeTab !== "onlineMovies"}>
        <table className="game-table">
          <thead>
            <tr>
              <th>封面</th>
              <th>上线日</th>
              <th>片名</th>
              <th>平台</th>
              <th>热度</th>
            </tr>
          </thead>
          <tbody>
            {onlineRegion === "domestic" && onlineMovies.length === 0 ? (
              <tr>
                <td colSpan={5} className="empty">
                  {emptyMessage("在线电影")}
                </td>
              </tr>
            ) : onlineRegion === "domestic" ? (
              onlineMovieRows
            ) : globalOnlineMovies.length === 0 ? (
              <tr>
                <td colSpan={5} className="empty">
                  {emptyMessage("海外流媒体")}
                </td>
              </tr>
            ) : (
              globalOnlineMovieRows
            )}
          </tbody>
        </table>
      </section>

      <section className="table-wrap tab-panel" hidden={activeTab !== "launchEvents"}>
        <table className="game-table launch-table">
          <thead>
            <tr>
              <th>北京时间</th>
              <th>发布会</th>
              <th>平台</th>
              <th>热度</th>
            </tr>
          </thead>
          <tbody>
            {launchEvents.length === 0 ? (
              <tr>
                <td colSpan={4} className="empty">
                  {emptyMessage("发布会")}
                </td>
              </tr>
            ) : (
              launchEventRows
            )}
          </tbody>
        </table>
      </section>

      {showCalendar && (
        <div className="modal-overlay" onClick={() => setShowCalendar(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowCalendar(false)} aria-label="关闭">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M2 2l10 10"/>
                <path d="M12 2L2 12"/>
              </svg>
            </button>
            <h2 className="modal-title">订阅日历</h2>
            <p className="modal-desc">点击即可订阅，日历会定期自动同步。</p>

            <div className="modal-links">
              <a
                className="modal-link"
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  handleSubscribe("/api/calendar/games");
                }}
              >
                <span className="modal-link-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="6" x2="10" y1="11" y2="11" />
                    <line x1="8" x2="8" y1="9" y2="13" />
                    <line x1="15" x2="15.01" y1="12" y2="12" />
                    <line x1="18" x2="18.01" y1="10" y2="10" />
                    <path d="M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0 0 17.32 5z" />
                  </svg>
                </span>
                <span className="modal-link-text">
                  <span className="modal-link-title">游戏</span>
                  <span className="modal-link-hint">PC / PS5 / Switch</span>
                </span>
              </a>

              <a
                className="modal-link"
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  handleSubscribe("/api/calendar/movies");
                }}
              >
                <span className="modal-link-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="18" height="18" x="3" y="3" rx="2" />
                    <path d="M7 3v18" />
                    <path d="M3 7.5h4" />
                    <path d="M3 12h18" />
                    <path d="M3 16.5h4" />
                    <path d="M17 3v18" />
                    <path d="M17 7.5h4" />
                    <path d="M17 16.5h4" />
                  </svg>
                </span>
                <span className="modal-link-text">
                  <span className="modal-link-title">院线电影</span>
                  <span className="modal-link-hint">近期热门电影</span>
                </span>
              </a>

              <a
                className="modal-link"
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  handleSubscribe("/api/calendar/online-movies");
                }}
              >
                <span className="modal-link-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="18" height="18" x="3" y="3" rx="2" />
                    <path d="M7 3v18" />
                    <path d="M3 7.5h4" />
                    <path d="M3 12h18" />
                    <path d="M17 3v18" />
                    <path d="m10 9 5 3-5 3Z" />
                  </svg>
                </span>
                <span className="modal-link-text">
                  <span className="modal-link-title">在线电影 · 国内</span>
                  <span className="modal-link-hint">爱奇艺 / 腾讯视频 / 优酷</span>
                </span>
              </a>

              <a
                className="modal-link"
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  handleSubscribe("/api/calendar/global-online-movies");
                }}
              >
                <span className="modal-link-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M2 12h20" />
                    <path d="M12 2a15.3 15.3 0 0 1 0 20" />
                    <path d="M12 2a15.3 15.3 0 0 0 0 20" />
                  </svg>
                </span>
                <span className="modal-link-text">
                  <span className="modal-link-title">在线电影 · 海外</span>
                  <span className="modal-link-hint">Netflix / Apple TV / Prime Video</span>
                </span>
              </a>

              <a
                className="modal-link"
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  handleSubscribe("/api/calendar/launch-events");
                }}
              >
                <span className="modal-link-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 7h16" />
                    <path d="M7 4v6" />
                    <path d="M17 4v6" />
                    <rect width="18" height="16" x="3" y="5" rx="2" />
                    <path d="M8 14h.01" />
                    <path d="M12 14h.01" />
                    <path d="M16 14h.01" />
                  </svg>
                </span>
                <span className="modal-link-text">
                  <span className="modal-link-title">发布会</span>
                  <span className="modal-link-hint">游戏 / 数码 / 开发者大会</span>
                </span>
              </a>
            </div>

            <p className="modal-tip">仅支持 Apple Calendar / Google Calendar / Outlook。</p>
          </div>
        </div>
      )}
    </>
  );
}
