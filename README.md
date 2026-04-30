# 热门游戏 / 院线电影 / 在线电影日历

一个极简风格的兴趣日历网站：
- 游戏数据源：第三方发售表（PC / PS5 / Switch）
- 院线电影数据源：豆瓣即将上映表
- 在线电影数据源：爱奇艺 / 腾讯视频 / 优酷等流媒体平台
- 范围：未来 1 年
- 游戏筛选：热度 > 4000
- 在线电影筛选：预约数 >= 5000
- 排序：按发售/上映/上线日期升序
- 展示：表格 + 小海报 + 热度标签（普通 / 热门 / 爆款）
- 架构：抓取后入库，页面只读数据库（Vercel 友好）

## 技术栈

- Next.js 16 (App Router)
- TypeScript
- Cheerio（服务端解析页面）
- Neon Postgres（`DATABASE_URL`）

## 本地运行

```bash
npm install
npm run dev
```

默认访问：
- http://localhost:3000
- 若 3000 被占用，Next 会自动换端口（如 3001）

## 环境变量

在 `.env.local` 中配置：

```bash
DATABASE_URL=postgres://...
CRON_SECRET=your-secret
```

## 首次同步数据

启动后手动触发一次：

```bash
curl "http://localhost:3000/api/sync?secret=your-secret"
```

## 项目结构

- `src/app/page.tsx`：首页表格页面
- `src/lib/game-source.ts`：抓取与筛选逻辑
- `src/lib/movie-source.ts`：电影放映抓取与筛选逻辑
- `src/lib/online-movie-source.ts`：在线电影上线抓取与筛选逻辑
- `src/lib/db.ts`：数据库读写与同步
- `src/app/api/sync/route.ts`：同步接口（可给 Cron 调用）
- `src/app/api/image/route.ts`：海报代理接口（解决外链图床限制）

## 部署到 Vercel

1. 首次登录

```bash
npx vercel login
```

2. 预览部署

```bash
npx vercel
```

3. 生产部署

```bash
npx vercel --prod
```

## 注意事项

- 页面不再实时抓源站，速度更快；数据更新依赖 `/api/sync`。
- 源站结构变化会影响抓取，请关注同步日志。
- 当前版本支持“游戏 + 院线电影 + 在线电影”三表格。

## TODO

- [ ] 为 iOS/Web 统一提供只读接口：`GET /api/games`（返回 `title/url/releaseDate/platforms/coverUrl/heatTag`，不暴露热度数字）
