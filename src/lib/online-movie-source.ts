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

type DraftOnlineMovie = OnlineMovieItem;

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const YOUKU_MOVIE_URL = "https://www.youku.com/ku/webmovie";
const IQIYI_NEW_ONLINE_URL =
  "https://www.iqiyi.com/newOnlinePCW?deviceId=9abd3d88d08f1d65da7036e973c139bd&v=12.112.20682";
const TENCENT_MOVIE_URL = "https://v.qq.com/channel/movie";
const TENCENT_PAGE_ID = "100173";
const RESERVATION_THRESHOLD = 5000;

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeUrl(url: string, base: string): string {
  if (!url) return "";
  if (url.startsWith("//")) return `https:${url}`;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("/")) return `${base}${url}`;
  return `${base}/${url}`;
}

function formatDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function parseOnlineDate(raw: string): string | null {
  const value = normalizeText(raw);
  const now = new Date();

  if (value.includes("今天")) {
    return formatDate(now);
  }

  if (value.includes("明天")) {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return formatDate(tomorrow);
  }

  const ymd = value.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (ymd) {
    const [, y, m, d] = ymd;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  const chineseYmd = value.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (chineseYmd) {
    const [, y, m, d] = chineseYmd;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  const monthDay = value.match(/(\d{1,2})月(\d{1,2})日/);
  if (!monthDay) return null;

  const [, m, d] = monthDay;
  const target = new Date(now.getFullYear(), Number.parseInt(m, 10) - 1, Number.parseInt(d, 10));
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (target < today) target.setFullYear(target.getFullYear() + 1);
  return formatDate(target);
}

function parseReservationCount(raw: string): number {
  const value = normalizeText(raw).replace(/,/g, "");
  const match = value.match(/(\d+(?:\.\d+)?)\s*万?人?(?:已)?预约/);
  if (!match) return 0;

  const count = Number.parseFloat(match[1]);
  if (!Number.isFinite(count)) return 0;
  return value.includes("万") ? Math.round(count * 10000) : Math.round(count);
}

function isLikelyMovie(title: string, actors = ""): boolean {
  const text = `${title} ${actors}`;
  if (/纪录|剧集|电视剧|综艺|动漫|漫剧|少儿|体育|课程/.test(text)) return false;
  return true;
}

async function fetchHtml(url: string, referer?: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      ...(referer ? { Referer: referer } : {}),
    },
    cache: "no-store",
  });

  if (!response.ok) return "";
  return response.text();
}

async function fetchJson<T>(url: string, body: unknown, referer: string): Promise<T | null> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": USER_AGENT,
      Referer: referer,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!response.ok) return null;
  return response.json() as Promise<T>;
}

async function fetchYoukuOnlineMovies(): Promise<DraftOnlineMovie[]> {
  const html = await fetchHtml(YOUKU_MOVIE_URL, "https://www.youku.com/");
  if (!html) return [];

  const $ = load(html);
  const rows: DraftOnlineMovie[] = [];

  $('div[class^="pack_title"], div[class*=" pack_title"]').each((_, el) => {
    const title = normalizeText($(el).text());
    const link = $(el).closest("a");
    const container = link.parent().parent();
    const status = normalizeText(container.find('div[class^="subtitle"], div[class*=" subtitle"]').first().text());
    const onlineDate = parseOnlineDate(status);
    const reservationCount = parseReservationCount(container.text());

    if (!title || !onlineDate || status.includes("敬请期待") || reservationCount < RESERVATION_THRESHOLD) return;

    rows.push({
      title,
      url: normalizeUrl(link.attr("href") ?? "", "https://v.youku.com"),
      onlineDate,
      platforms: ["优酷"],
      sourceName: "优酷电影",
      status: "上线",
      reservationCount,
      confidence: 90,
      coverUrl: normalizeUrl(link.find("img").first().attr("src") ?? "", "https://www.youku.com"),
    });
  });

  return rows;
}

async function fetchIqiyiOnlineMovies(): Promise<DraftOnlineMovie[]> {
  const html = await fetchHtml(IQIYI_NEW_ONLINE_URL, "https://www.iqiyi.com/");
  if (!html) return [];

  const $ = load(html);
  const rows: DraftOnlineMovie[] = [];

  $("a.vp__thumb__inner").each((_, el) => {
    const link = $(el);
    const title = normalizeText(link.find(".vp__thumb__title").first().text());
    const subs = link
      .find(".vp__thumb__sub")
      .toArray()
      .map((node) => normalizeText($(node).text()));
    const status = subs.find((item) => item.includes("上线")) ?? "";
    const actors = link
      .find(".vp__thumb__actorli")
      .toArray()
      .map((node) => normalizeText($(node).text()))
      .join("");
    const onlineDate = parseOnlineDate(status);
    const reservationCount = parseReservationCount(link.text());

    if (!title || !onlineDate || reservationCount < RESERVATION_THRESHOLD) return;
    if (!actors || !isLikelyMovie(title, actors)) return;

    rows.push({
      title,
      url: normalizeUrl(link.attr("href") ?? "", "https://www.iqiyi.com"),
      onlineDate,
      platforms: ["爱奇艺"],
      sourceName: "爱奇艺新片速递",
      status: "上线",
      reservationCount,
      confidence: 75,
      coverUrl: normalizeUrl(link.find("img.i71-img").first().attr("src") ?? "", "https://www.iqiyi.com"),
    });
  });

  return rows;
}

type TencentCard = {
  id?: string;
  type?: string;
  params?: Record<string, string | undefined>;
  children_list?: Record<string, { cards?: TencentCard[] } | undefined>;
  flip_infos?: {
    change?: Record<string, unknown>;
  };
};

type TencentPageResponse = {
  ret?: number;
  data?: {
    CardList?: TencentCard[];
  };
};

type TencentCardResponse = {
  ret?: number;
  data?: {
    card?: TencentCard;
  };
};

type TencentTab = {
  tab_mvl_sub_mod_id?: string;
  tab_name?: string;
  tab_type?: string;
};

function createTencentGuid(): string {
  return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
}

function getTencentChildCards(card: TencentCard | null | undefined): TencentCard[] {
  if (!card?.children_list) return [];
  return Object.values(card.children_list).flatMap((list) => list?.cards ?? []);
}

async function fetchTencentComingSoonCard(): Promise<TencentCard | null> {
  const guid = createTencentGuid();
  const pageUrl = `https://pbaccess.video.qq.com/trpc.vector_layout.page_view.PageService/getPage?video_appid=3000010&vversion_platform=2&vdevice_guid=${guid}`;
  const pageBody = {
    page_params: {
      page_type: "channel",
      page_id: TENCENT_PAGE_ID,
      scene: "channel",
      new_mark_label_enabled: "1",
      vl_to_mvl: "",
      free_watch_trans_info: '{"ad_frequency_control_time_list":{}}',
      ad_exp_ids: "100000+112426914",
      ams_cookies: "",
      ad_trans_data: '{"ad_request_id":"lazy-town","game_sessions":[]}',
      skip_privacy_types: "0",
      support_click_scan: "1",
    },
    page_bypass_params: {
      params: {
        platform_id: "2",
        caller_id: "3000010",
        data_mode: "default",
        user_mode: "default",
        specified_strategy: "",
        page_type: "channel",
        page_id: TENCENT_PAGE_ID,
        scene: "channel",
        new_mark_label_enabled: "1",
      },
      scene: "channel",
      app_version: "",
      abtest_bypass_id: guid,
    },
    page_context: null,
  };
  const page = await fetchJson<TencentPageResponse>(pageUrl, pageBody, TENCENT_MOVIE_URL);
  const bannerCard = page?.data?.CardList?.find((card) => card.params?.multi_tab?.includes("coming_soon"));
  if (!bannerCard?.params?.multi_tab || !bannerCard.flip_infos?.change) return null;

  const tabs = JSON.parse(bannerCard.params.multi_tab) as TencentTab[];
  const comingSoonTab = tabs.find((tab) => tab.tab_type === "coming_soon");
  if (!comingSoonTab) return null;

  const cardUrl =
    "https://pbaccess.video.qq.com/trpc.vector_layout.page_view.PageService/getCard?video_appid=3000010&vversion_platform=2";
  const cardBody = {
    page_params: {
      ...comingSoonTab,
      page_id: "scms_shake",
      page_type: "scms_shake",
      source_key: "",
      data_key: "",
      channel_id: "",
      channel_first_class: "",
      tag_id: "",
      tag_type: "",
      new_mark_label_enabled: "1",
    },
    page_context: {
      page_index: "1",
    },
    flip_info: bannerCard.flip_infos.change,
  };
  const result = await fetchJson<TencentCardResponse>(cardUrl, cardBody, TENCENT_MOVIE_URL);
  return result?.ret === 0 ? (result.data?.card ?? null) : null;
}

async function fetchTencentOnlineMovies(): Promise<DraftOnlineMovie[]> {
  const card = await fetchTencentComingSoonCard();
  const rows: DraftOnlineMovie[] = [];
  for (const item of getTencentChildCards(card)) {
    const params = item.params ?? {};
    const title = normalizeText(params.priority_title || params.title || "");
    const onlineDate = parseOnlineDate(params.online_time || "");
    const reservationCount = Number.parseInt(params.order_person_count || "", 10) || 0;

    if (!title || !onlineDate || reservationCount < RESERVATION_THRESHOLD) continue;

    rows.push({
      title,
      url: `https://v.qq.com/x/cover/${params.cid || item.id}.html`,
      onlineDate,
      platforms: ["腾讯视频"],
      sourceName: "腾讯视频电影",
      status: "上线",
      reservationCount,
      confidence: 85,
      coverUrl: normalizeUrl(params.priority_image_url || params.image_url || "", "https://v.qq.com"),
    });
  }

  return rows;
}

function mergeRows(rows: DraftOnlineMovie[]): OnlineMovieItem[] {
  const merged = new Map<string, DraftOnlineMovie>();

  for (const row of rows) {
    const key = `${row.title}-${row.onlineDate}`;
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, { ...row, platforms: [...row.platforms] });
      continue;
    }

    for (const platform of row.platforms) {
      if (!existing.platforms.includes(platform)) existing.platforms.push(platform);
    }

    if (row.reservationCount > existing.reservationCount) existing.reservationCount = row.reservationCount;
    if (row.confidence > existing.confidence) {
      existing.sourceName = row.sourceName;
      existing.url = row.url;
      existing.confidence = row.confidence;
      if (row.coverUrl) existing.coverUrl = row.coverUrl;
    }
  }

  return Array.from(merged.values()).sort((a, b) => a.onlineDate.localeCompare(b.onlineDate));
}

export async function fetchOnlineMovies(): Promise<OnlineMovieItem[]> {
  const results = await Promise.allSettled([
    fetchYoukuOnlineMovies(),
    fetchIqiyiOnlineMovies(),
    fetchTencentOnlineMovies(),
  ]);

  return mergeRows(results.flatMap((result) => (result.status === "fulfilled" ? result.value : [])));
}
