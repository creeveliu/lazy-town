# 在线电影日历实现计划

> **给 Claude:** 必须使用 `superpowers:executing-plans`，按任务逐步执行本计划。

**目标：** 增加 `在线电影` tab，并提供流媒体电影上线日历订阅。

**架构：** 沿用当前“抓取后入库，页面只读数据库”的模式。新增 `online_movies` 表、一个抓取模块、一个数据库读取函数、一个 ICS 路由，并在现有表格 UI 中增加第三个 tab。在线电影抓取失败时，不阻断游戏和院线电影同步。

**技术栈：** Next.js App Router、TypeScript、Cheerio、Neon Postgres、普通 CSS、现有 `/api/sync` 定时同步流程。

---

### 任务 1：新增在线电影类型和解析模块

**文件：**
- 新建：`src/lib/online-movie-source.ts`

**步骤 1：创建模块和导出类型**

添加：

```ts
import { load } from "cheerio";

export type OnlineMovieItem = {
  title: string;
  url: string;
  onlineDate: string;
  platforms: string[];
  sourceName: string;
  status: string;
  reservationCount: number;
  confidence: number;
  coverUrl: string;
};
```

**步骤 2：添加日期解析 helper**

支持：
- `YYYY-MM-DD`
- `M月D日`
- `YYYY年M月D日`
- `今天`
- `明天`

无年份日期按当前年份解析；如果解析出的日期早于今天，则按下一年处理。

**步骤 3：实现优酷抓取**

第一版先抓稳定可解析的优酷电影频道：

```ts
const YOUKU_MOVIE_URL = "https://www.youku.com/ku/webmovie";
```

解析 `pack_title` 和相邻 `subtitle`，只保留包含明确上线日期的条目，忽略 `敬请期待`。

实测可抓到示例：
- `神秘美人鱼2之虐心爱恋`：明天 10:00 上线
- `变异双头蛇`：5月3日 10:00 上线
- `东北往事·极恶不赦`：5月3日 10:00 上线

**步骤 4：实现爱奇艺抓取**

抓取爱奇艺新片速递页：

```ts
const IQIYI_NEW_ONLINE_URL = "https://www.iqiyi.com/newOnlinePCW?deviceId=9abd3d88d08f1d65da7036e973c139bd&v=12.112.20682";
```

解析 `vp__thumb__title`、`vp__thumb__sub`、封面和链接。只保留包含 `上线` 日期的条目。

注意：该页会混入纪录片/剧集，第一版需要做保守过滤。无法确认是电影的条目先不入库。

**步骤 5：实现腾讯视频抓取**

抓取腾讯视频电影频道：

```ts
const TENCENT_MOVIE_URL = "https://v.qq.com/channel/movie";
```

腾讯的 `即将上线` tab 在页面里可见，但 raw HTML 不一定直接包含最终渲染列表。实现时优先找页面内的频道配置和接口参数；如果找不到稳定接口，再考虑用轻量浏览器渲染抓取。

需要解析：
- 片名
- 上线日期，如 `明天 10:00`、`5月3日`
- 预约人数，如 `1.4万人预约`
- 封面
- 详情链接

实测页面可见示例：
- `六六大顺`：明天 10:00，`1.4万人预约`
- `东北往事·极恶不赦`：5月3日，`1.1万人预约`
- `画梦录`：敬请期待，`8364人预约`

`敬请期待` 无明确日期，第一版不进入日历。

**步骤 6：加入预约热度过滤**

在线电影只保留达到阈值的条目，避免 tab 里都是冷门长尾。

第一版规则：
- `reservationCount >= 5000` 才入库
- `普通`：`5000 <= reservationCount < 10000`
- `热门`：`10000 <= reservationCount < 50000`
- `爆款`：`reservationCount >= 50000`

页面不展示具体预约数字，只展示标签。

**步骤 7：导出抓取函数**

导出：

```ts
export async function fetchOnlineMovies(): Promise<OnlineMovieItem[]>
```

合并同名同日期条目，平台字段合并为 `优酷 / 爱奇艺 / 腾讯视频` 等，预约数取各来源最大值，按 `onlineDate ASC` 排序。

**步骤 8：运行 lint**

运行：

```bash
npm run lint
```

预期：退出码 0；现有 `<img>` warning 可接受。

**步骤 9：提交**

```bash
git add src/lib/online-movie-source.ts
git commit -m "feat: add online movie source parser"
```

### 任务 2：新增数据库存储

**文件：**
- 修改：`src/lib/db.ts`

**步骤 1：导入在线电影模块**

导入 `fetchOnlineMovies` 和 `OnlineMovieItem`。

**步骤 2：新增数据库 row 类型**

添加 `DbOnlineMovieRow`，字段包括：

```ts
title, source_url, online_date, platforms, source_name, status, reservation_count, confidence, cover_url
```

**步骤 3：扩展 schema**

在 `ensureSchema()` 中创建 `online_movies` 表：

```sql
CREATE TABLE IF NOT EXISTS online_movies (
  id BIGSERIAL PRIMARY KEY,
  source_url TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  online_date DATE NOT NULL,
  platforms TEXT[] NOT NULL,
  source_name TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT '',
  reservation_count INTEGER NOT NULL DEFAULT 0,
  confidence INTEGER NOT NULL DEFAULT 0,
  cover_url TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)
```

新增 `online_date` 索引。

**步骤 4：新增读取函数**

添加：

```ts
export async function getOnlineMoviesFromDb(): Promise<OnlineMovieItem[]>
```

查询条件：
- `online_date >= CURRENT_DATE`
- `online_date <= CURRENT_DATE + 365 days`
- 按 `online_date ASC` 排序

**步骤 5：更新同步逻辑**

在 `syncGamesToDb()` 中同步在线电影：
- 调用 `fetchOnlineMovies()`
- 全量重建 `online_movies`
- 插入 `source_url / title / online_date / platforms / source_name / status / reservation_count / confidence / cover_url`

在线电影抓取异常时记录为空数组，不影响游戏和院线电影同步。

**步骤 6：运行 build**

运行：

```bash
npm run build
```

预期：退出码 0。

**步骤 7：提交**

```bash
git add src/lib/db.ts
git commit -m "feat: store online movie releases"
```

### 任务 3：新增在线电影日历 API

**文件：**
- 新建：`src/app/api/calendar/online-movies/route.ts`

**步骤 1：复用 ICS helper**

参考 `src/app/api/calendar/movies/route.ts`，复用文本转义和日期格式化逻辑。

**步骤 2：生成事件**

从 `getOnlineMoviesFromDb()` 读取数据。

事件格式：

```text
SUMMARY:片名 上线 平台
DESCRIPTION:平台 / 来源 / 来源链接
URL:source_url
```

**步骤 3：设置日历元信息**

使用：

```text
PRODID:-//LazyTown//OnlineMovieCalendar//CN
X-WR-CALNAME:在线电影
```

**步骤 4：运行 build**

运行：

```bash
npm run build
```

预期：路由列表包含 `/api/calendar/online-movies`。

**步骤 5：提交**

```bash
git add src/app/api/calendar/online-movies/route.ts
git commit -m "feat: add online movie calendar feed"
```

### 任务 4：前端增加第三个 tab

**文件：**
- 修改：`src/app/page.tsx`
- 修改：`src/app/TabbedContent.tsx`
- 如有必要小幅修改：`src/app/globals.css`

**步骤 1：首页读取在线电影**

导入 `getOnlineMoviesFromDb()` 和 `OnlineMovieItem`。

把 `onlineMovies` 传给 `TabbedContent`。

**步骤 2：更新 tab 名称**

把现有 `电影` tab 改为 `院线电影`。

新增第三个 tab：`在线电影`。

**步骤 3：渲染在线电影表格**

列为：

```text
海报 / 上线日 / 片名 / 平台 / 热度
```

热度显示 `普通 / 热门 / 爆款`，不展示预约数字。

**步骤 4：更新订阅弹窗**

增加第三个订阅入口：`/api/calendar/online-movies`。

**步骤 5：运行 lint 和 build**

运行：

```bash
npm run lint
npm run build
```

预期：两个命令退出码均为 0；现有 `<img>` warning 可接受。

**步骤 6：提交**

```bash
git add src/app/page.tsx src/app/TabbedContent.tsx src/app/globals.css
git commit -m "feat: add online movie tab"
```

### 任务 5：更新文档和 AGENTS

**文件：**
- 修改：`AGENTS.md`
- 修改：`README.md`
- 修改：`docs/2026-04-17-current-implementation.md`

**步骤 1：更新产品说明**

说明当前有三个 tab：

```text
游戏 / 院线电影 / 在线电影
```

**步骤 2：记录同步和日历路由**

新增 `/api/calendar/online-movies`。

**步骤 3：运行 lint**

运行：

```bash
npm run lint
```

预期：退出码 0；现有 `<img>` warning 可接受。

**步骤 4：提交**

```bash
git add AGENTS.md README.md docs/2026-04-17-current-implementation.md
git commit -m "docs: document online movie calendar"
```

### 任务 6：手动数据验证

**文件：**
- 通常不需要改代码。

**步骤 1：本地启动服务**

运行：

```bash
npm run dev
```

**步骤 2：如果有 `DATABASE_URL`，触发同步**

运行：

```bash
curl "http://localhost:3000/api/sync?secret=$CRON_SECRET"
```

预期：JSON 中包含在线电影同步数量。

**步骤 3：检查日历接口**

运行：

```bash
curl -s "http://localhost:3000/api/calendar/online-movies" | head -40
```

预期：包含 `BEGIN:VCALENDAR`；如果数据库有数据，至少包含一个 `VEVENT`。

**步骤 4：抽样核对来源**

打开 3 条来源链接，确认：
- 片名一致
- 上线日期一致
- 平台一致

**步骤 5：最终验证**

运行：

```bash
npm run lint
npm run build
```

预期：两个命令退出码均为 0。
