import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronDown, Heart, Home, Loader2, Mic2, Music2,
  Pause, Play, Repeat, Search, SkipBack, SkipForward,
  Shuffle, Sparkles, Volume2, X, ListMusic, Clock, ArrowLeft,
} from "lucide-react";
import {
  searchTracks, getPlayInfo, fetchCover, constructCover,
  type GdTrack, type Source, type QualityKey, type PlayInfo,
} from "./lib/gdstudio";

// ── Types ────────────────────────────────────────────────────────────────────
type View = "home" | "search" | "artist" | "queue" | "history" | "favorites";

// ── Constants ────────────────────────────────────────────────────────────────
const SOURCES: { id: Source; name: string; icon: string }[] = [
  { id: "netease", name: "نت‌ایز", icon: "🎶" },
  { id: "kuwo",    name: "کووو",   icon: "🎧" },
  { id: "joox",    name: "جاکس",   icon: "🎵" },
  { id: "tencent", name: "کیوکیو", icon: "🎼" },
];

const QUALITIES: { key: QualityKey; label: string }[] = [
  { key: "128",  label: "۱۲۸" },
  { key: "320",  label: "۳۲۰" },
  { key: "flac", label: "FLAC" },
];

const QUICK_TAGS = [
  { label: "داریوش",    query: "Dariush" },
  { label: "گوگوش",    query: "Googoosh" },
  { label: "ابی",       query: "Ebi" },
  { label: "هایده",    query: "Hayedeh" },
  { label: "ستار",     query: "Sattar" },
  { label: "نمجو",     query: "Mohsen Namjoo" },
  { label: "مازیار",   query: "Maziar" },
  { label: "ویگن",     query: "Vigen" },
];

const HOME_ARTISTS = [
  "Dariush", "Googoosh", "Ebi", "Hayedeh", "Morteza",
  "Sattar", "Mohsen Namjoo", "Homayoun Shajarian",
  "Reza Sadeghi", "Maziar", "Vigen", "Mahasti",
];

const ARTIST_META: { query: string; label: string; genre: string }[] = [
  { query: "Dariush",          label: "داریوش",          genre: "پاپ کلاسیک" },
  { query: "Googoosh",         label: "گوگوش",           genre: "پاپ" },
  { query: "Ebi",              label: "ابی",              genre: "پاپ کلاسیک" },
  { query: "Hayedeh",          label: "هایده",            genre: "سنتی" },
  { query: "Sattar",           label: "ستار",             genre: "پاپ" },
  { query: "Mohsen Namjoo",    label: "محسن نامجو",      genre: "راک / تجربی" },
  { query: "Reza Sadeghi",     label: "رضا صادقی",       genre: "پاپ" },
  { query: "Maziar",           label: "مازیار",           genre: "پاپ" },
];

const GRADIENTS = [
  ["#6366f1", "#8b5cf6", "#a855f7"],
  ["#ec4899", "#f43f5e", "#fb7185"],
  ["#06b6d4", "#3b82f6", "#6366f1"],
  ["#10b981", "#06b6d4", "#3b82f6"],
  ["#f59e0b", "#f97316", "#ef4444"],
  ["#8b5cf6", "#ec4899", "#f43f5e"],
];

function getGrad(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return GRADIENTS[h % GRADIENTS.length];
}

function fmt(s: number) {
  if (!s || !isFinite(s)) return "0:00";
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}

function qualLabel(br: number) {
  if (br >= 700) return "FLAC";
  if (br >= 320) return "320";
  return "128";
}

// ── Cover Art ────────────────────────────────────────────────────────────────
function CoverArt({
  track, size = 56, radius = 14, className = "",
}: {
  track: GdTrack; size?: number; radius?: number; className?: string;
}) {
  const [url, setUrl] = useState<string | null>(() => constructCover(track.source, track.pic_id));
  const [err, setErr] = useState(false);

  useEffect(() => {
    let alive = true;
    const direct = constructCover(track.source, track.pic_id);
    if (direct) { setUrl(direct); return; }
    setUrl(null);
    fetchCover(track).then(u => { if (alive && u) setUrl(u); });
    return () => { alive = false; };
  }, [track.source, track.pic_id]);

  const g = getGrad(track.url_id);
  const style: React.CSSProperties = { width: size, height: size, borderRadius: radius, flexShrink: 0, objectFit: "cover" };

  if (!url || err) {
    return (
      <div className={`flex items-center justify-center ${className}`}
        style={{ ...style, background: `linear-gradient(135deg,${g[0]},${g[1]},${g[2]})` }}>
        <Music2 size={size * 0.35} color="rgba(255,255,255,0.7)" />
      </div>
    );
  }
  return (
    <img src={url} alt={track.name} onError={() => setErr(true)}
      className={className} style={style} />
  );
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ msg }: { msg: string | null }) {
  return (
    <AnimatePresence>
      {msg && (
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
          className="fixed z-[99] left-1/2 -translate-x-1/2 bottom-28 rounded-full px-5 py-2.5 text-sm font-medium text-white pointer-events-none whitespace-nowrap"
          style={{ background: "rgba(255,255,255,0.16)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.22)" }}>
          {msg}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Track Row ────────────────────────────────────────────────────────────────
function TrackRow({
  track, index, isCurrent, isPlaying, isFav, onPlay, onFav, accent,
}: {
  track: GdTrack; index: number; isCurrent: boolean; isPlaying: boolean;
  isFav: boolean; onPlay: () => void; onFav: () => void; accent: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03, duration: 0.25 }}
      onClick={onPlay}
      className="flex items-center gap-3 rounded-[18px] p-3 mb-2 cursor-pointer active:scale-[0.98] transition-transform"
      style={{
        background: isCurrent ? `${accent}28` : "rgba(255,255,255,0.04)",
        border: `1px solid ${isCurrent ? accent + "55" : "rgba(255,255,255,0.07)"}`,
      }}>
      <div className="relative shrink-0">
        <CoverArt track={track} size={48} radius={12} />
        {isCurrent && (
          <div className="absolute inset-0 flex items-center justify-center rounded-xl"
            style={{ background: "rgba(0,0,0,0.48)" }}>
            {isPlaying
              ? <Pause size={16} fill="white" color="white" />
              : <Play size={16} fill="white" color="white" />}
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate"
          style={{ color: isCurrent ? accent : "white" }}>{track.name}</p>
        <p className="text-xs truncate mt-0.5" style={{ color: "rgba(255,255,255,0.45)" }}>
          {track.artist} · {track.source}
        </p>
      </div>
      <button onClick={e => { e.stopPropagation(); onFav(); }}
        className="w-[34px] h-[34px] rounded-full flex items-center justify-center shrink-0"
        style={{ background: "rgba(255,255,255,0.07)" }}>
        <Heart size={15} fill={isFav ? "#f43f5e" : "none"} color={isFav ? "#f43f5e" : "rgba(255,255,255,0.4)"} />
      </button>
    </motion.div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [view, setView]                   = useState<View>("home");
  const [source, setSource]               = useState<Source>("netease");
  const [homeTracks, setHomeTracks]       = useState<GdTrack[]>([]);
  const [searchResults, setSearchResults] = useState<GdTrack[]>([]);
  const [artistTracks, setArtistTracks]   = useState<GdTrack[]>([]);
  const [selArtist, setSelArtist]         = useState<typeof ARTIST_META[0] | null>(null);
  const [query, setQuery]                 = useState("");
  const [current, setCurrent]             = useState<GdTrack | null>(null);
  const [playInfo, setPlayInfo]           = useState<PlayInfo | null>(null);
  const [quality, setQuality]             = useState<QualityKey>("128");
  const [playing, setPlaying]             = useState(false);
  const [loadingUrl, setLoadingUrl]       = useState(false);
  const [loadingHome, setLoadingHome]     = useState(true);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [loadingArtist, setLoadingArtist] = useState(false);
  const [progress, setProgress]           = useState(0);
  const [curTime, setCurTime]             = useState(0);
  const [duration, setDuration]           = useState(0);
  const [favorites, setFavorites]         = useState<GdTrack[]>(() => {
    try { return JSON.parse(localStorage.getItem("nova_fav_v2") || "[]"); } catch { return []; }
  });
  const [queue, setQueue]                 = useState<GdTrack[]>([]);
  const [history, setHistory]             = useState<GdTrack[]>(() => {
    try { return JSON.parse(localStorage.getItem("nova_hist_v2") || "[]"); } catch { return []; }
  });
  const [showFull, setShowFull]           = useState(false);
  const [showLyrics, setShowLyrics]       = useState(false);
  const [shuffle, setShuffle]             = useState(false);
  const [repeat, setRepeat]               = useState(false);
  const [vol, setVol]                     = useState(80);
  const [toast, setToast]                 = useState<string | null>(null);
  const [showSourcePicker, setShowSourcePicker] = useState(false);

  const audioRef = useRef<HTMLAudioElement>(null);

  const showToast = useCallback((m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 2400);
  }, []);

  const favIds   = useMemo(() => new Set(favorites.map(f => f.url_id)), [favorites]);
  const bgGrad   = current ? getGrad(current.url_id) : ["#312e81", "#1e3a5f", "#0f3460"];
  const curSource = SOURCES.find(s => s.id === source) ?? SOURCES[0];

  // Persist favs & history
  useEffect(() => {
    localStorage.setItem("nova_fav_v2", JSON.stringify(favorites));
  }, [favorites]);
  useEffect(() => {
    localStorage.setItem("nova_hist_v2", JSON.stringify(history));
  }, [history]);

  // Volume sync
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = vol / 100;
  }, [vol]);

  // ── Load home tracks ──────────────────────────────────────────────────────
  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const shuffled = [...HOME_ARTISTS].sort(() => Math.random() - 0.5).slice(0, 6);
        const collected: GdTrack[] = [];
        for (const artist of shuffled) {
          if (collected.length >= 24) break;
          const list = await searchTracks(artist, "netease", 5);
          if (alive) collected.push(...list);
        }
        const unique = Array.from(new Map(collected.map(t => [t.url_id, t])).values());
        if (alive && unique.length) setHomeTracks(unique.sort(() => Math.random() - 0.5).slice(0, 28));
      } catch {
        if (alive) showToast("اتصال به سرور ناموفق بود.");
      } finally {
        if (alive) setLoadingHome(false);
      }
    }
    load();
    return () => { alive = false; };
  }, [showToast]);

  // ── Audio events ──────────────────────────────────────────────────────────
  function onTimeUpdate() {
    const a = audioRef.current;
    if (!a || !isFinite(a.duration)) return;
    setCurTime(a.currentTime);
    setProgress((a.currentTime / a.duration) * 100);
  }
  function onLoadedMeta() {
    if (audioRef.current) setDuration(audioRef.current.duration);
  }
  function onEnded() {
    setPlaying(false);
    if (repeat && current) { resolveAndPlay(current, quality); return; }
    playNext(1);
  }

  // ── Resolve & play ────────────────────────────────────────────────────────
  async function resolveAndPlay(track: GdTrack, q: QualityKey, resumeAt?: number) {
    setLoadingUrl(true);
    const info = await getPlayInfo(track.source, track.url_id, q);
    setLoadingUrl(false);
    if (!info) { showToast("پخش این آهنگ ممکن نشد."); return false; }
    setPlayInfo(info);
    const audio = audioRef.current;
    if (!audio) return true;
    audio.src = info.url;
    audio.onloadedmetadata = () => {
      if (resumeAt && isFinite(resumeAt)) {
        try { audio.currentTime = Math.min(resumeAt, audio.duration - 1); } catch { /* */ }
      }
      audio.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    };
    if (!resumeAt) {
      setProgress(0); setCurTime(0);
    }
    return true;
  }

  async function playTrack(track: GdTrack) {
    if (current?.url_id === track.url_id) { togglePlay(); return; }
    setCurrent(track);
    setPlayInfo(null);
    setQuality("128");
    setPlaying(false);
    // update queue & history
    setQueue(prev => [track, ...prev.filter(t => t.url_id !== track.url_id)]);
    setHistory(prev => [track, ...prev.filter(t => t.url_id !== track.url_id)].slice(0, 50));
    await resolveAndPlay(track, "128");
  }

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio || !current || !playInfo) return;
    if (playing) { audio.pause(); setPlaying(false); }
    else { audio.play().then(() => setPlaying(true)).catch(() => showToast("پخش انجام نشد.")); }
  }

  async function changeQuality(q: QualityKey) {
    if (!current || q === quality) return;
    const t = audioRef.current?.currentTime ?? 0;
    setQuality(q);
    showToast(`کیفیت ${q === "flac" ? "FLAC" : q} در حال بارگذاری...`);
    await resolveAndPlay(current, q, t > 1 ? t : undefined);
  }

  function seek(pct: number) {
    const audio = audioRef.current;
    if (!audio || !isFinite(audio.duration)) return;
    const t = (pct / 100) * audio.duration;
    audio.currentTime = t;
    setProgress(pct);
    setCurTime(t);
  }

  function playNext(dir: 1 | -1) {
    if (!current) return;
    const list = queue.length > 1 ? queue : homeTracks;
    if (!list.length) return;
    let idx = list.findIndex(t => t.url_id === current.url_id);
    if (shuffle) idx = Math.floor(Math.random() * list.length);
    else idx = (idx + dir + list.length) % list.length;
    playTrack(list[idx]);
  }

  function toggleFav(track: GdTrack) {
    setFavorites(prev => {
      if (prev.some(f => f.url_id === track.url_id)) {
        showToast("از علاقه‌مندی‌ها حذف شد");
        return prev.filter(f => f.url_id !== track.url_id);
      }
      showToast("به علاقه‌مندی‌ها اضافه شد ❤️");
      return [track, ...prev];
    });
  }

  // ── Search ────────────────────────────────────────────────────────────────
  async function doSearch(q: string) {
    if (!q.trim()) return;
    setView("search");
    setLoadingSearch(true);
    try {
      const res = await searchTracks(q, source, 40);
      const unique = Array.from(new Map(res.map(t => [t.url_id, t])).values());
      setSearchResults(unique);
      if (!unique.length) showToast("نتیجه‌ای پیدا نشد.");
    } catch {
      showToast("خطا در جستجو.");
    } finally {
      setLoadingSearch(false);
    }
  }

  // ── Load artist tracks ────────────────────────────────────────────────────
  async function openArtist(artist: typeof ARTIST_META[0]) {
    setSelArtist(artist);
    setView("artist");
    setArtistTracks([]);
    setLoadingArtist(true);
    try {
      const res = await searchTracks(artist.query, "netease", 20);
      setArtistTracks(Array.from(new Map(res.map(t => [t.url_id, t])).values()));
    } catch {
      showToast("بارگذاری آهنگ‌های خواننده ناموفق بود.");
    } finally {
      setLoadingArtist(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div dir="rtl" className="relative min-h-screen overflow-x-hidden select-none"
      style={{ background: `linear-gradient(160deg,${bgGrad[0]}22,#06070b 38%)` }}>

      {/* Ambient blobs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
        <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full opacity-20 blur-3xl transition-all duration-1000"
          style={{ background: bgGrad[0] }} />
        <div className="absolute top-1/2 -left-28 h-80 w-80 rounded-full opacity-15 blur-3xl transition-all duration-1000"
          style={{ background: bgGrad[2] }} />
        <div className="absolute -bottom-20 right-1/3 h-72 w-72 rounded-full opacity-10 blur-3xl transition-all duration-1000"
          style={{ background: bgGrad[1] }} />
      </div>

      <audio ref={audioRef}
        onTimeUpdate={onTimeUpdate}
        onLoadedMetadata={onLoadedMeta}
        onEnded={onEnded} />

      {/* ── Full Player ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showFull && current && (
          <motion.div
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 26, stiffness: 240 }}
            className="fixed inset-0 z-50 flex flex-col overflow-hidden"
            style={{ background: `linear-gradient(170deg,${bgGrad[0]}ee 0%,#06070bfa 58%)`, backdropFilter: "blur(40px)" }}>

            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-14 pb-2">
              <button onClick={() => setShowFull(false)}
                className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{ background: "rgba(255,255,255,0.1)" }}>
                <ChevronDown size={22} />
              </button>
              <div className="text-center">
                <p className="text-[11px] text-white/45">در حال پخش</p>
                <p className="text-sm font-semibold text-white/80">{current.artist}</p>
              </div>
              <button onClick={() => setShowLyrics(l => !l)}
                className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{ background: showLyrics ? `${bgGrad[0]}88` : "rgba(255,255,255,0.1)" }}>
                <Mic2 size={17} />
              </button>
            </div>

            <AnimatePresence mode="wait">
              {!showLyrics ? (
                <motion.div key="player"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="flex flex-col items-center flex-1 px-8 pt-2 overflow-y-auto">

                  {/* Album Art */}
                  <motion.div
                    animate={playing
                      ? { scale: 1, boxShadow: `0 30px 80px ${bgGrad[0]}66` }
                      : { scale: 0.87, boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}
                    transition={{ duration: 0.4 }}
                    className="mt-4 overflow-hidden" style={{ borderRadius: 28 }}>
                    <CoverArt track={current} size={268} radius={28} />
                  </motion.div>

                  {/* Info */}
                  <div className="mt-7 w-full flex items-center justify-between">
                    <div>
                      <h2 className="text-[22px] font-bold text-white leading-tight">{current.name}</h2>
                      <p className="text-sm text-white/55 mt-1">{current.artist}</p>
                    </div>
                    <button onClick={() => toggleFav(current)}
                      className="w-11 h-11 rounded-full flex items-center justify-center"
                      style={{ background: "rgba(255,255,255,0.08)" }}>
                      <Heart size={22} fill={favIds.has(current.url_id) ? "#f43f5e" : "none"}
                        color={favIds.has(current.url_id) ? "#f43f5e" : "rgba(255,255,255,0.7)"} />
                    </button>
                  </div>

                  {/* Quality & bitrate */}
                  <div className="mt-3 w-full flex items-center gap-2">
                    {QUALITIES.map(q => (
                      <button key={q.key} onClick={() => changeQuality(q.key)}
                        disabled={loadingUrl}
                        className="rounded-full px-3 py-1 text-[11px] font-bold transition-all disabled:opacity-50"
                        style={{
                          background: quality === q.key ? bgGrad[0] : "rgba(255,255,255,0.08)",
                          color: quality === q.key ? "white" : "rgba(255,255,255,0.4)",
                          border: quality === q.key ? `1px solid ${bgGrad[0]}` : "1px solid rgba(255,255,255,0.1)",
                        }}>{q.label}</button>
                    ))}
                    {playInfo && (
                      <span className="mr-auto text-[11px] font-bold text-white/35">
                        {qualLabel(playInfo.br)} kbps
                      </span>
                    )}
                    {loadingUrl && <Loader2 size={14} className="animate-spin text-white/40 mr-auto" />}
                  </div>

                  {/* Progress */}
                  <div className="mt-5 w-full">
                    <div className="relative h-1.5 rounded-full cursor-pointer"
                      style={{ background: "rgba(255,255,255,0.12)" }}
                      onClick={e => {
                        const r = e.currentTarget.getBoundingClientRect();
                        seek(((e.clientX - r.left) / r.width) * 100);
                      }}>
                      <div className="absolute inset-y-0 left-0 rounded-full transition-all"
                        style={{ width: `${progress}%`, background: `linear-gradient(90deg,${bgGrad[0]},${bgGrad[1]})` }} />
                    </div>
                    <div className="flex justify-between mt-1.5 text-[11px] text-white/35">
                      <span>{fmt(curTime)}</span><span>{fmt(duration)}</span>
                    </div>
                  </div>

                  {/* Controls */}
                  <div className="mt-4 w-full flex items-center justify-between">
                    <button onClick={() => { setShuffle(s => !s); showToast(shuffle ? "شافل خاموش" : "شافل روشن"); }}>
                      <Shuffle size={20} color={shuffle ? bgGrad[0] : "rgba(255,255,255,0.35)"} />
                    </button>
                    <button onClick={() => playNext(-1)}
                      className="w-12 h-12 rounded-full flex items-center justify-center"
                      style={{ background: "rgba(255,255,255,0.1)" }}>
                      <SkipBack size={22} />
                    </button>
                    <button onClick={togglePlay}
                      className="w-16 h-16 rounded-full flex items-center justify-center shadow-2xl"
                      style={{ background: `linear-gradient(135deg,${bgGrad[0]},${bgGrad[1]})`, boxShadow: `0 8px 32px ${bgGrad[0]}80` }}>
                      {loadingUrl
                        ? <Loader2 size={26} className="animate-spin" />
                        : playing
                          ? <Pause size={28} fill="white" />
                          : <Play size={28} fill="white" />}
                    </button>
                    <button onClick={() => playNext(1)}
                      className="w-12 h-12 rounded-full flex items-center justify-center"
                      style={{ background: "rgba(255,255,255,0.1)" }}>
                      <SkipForward size={22} />
                    </button>
                    <button onClick={() => { setRepeat(r => !r); showToast(repeat ? "تکرار خاموش" : "تکرار روشن"); }}>
                      <Repeat size={20} color={repeat ? bgGrad[1] : "rgba(255,255,255,0.35)"} />
                    </button>
                  </div>

                  {/* Volume */}
                  <div className="mt-5 w-full flex items-center gap-3">
                    <Volume2 size={16} color="rgba(255,255,255,0.35)" />
                    <input type="range" min={0} max={100} value={vol}
                      onChange={e => setVol(Number(e.target.value))}
                      className="flex-1" />
                  </div>
                </motion.div>
              ) : (
                /* Lyrics placeholder */
                <motion.div key="lyrics"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="flex-1 overflow-y-auto px-8 pt-6 pb-4 flex flex-col items-center">
                  <p className="text-xs text-white/35 mb-8">متن آهنگ</p>
                  <p className="text-center text-white/30 text-sm leading-8">
                    متن آهنگ از API در دسترس نیست.<br />
                    می‌تونی از lyric_id برای گرفتن متن استفاده کنی.
                  </p>
                  <p className="mt-4 text-xs font-mono text-white/20">lyric_id: {current.lyric_id}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Mini Player ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {current && !showFull && (
          <motion.div
            initial={{ y: 80 }} animate={{ y: 0 }} exit={{ y: 80 }}
            onClick={() => setShowFull(true)}
            className="fixed bottom-[60px] left-3 right-3 z-30 overflow-hidden rounded-[20px] cursor-pointer"
            style={{
              background: `linear-gradient(135deg,${bgGrad[0]}cc,${bgGrad[1]}cc)`,
              backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.14)"
            }}>
            {/* progress bar */}
            <div className="h-[2px]" style={{ background: "rgba(255,255,255,0.12)" }}>
              <div className="h-full rounded-full bg-white/70" style={{ width: `${progress}%` }} />
            </div>
            <div className="flex items-center gap-3 p-3">
              <CoverArt track={current} size={44} radius={12} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{current.name}</p>
                <p className="text-[11px] text-white/55 truncate mt-0.5">{current.artist}</p>
              </div>
              <button onClick={e => { e.stopPropagation(); toggleFav(current); }}
                className="w-9 h-9 rounded-full flex items-center justify-center"
                style={{ background: "rgba(255,255,255,0.15)" }}>
                <Heart size={16} fill={favIds.has(current.url_id) ? "#f43f5e" : "none"}
                  color={favIds.has(current.url_id) ? "#f43f5e" : "white"} />
              </button>
              <button onClick={e => { e.stopPropagation(); togglePlay(); }}
                className="w-9 h-9 rounded-full flex items-center justify-center bg-white">
                {loadingUrl
                  ? <Loader2 size={15} className="animate-spin text-black" />
                  : playing
                    ? <Pause size={15} fill="#000" color="#000" />
                    : <Play size={15} fill="#000" color="#000" />}
              </button>
              <button onClick={e => { e.stopPropagation(); playNext(1); }}
                className="w-9 h-9 rounded-full flex items-center justify-center"
                style={{ background: "rgba(255,255,255,0.15)" }}>
                <SkipForward size={15} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Source Picker ───────────────────────────────────────────────── */}
      <AnimatePresence>
        {showSourcePicker && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 flex items-end justify-center p-4"
            style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
            onClick={() => setShowSourcePicker(false)}>
            <motion.div
              initial={{ y: 80 }} animate={{ y: 0 }} exit={{ y: 80 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-sm rounded-[28px] p-5"
              style={{ background: "rgba(20,20,30,0.95)", border: "1px solid rgba(255,255,255,0.12)" }}>
              <h3 className="text-base font-bold text-white mb-1">منبع جستجو</h3>
              <p className="text-xs text-white/40 mb-4">نت‌ایز برای پخش مطمئن توصیه می‌شود</p>
              {SOURCES.map(s => (
                <button key={s.id}
                  onClick={() => { setSource(s.id); setShowSourcePicker(false); showToast(`منبع: ${s.name}`); }}
                  className="w-full flex items-center gap-3 rounded-2xl p-3 mb-2 text-right transition"
                  style={{ background: source === s.id ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.06)" }}>
                  <span className="text-xl">{s.icon}</span>
                  <span className="flex-1 text-sm font-medium text-white">{s.name}</span>
                  {source === s.id && <span className="text-xs text-white/50">✓</span>}
                </button>
              ))}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Page Content ────────────────────────────────────────────────── */}
      <div className="relative z-10 pb-36">

        {/* HOME */}
        {view === "home" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-14 pb-2">
              <div>
                <p className="text-xs text-white/38">نُوا موزیک</p>
                <h1 className="text-2xl font-bold text-white mt-1">سلام 👋</h1>
              </div>
              <button onClick={() => setShowSourcePicker(true)}
                className="flex items-center gap-2 rounded-full px-3 py-2 text-sm"
                style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" }}>
                <span>{curSource.icon}</span>
                <span className="text-white/70 text-xs">{curSource.name}</span>
              </button>
            </div>

            {/* Search bar */}
            <div className="mx-5 mt-4 flex h-12 items-center gap-3 rounded-2xl px-4 cursor-pointer"
              style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.10)" }}
              onClick={() => setView("search")}>
              <Search size={17} color="rgba(255,255,255,0.35)" />
              <span className="text-sm text-white/28">جستجوی آهنگ یا خواننده...</span>
            </div>

            {/* Featured card */}
            {homeTracks[0] && (
              <div className="mx-5 mt-5 overflow-hidden rounded-[28px]"
                style={{ background: `linear-gradient(135deg,${getGrad(homeTracks[0].url_id)[0]},${getGrad(homeTracks[0].url_id)[2]})` }}>
                <div className="flex items-end gap-4 p-5 pt-16">
                  <div className="rounded-[20px] overflow-hidden shadow-2xl ring-2 ring-white/20 shrink-0">
                    <CoverArt track={homeTracks[0]} size={80} radius={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-semibold text-white/60 uppercase tracking-widest">پیشنهاد ویژه</p>
                    <h3 className="text-[18px] font-bold text-white mt-1 leading-tight truncate">{homeTracks[0].name}</h3>
                    <p className="text-sm text-white/65 truncate">{homeTracks[0].artist}</p>
                    <button onClick={() => playTrack(homeTracks[0])}
                      className="mt-3 flex items-center gap-2 rounded-full bg-white px-4 py-1.5 text-sm font-bold"
                      style={{ color: getGrad(homeTracks[0].url_id)[0] }}>
                      <Play size={13} fill="currentColor" /> پخش
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Artists row */}
            <div className="mt-6">
              <div className="flex items-center justify-between px-5 mb-3">
                <h2 className="text-base font-bold text-white">خواننده‌ها</h2>
              </div>
              <div className="flex gap-4 overflow-x-auto px-5 pb-1 no-scrollbar">
                {ARTIST_META.map(a => (
                  <button key={a.query} onClick={() => openArtist(a)}
                    className="flex flex-col items-center gap-2 shrink-0">
                    <div className="w-16 h-16 rounded-full overflow-hidden ring-2 ring-white/12"
                      style={{ background: `linear-gradient(135deg,${getGrad(a.query)[0]},${getGrad(a.query)[2]})`, display:"flex", alignItems:"center", justifyContent:"center" }}>
                      <span className="text-2xl font-bold text-white/80">{a.label[0]}</span>
                    </div>
                    <span className="text-[11px] text-white/65 text-center whitespace-nowrap">{a.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Track list */}
            <div className="mt-6 px-5">
              <h2 className="text-base font-bold text-white mb-3">موسیقی ایرانی 🇮🇷</h2>
              {loadingHome ? (
                <div className="flex flex-col items-center gap-3 py-16">
                  <Loader2 size={28} className="animate-spin text-white/30" />
                  <p className="text-sm text-white/30">در حال بارگذاری...</p>
                </div>
              ) : (
                homeTracks.map((t, i) => (
                  <TrackRow key={t.url_id} track={t} index={i}
                    isCurrent={current?.url_id === t.url_id}
                    isPlaying={playing && current?.url_id === t.url_id}
                    isFav={favIds.has(t.url_id)}
                    onPlay={() => playTrack(t)} onFav={() => toggleFav(t)}
                    accent={bgGrad[0]} />
                ))
              )}
            </div>
          </motion.div>
        )}

        {/* SEARCH */}
        {view === "search" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="px-5 pt-14">
            <h1 className="text-2xl font-bold text-white mb-4">جستجو</h1>
            <form onSubmit={e => { e.preventDefault(); doSearch(query); }}
              className="flex items-center gap-3 h-12 rounded-2xl px-4"
              style={{ background: "rgba(255,255,255,0.09)", border: "1px solid rgba(255,255,255,0.13)" }}>
              <Search size={17} color="rgba(255,255,255,0.4)" />
              <input value={query} onChange={e => setQuery(e.target.value)}
                placeholder="آهنگ، خواننده..." autoFocus
                className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/30" />
              {query && (
                <button type="button" onClick={() => { setQuery(""); setSearchResults([]); }}>
                  <X size={15} color="rgba(255,255,255,0.4)" />
                </button>
              )}
            </form>

            {/* Quick tags */}
            <div className="flex flex-wrap gap-2 mt-4">
              {QUICK_TAGS.map(t => (
                <button key={t.query} onClick={() => { setQuery(t.label); doSearch(t.query); }}
                  className="rounded-full px-3 py-1.5 text-xs text-white/65 transition"
                  style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.10)" }}>
                  {t.label}
                </button>
              ))}
            </div>

            <div className="mt-4">
              {loadingSearch ? (
                <div className="flex flex-col items-center gap-3 py-16">
                  <Loader2 size={28} className="animate-spin text-white/30" />
                  <p className="text-sm text-white/30">در حال جستجو...</p>
                </div>
              ) : searchResults.length > 0 ? (
                <>
                  <p className="text-xs text-white/35 mb-3">{searchResults.length} نتیجه</p>
                  {searchResults.map((t, i) => (
                    <TrackRow key={t.url_id} track={t} index={i}
                      isCurrent={current?.url_id === t.url_id}
                      isPlaying={playing && current?.url_id === t.url_id}
                      isFav={favIds.has(t.url_id)}
                      onPlay={() => playTrack(t)} onFav={() => toggleFav(t)}
                      accent={bgGrad[0]} />
                  ))}
                </>
              ) : (
                <div className="flex flex-col items-center gap-2 py-16">
                  <Search size={36} color="rgba(255,255,255,0.1)" />
                  <p className="text-sm text-white/28">جستجو کن تا نتایج ببینی</p>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* ARTIST */}
        {view === "artist" && selArtist && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="relative h-52 overflow-hidden"
              style={{ background: `linear-gradient(135deg,${getGrad(selArtist.query)[0]},${getGrad(selArtist.query)[2]})` }}>
              <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom,transparent 30%,#06070b)" }} />
              <button onClick={() => setView("home")}
                className="absolute right-5 top-14 w-9 h-9 rounded-full flex items-center justify-center"
                style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(8px)" }}>
                <ArrowLeft size={17} />
              </button>
              <div className="absolute bottom-4 right-5">
                <h2 className="text-3xl font-bold text-white">{selArtist.label}</h2>
                <p className="text-sm text-white/55 mt-1">{selArtist.genre}</p>
              </div>
            </div>
            <div className="flex gap-3 px-5 mt-4">
              <button onClick={() => artistTracks[0] && playTrack(artistTracks[0])}
                className="flex-1 flex items-center justify-center gap-2 h-11 rounded-[18px] text-sm font-bold text-white"
                style={{ background: getGrad(selArtist.query)[0] }}>
                <Play size={15} fill="white" /> پخش همه
              </button>
              <button onClick={() => setShuffle(s => !s)}
                className="w-11 h-11 flex items-center justify-center rounded-[18px]"
                style={{ background: "rgba(255,255,255,0.08)" }}>
                <Shuffle size={17} color="rgba(255,255,255,0.7)" />
              </button>
            </div>
            <div className="px-5 mt-4">
              {loadingArtist ? (
                <div className="flex flex-col items-center gap-3 py-12">
                  <Loader2 size={26} className="animate-spin text-white/30" />
                  <p className="text-sm text-white/30">در حال بارگذاری...</p>
                </div>
              ) : artistTracks.length > 0 ? artistTracks.map((t, i) => (
                <TrackRow key={t.url_id} track={t} index={i}
                  isCurrent={current?.url_id === t.url_id}
                  isPlaying={playing && current?.url_id === t.url_id}
                  isFav={favIds.has(t.url_id)}
                  onPlay={() => playTrack(t)} onFav={() => toggleFav(t)}
                  accent={bgGrad[0]} />
              )) : (
                <p className="text-center text-sm text-white/28 mt-10">آهنگی پیدا نشد</p>
              )}
            </div>
          </motion.div>
        )}

        {/* QUEUE */}
        {view === "queue" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="px-5 pt-14">
            <h1 className="text-2xl font-bold text-white mb-1">صف پخش</h1>
            <p className="text-sm text-white/35 mb-5">{queue.length} آهنگ</p>
            {queue.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-16">
                <ListMusic size={36} color="rgba(255,255,255,0.1)" />
                <p className="text-sm text-white/28">صف پخش خالیه</p>
              </div>
            ) : queue.map((t, i) => (
              <TrackRow key={t.url_id + i} track={t} index={i}
                isCurrent={current?.url_id === t.url_id}
                isPlaying={playing && current?.url_id === t.url_id}
                isFav={favIds.has(t.url_id)}
                onPlay={() => playTrack(t)} onFav={() => toggleFav(t)}
                accent={bgGrad[0]} />
            ))}
          </motion.div>
        )}

        {/* HISTORY */}
        {view === "history" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="px-5 pt-14">
            <div className="flex items-center justify-between mb-1">
              <h1 className="text-2xl font-bold text-white">تاریخچه</h1>
              {history.length > 0 && (
                <button onClick={() => { setHistory([]); showToast("تاریخچه پاک شد"); }}
                  className="text-xs text-white/30">پاک کردن</button>
              )}
            </div>
            <p className="text-sm text-white/35 mb-5">{history.length} آهنگ</p>
            {history.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-16">
                <Clock size={36} color="rgba(255,255,255,0.1)" />
                <p className="text-sm text-white/28">هنوز چیزی پخش نکردی</p>
              </div>
            ) : history.map((t, i) => (
              <TrackRow key={t.url_id + i} track={t} index={i}
                isCurrent={current?.url_id === t.url_id}
                isPlaying={playing && current?.url_id === t.url_id}
                isFav={favIds.has(t.url_id)}
                onPlay={() => playTrack(t)} onFav={() => toggleFav(t)}
                accent={bgGrad[0]} />
            ))}
          </motion.div>
        )}

        {/* FAVORITES */}
        {view === "favorites" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="px-5 pt-14">
            <h1 className="text-2xl font-bold text-white mb-1">علاقه‌مندی‌ها</h1>
            <p className="text-sm text-white/35 mb-5">{favorites.length} آهنگ</p>
            {favorites.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-16">
                <Heart size={36} color="rgba(255,255,255,0.1)" />
                <p className="text-sm text-white/28">هنوز آهنگی لایک نکردی</p>
              </div>
            ) : favorites.map((t, i) => (
              <TrackRow key={t.url_id} track={t} index={i}
                isCurrent={current?.url_id === t.url_id}
                isPlaying={playing && current?.url_id === t.url_id}
                isFav={true}
                onPlay={() => playTrack(t)} onFav={() => toggleFav(t)}
                accent={bgGrad[0]} />
            ))}
          </motion.div>
        )}
      </div>

      {/* ── Bottom Nav ───────────────────────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 z-20"
        style={{ background: "rgba(6,7,11,0.88)", backdropFilter: "blur(24px)", borderTop: "1px solid rgba(255,255,255,0.07)" }}>
        <div className="flex items-center justify-around py-2 pb-4">
          {([
            { id: "home",      Icon: Home,      label: "خانه" },
            { id: "search",    Icon: Search,    label: "جستجو" },
            { id: "queue",     Icon: ListMusic, label: "صف" },
            { id: "history",   Icon: Clock,     label: "تاریخچه" },
            { id: "favorites", Icon: Heart,     label: "لایک" },
          ] as { id: View; Icon: React.FC<any>; label: string }[]).map(({ id, Icon, label }) => {
            const active = view === id;
            const col = active ? bgGrad[0] : "rgba(255,255,255,0.3)";
            return (
              <button key={id} onClick={() => setView(id)}
                className="flex flex-col items-center gap-1 px-3 py-1">
                <Icon size={22} color={col}
                  fill={active && id === "favorites" ? col : "none"} />
                <span className="text-[10px] font-medium" style={{ color: col }}>{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <Toast msg={toast} />
    </div>
  );
}
