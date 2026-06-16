// GD Music Studio API wrapper - the ONLY data source
// Docs: https://music-api.gdstudio.xyz/api.php
// sources: netease, kuwo, joox, tencent, migu, bilibili, ...

export type Source = "netease" | "kuwo" | "joox" | "tencent" | "migu" | "bilibili";

export interface GdTrack {
  id: string;
  url_id: string;
  name: string;
  artist: string;
  album: string;
  pic_id: string;
  lyric_id: string;
  source: Source;
}

export type QualityKey = "128" | "320" | "flac";

export interface PlayInfo {
  url: string;
  br: number; // actual bitrate returned
  size: number; // KB
}

const BASE = "https://music-api.gdstudio.xyz/api.php";

// CORS proxy fallback chain (browser can't call gdstudio directly)
const PROXIES: ((u: string) => string)[] = [
  (u) => u,
  (u) => `https://corsproxy.io/?url=${encodeURIComponent(u)}`,
  (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  (u) => `https://thingproxy.freeboard.io/fetch/${u}`,
];

const inflight = new Map<string, Promise<any | null>>();

async function gdFetch(params: Record<string, string | number>): Promise<any | null> {
  const url = new URL(BASE);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
  const target = url.toString();

  if (inflight.has(target)) return inflight.get(target)!;

  const task = (async () => {
    for (const wrap of PROXIES) {
      try {
        const res = await fetch(wrap(target), { headers: { Accept: "application/json" } });
        if (!res.ok) continue;
        const text = await res.text();
        try {
          return JSON.parse(text);
        } catch {
          continue;
        }
      } catch {
        // try next proxy
      }
    }
    return null;
  })();

  inflight.set(target, task);
  try {
    return await task;
  } finally {
    // allow re-fetch later but keep result cached in higher layers
    setTimeout(() => inflight.delete(target), 8000);
  }
}

export async function searchTracks(
  query: string,
  source: Source = "netease",
  count = 30
): Promise<GdTrack[]> {
  const data = await gdFetch({ types: "search", source, name: query, count, pages: 1 });
  if (!Array.isArray(data)) return [];
  return data.map((t: any) => ({
    id: String(t.id),
    url_id: String(t.url_id ?? t.id),
    name: t.name ?? "—",
    artist: Array.isArray(t.artist) ? t.artist.join("، ") : t.artist || "—",
    album: t.album || "—",
    pic_id: t.pic_id || "",
    lyric_id: String(t.lyric_id ?? t.id),
    source,
  }));
}

const BR_MAP: Record<QualityKey, number> = { "128": 128, "320": 320, flac: 999 };

// fetch a playable URL with graceful quality fallback
export async function getPlayInfo(
  source: Source,
  id: string,
  quality: QualityKey = "128"
): Promise<PlayInfo | null> {
  const order: QualityKey[] =
    quality === "flac" ? ["flac", "320", "128"] : quality === "320" ? ["320", "128"] : ["128"];

  for (const q of order) {
    const data = await gdFetch({ types: "url", source, id, br: BR_MAP[q] });
    if (data && typeof data.url === "string" && data.url.startsWith("http")) {
      return { url: data.url, br: data.br ?? BR_MAP[q], size: data.size ?? 0 };
    }
  }
  return null;
}

// Construct cover URL directly when possible (no API call, avoids rate limit)
export function constructCover(source: Source, pic_id: string): string | null {
  if (!pic_id) return null;
  if (source === "kuwo") {
    const rest = pic_id.startsWith("120/") ? pic_id.slice(4) : pic_id;
    return `https://img2.kuwo.cn/star/albumcover/500/${rest}`;
  }
  if (source === "joox") {
    return `https://image.joox.com/JOOXcover/0/${pic_id}/500`;
  }
  return null;
}

// Cover cache (netease/tencent need an API call)
const COVER_CACHE_KEY = "nova_covers_v1";
function loadCoverCache(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(COVER_CACHE_KEY) || "{}");
  } catch {
    return {};
  }
}

const coverCache = loadCoverCache();

export async function fetchCover(track: GdTrack): Promise<string | null> {
  const direct = constructCover(track.source, track.pic_id);
  if (direct) return direct;

  const cacheKey = `${track.source}:${track.pic_id}`;
  if (coverCache[cacheKey]) return coverCache[cacheKey];

  const data = await gdFetch({ types: "pic", source: track.source, id: track.pic_id, size: 500 });
  if (data && typeof data.url === "string" && data.url.startsWith("http")) {
    coverCache[cacheKey] = data.url;
    try {
      localStorage.setItem(COVER_CACHE_KEY, JSON.stringify(coverCache));
    } catch {
      // storage full, ignore
    }
    return data.url;
  }
  return null;
}
