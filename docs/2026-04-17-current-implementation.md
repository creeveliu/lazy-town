# 当前实现说明（2026-04-17）

## 项目目标

已实现一个面向中文用户的「热门游戏 + 院线电影 + 在线电影」兴趣日历网站，优先保证：
- 极简展示
- Vercel 可部署
- 页面访问速度稳定（读数据库，不实时抓源站）

## 已实现功能

1. 页面与交互
- 首页包含三个 tab：`游戏`、`院线电影`、`在线电影`
- 游戏字段：`海报 / 发售日 / 游戏名 / 平台 / 热度`
- 院线电影字段：`海报 / 上映日 / 电影名 / 类型&地区 / 热度`
- 在线电影字段：`海报 / 上线日 / 片名 / 平台 / 热度`
- 标题可点击跳转外部详情页
- 热度不展示数字，展示标签：`普通 / 热门 / 爆款`
- 移动端适配：收窄布局，避免横向可读性问题

2. 数据源与筛选
- 游戏数据源：第三方发售页（PC / PS5 / Switch）
- 院线电影数据源：豆瓣即将上映页（`movie.douban.com/coming`）
- 在线电影数据源：爱奇艺 / 腾讯视频 / 优酷等流媒体平台
- 时间范围：未来 1 年
- 游戏热度阈值：`> 4000`
- 在线电影预约阈值：`>= 5000`
- 排序：按发售/上映/上线日期升序
- 跨平台去重：按片名与日期合并平台字段

3. 抓取与存储架构
- 游戏抓取模块：`src/lib/game-source.ts`
- 院线电影抓取模块：`src/lib/movie-source.ts`
- 在线电影抓取模块：`src/lib/online-movie-source.ts`
- 数据库存取：`src/lib/db.ts`
- 数据库：Neon Postgres（通过 Vercel Integration 接入）
- 页面读取：首页仅从数据库读取，不在请求时抓取源站

4. 同步能力
- 同步接口：`/api/sync`（GET/POST）
- 支持 `CRON_SECRET` 鉴权（Header 或 query）
- 同步逻辑：抓取 -> 过滤 -> 全量重建 `games` / `movies` / `online_movies` 表
- 同步日志：写入 `sync_logs`

5. 日历订阅
- 游戏：`/api/calendar/games`
- 院线电影：`/api/calendar/movies`
- 在线电影：`/api/calendar/online-movies`

6. 定时任务
- `vercel.json` 已配置 Cron：
  - path: `/api/sync`
  - schedule: `0 1 * * *` (UTC)

7. 图片处理
- 海报通过站内代理接口输出：`/api/image`
- 解决第三方图床限制导致的加载失败问题

## 数据库结构

`games`
- `source_url` (唯一)
- `title`
- `release_date`
- `heat`
- `platforms` (TEXT[])
- `cover_url`
- `updated_at`

`movies`
- `source_url` (唯一)
- `title`
- `release_date`
- `wish`
- `genres`
- `country`
- `cover_url`
- `updated_at`

`online_movies`
- `source_url` (唯一)
- `title`
- `online_date`
- `platforms` (TEXT[])
- `source_name`
- `status`
- `reservation_count`
- `confidence`
- `cover_url`
- `updated_at`

`sync_logs`
- `status`
- `synced_count`
- `duration_ms`
- `error_message`
- `created_at`

## 线上状态

- 生产地址：`https://lazy-town.vercel.app`
- 已完成 Neon 资源接入
- `DATABASE_URL` 已注入 Vercel 环境
- 数据更新依赖 `/api/sync`

## 当前约束与后续建议

1. 当前约束
- 仍依赖源站 HTML 结构，源站改版会影响抓取
- 在线电影只收有明确上线日期且达到预约阈值的条目

2. 建议迭代
- 增加后台同步状态页（仅管理员）
- 给抓取增加失败重试与告警
- 增加数据快照与回滚能力
