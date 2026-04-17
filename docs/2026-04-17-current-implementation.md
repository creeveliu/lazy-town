# 当前实现说明（2026-04-17）

## 项目目标

已实现一个面向中文用户的「热门游戏发售表」网站，优先保证：
- 极简展示
- Vercel 可部署
- 页面访问速度稳定（读数据库，不实时抓源站）

## 已实现功能

1. 页面与交互
- 首页标题：`热门游戏发售表`
- 表格字段：`海报 / 发售日 / 游戏名 / 平台 / 热度`
- 游戏名可点击跳转外部详情页
- 热度不展示数字，展示标签：`普通 / 热门 / 爆款`
- 移动端适配：收窄布局，避免横向可读性问题

2. 数据源与筛选
- 数据源：游民星空发售页（PC / PS5 / Switch）
- 时间范围：未来 1 年
- 热度阈值：`> 4000`
- 排序：按发售日期升序（同日按热度降序）
- 跨平台去重：按源链接合并平台字段

3. 抓取与存储架构
- 抓取模块：`src/lib/gamersky.ts`
- 数据库存取：`src/lib/db.ts`
- 数据库：Neon Postgres（通过 Vercel Integration 接入）
- 页面读取：首页仅从数据库读取，不在请求时抓取源站

4. 同步能力
- 同步接口：`/api/sync`（GET/POST）
- 支持 `CRON_SECRET` 鉴权（Header 或 query）
- 同步逻辑：抓取 -> 过滤 -> 全量重建 `games` 表
- 同步日志：写入 `sync_logs`

5. 定时任务
- `vercel.json` 已配置 Cron：
  - path: `/api/sync`
  - schedule: `0 1 * * *` (UTC)

6. 图片处理
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
- 已验证手动同步成功（示例：`syncedCount = 10`）

## 当前约束与后续建议

1. 当前约束
- 仅实现游戏模块（电影模块未接入）
- 仍依赖源站 HTML 结构，源站改版会影响抓取

2. 建议迭代
- 增加后台同步状态页（仅管理员）
- 给抓取增加失败重试与告警
- 增加数据快照与回滚能力
