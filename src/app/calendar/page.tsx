"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function CalendarSubscribe() {
  const [host, setHost] = useState("");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHost(window.location.host);
  }, []);

  return (
    <main className="container">
      <header className="header">
        <h1>订阅日历</h1>
        <p>点击链接即可订阅，数据会自动同步更新。</p>
      </header>

      {host && (
        <div className="subscribe-list">
          <a className="subscribe-card" href={`webcal://${host}/api/calendar/games`}>
            <span className="subscribe-emoji">📅</span>
            <div className="subscribe-info">
              <span className="subscribe-title">游戏发售表</span>
              <span className="subscribe-desc">PC / PS5 / Switch 热门游戏</span>
            </div>
            <span className="subscribe-arrow">→</span>
          </a>

          <a className="subscribe-card" href={`webcal://${host}/api/calendar/movies`}>
            <span className="subscribe-emoji">🎬</span>
            <div className="subscribe-info">
              <span className="subscribe-title">电影上映表</span>
              <span className="subscribe-desc">近期热门电影</span>
            </div>
            <span className="subscribe-arrow">→</span>
          </a>
        </div>
      )}

      <Link className="back-link" href="/">← 返回</Link>
    </main>
  );
}
