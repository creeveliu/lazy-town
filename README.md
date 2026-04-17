# 热门游戏发售表

一个极简风格的游戏发售网站：
- 数据源：第三方发售表（PC / PS5 / Switch）
- 范围：未来 1 年
- 筛选：热度 > 4000
- 排序：按发售日期升序
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
- 当前版本只做“游戏”，电影功能后续再接入。
