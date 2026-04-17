# 热门游戏发售表

一个极简风格的游戏发售网站：
- 数据源：游民星空发售表（PC / PS5 / Switch）
- 范围：未来 1 年
- 筛选：热度 > 4000
- 排序：按发售日期升序
- 展示：表格 + 小海报 + 热度标签（普通 / 热门 / 爆款）

## 技术栈

- Next.js 16 (App Router)
- TypeScript
- Cheerio（服务端解析页面）

## 本地运行

```bash
npm install
npm run dev
```

默认访问：
- http://localhost:3000
- 若 3000 被占用，Next 会自动换端口（如 3001）

## 项目结构

- `src/app/page.tsx`：首页表格页面
- `src/lib/gamersky.ts`：抓取与筛选逻辑
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

- 页面是服务端抓取实时数据，源站结构变化会影响抓取。
- 当前版本只做“游戏”，电影功能后续再接入。
