
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "https://esm.sh/framer-motion@11.11.0?deps=react@18.3.1";
import { Play, Pause, SkipBack, SkipForward, Heart, Search, Home, ListMusic, Clock, ChevronDown, Shuffle, Repeat, Volume2, X, Music2, Mic2, Sparkles, ArrowLeft, Loader2 } from "https://esm.sh/lucide-react@0.454.0";

// ─── Types ────────────────────────────────────────────────────────────────────
type View = "home" | "search" | "artist" | "queue" | "history" | "favorites";
type Source = "netease" | "kuwo" | "joox" | "tencent";
type QualityKey = "128" | "320" | "flac";

interface Track {
  url_id: string;
  name: string;
  artist: string;
  source: Source;
  pic_id?: string;
  coverUrl?: string;
}

interface PlayInfo {
  url: string;
  br: number;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────
const MOCK_TRACKS: Track[] = [
  { url_id: "1", name: "جاده‌ای به سوی تو", artist: "داریوش", source: "netease", coverUrl: "https://picsum.photos/seed/t1/400/400" },
  { url_id: "2", name: "مرغ سحر", artist: "گوگوش", source: "netease", coverUrl: "https://picsum.photos/seed/t2/400/400" },
  { url_id: "3", name: "آرامش", artist: "ابی", source: "netease", coverUrl: "https://picsum.photos/seed/t3/400/400" },
  { url_id: "4", name: "سلطان قلب‌ها", artist: "هایده", source: "netease", coverUrl: "https://picsum.photos/seed/t4/400/400" },
  { url_id: "5", name: "بی‌تو بی‌معنیم", artist: "ستار", source: "kuwo", coverUrl: "https://picsum.photos/seed/t5/400/400" },
  { url_id: "6", name: "شب‌های تهران", artist: "محسن نامجو", source: "netease", coverUrl: "https://picsum.photos/seed/t6/400/400" },
  { url_id: "7", name: "باور کن", artist: "رضا صادقی", source: "netease", coverUrl: "https://picsum.photos/seed/t7/400/400" },
  { url_id: "8", name: "یار من", artist: "مازیار", source: "joox", coverUrl: "https://picsum.photos/seed/t8/400/400" },
  { url_id: "9", name: "عشق من", artist: "داریوش", source: "netease", coverUrl: "https://picsum.photos/seed/t9/400/400" },
  { url_id: "10", name: "دلتنگی", artist: "گوگوش", source: "tencent", coverUrl: "https://picsum.photos/seed/t10/400/400" },
  { url_id: "11", name: "پرواز", artist: "ابی", source: "netease", coverUrl: "https://picsum.photos/seed/t11/400/400" },
  { url_id: "12", name: "آواز باران", artist: "ویگن", source: "netease", coverUrl: "https://picsum.photos/seed/t12/400/400" },
];

const ARTISTS = [
  { id: "a1", name: "داریوش", genre: "پاپ کلاسیک", img: "https://picsum.photos/seed/a1/300/300" },
  { id: "a2", name: "گوگوش", genre: "پاپ", img: "https://picsum.photos/seed/a2/300/300" },
  { id: "a3", name: "ابی", genre: "پاپ کلاسیک", img: "https://picsum.photos/seed/a3/300/300" },
  { id: "a4", name: "هایده", genre: "سنتی", img: "https://picsum.photos/seed/a4/300/300" },
  { id: "a5", name: "ستار", genre: "پاپ", img: "https://picsum.photos/seed/a5/300/300" },
  { id: "a6", name: "محسن نامجو", genre: "راک / تجربی", img: "https://picsum.photos/seed/a6/300/300" },
];

const MOCK_LYRICS = [
  { time: 0, text: "🎵 در این شب تاریک و دل‌تنگ" },
  { time: 4, text: "صدای قلبم می‌آد از دور" },
  { time: 8, text: "یادت می‌مونه توی یادم" },
  { time: 12, text: "مثل روشنایی یه ستاره" },
  { time: 16, text: "بی‌تو این جاده بی‌معناست" },
  { time: 20, text: "هر قدم سنگین‌تر از قبله" },
  { time: 24, text: "برگرد، ای آرامش دلم" },
  { time: 28, text: "بی‌تو دنیا رنگ نداره" },
];

const GRADIENTS = [
  ["#6366f1", "#8b5cf6", "#a855f7"],
  ["#ec4899", "#f43f5e", "#fb7185"],
  ["#06b6d4", "#3b82f6", "#6366f1"],
  ["#10b981", "#06b6d4", "#3b82f6"],
  ["#f59e0b", "#f97316", "#ef4444"],
  ["#8b5cf6", "#ec4899", "#f43f5e"],
];

function getGradient(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return GRADIENTS[h % GRADIENTS.length];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(sec: number) {
  if (!sec || !isFinite(sec)) return "0:00";
  return `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;
}

function qualLabel(br: number) {
  if (br >= 700) return "FLAC";
  if (br >= 320) return "320";
  return "128";
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function CoverArt({ track, size = 56, rounded = "rounded-xl", className = "" }: {
  track: Track; size?: number; rounded?: string; className?: string;
}) {
  const [err, setErr] = useState(false);
  const g = getGradient(track.url_id);
  if (!track.coverUrl || err) {
    return (
      <div className={`${rounded} ${className} flex items-center justify-center`}
        style={{ width: size, height: size, background: `linear-gradient(135deg, ${g[0]}, ${g[1]}, ${g[2]})` }}>
        <Music2 size={size * 0.35} color="white" opacity={0.7} />
      </div>
    );
  }
  return (
    <img src={track.coverUrl} alt={track.name} onError={() => setErr(true)}
      className={`${rounded} ${className} object-cover`}
      style={{ width: size, height: size }} />
  );
}

function Toast({ msg }: { msg: string | null }) {
  return (
    <AnimatePresence>
      {msg && (
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 24 }}
          className="fixed bottom-28 left-1/2 z-50 -translate-x-1/2 rounded-full px-5 py-2.5 text-sm font-medium text-white shadow-2xl"
          style={{ background: "rgba(255,255,255,0.18)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.25)" }}>
          {msg}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [view, setView] = useState<View>("home");
  const [tracks] = useState<Track[]>(MOCK_TRACKS);
  const [searchResults, setSearchResults] = useState<Track[]>([]);
  const [query, setQuery] = useState("");
  const [current, setCurrent] = useState<Track | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [favorites, setFavorites] = useState<Track[]>([]);
  const [queue, setQueue] = useState<Track[]>([]);
  const [history, setHistory] = useState<Track[]>([]);
  const [showPlayer, setShowPlayer] = useState(false);
  const [showLyrics, setShowLyrics] = useState(false);
  const [quality, setQuality] = useState<QualityKey>("128");
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [selectedArtist, setSelectedArtist] = useState<typeof ARTISTS[0] | null>(null);
  const [volume, setVolume] = useState(80);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [activeLyric, setActiveLyric] = useState(0);

  const audioRef = useRef<HTMLAudioElement>(null);
  const lyricsRef = useRef<HTMLDivElement>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }, []);

  const favIds = useMemo(() => new Set(favorites.map(f => f.url_id)), [favorites]);

  // Simulate play
  const playTrack = useCallback((track: Track) => {
    setCurrent(track);
    setPlaying(true);
    setProgress(0);
    setCurrentTime(0);
    setDuration(180 + Math.random() * 120);
    setQueue(prev => {
      const without = prev.filter(t => t.url_id !== track.url_id);
      return [track, ...without];
    });
    setHistory(prev => {
      const without = prev.filter(t => t.url_id !== track.url_id);
      return [track, ...without].slice(0, 30);
    });
    showToast(`پخش: ${track.name}`);
  }, [showToast]);

  // Simulate progress
  useEffect(() => {
    if (!playing || !current) return;
    const interval = setInterval(() => {
      setCurrentTime(t => {
        if (t >= duration) { setPlaying(false); return 0; }
        const next = t + 0.5;
        setProgress((next / duration) * 100);
        // lyrics sync
        const li = MOCK_LYRICS.findIndex((l, i) => {
          const nextTime = MOCK_LYRICS[i + 1]?.time ?? 999;
          return next >= l.time && next < nextTime;
        });
        if (li !== -1) setActiveLyric(li);
        return next;
      });
    }, 500);
    return () => clearInterval(interval);
  }, [playing, current, duration]);

  // Volume
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume / 100;
  }, [volume]);

  const toggleFav = (track: Track) => {
    setFavorites(prev => {
      if (prev.some(f => f.url_id === track.url_id)) {
        showToast("از علاقه‌مندی‌ها حذف شد");
        return prev.filter(f => f.url_id !== track.url_id);
      }
      showToast("به علاقه‌مندی‌ها اضافه شد ❤️");
      return [track, ...prev];
    });
  };

  const playNext = (dir: 1 | -1) => {
    if (!current) return;
    const list = queue.length > 1 ? queue : tracks;
    const idx = list.findIndex(t => t.url_id === current.url_id);
    const next = list[(idx + dir + list.length) % list.length];
    if (next) playTrack(next);
  };

  const doSearch = (q: string) => {
    if (!q.trim()) return;
    setLoadingSearch(true);
    setTimeout(() => {
      const res = tracks.filter(t =>
        t.name.includes(q) || t.artist.includes(q)
      );
      setSearchResults(res.length ? res : tracks.slice(0, 6));
      setLoadingSearch(false);
    }, 700);
  };

  const artistTracks = selectedArtist
    ? tracks.filter(t => t.artist === selectedArtist.name)
    : [];

  // ── Background gradient from current track ──
  const bgGrad = current ? getGradient(current.url_id) : ["#1a1a2e", "#16213e", "#0f3460"];

  return (
    <div dir="rtl" className="relative min-h-screen overflow-hidden font-sans select-none"
      style={{ background: `linear-gradient(160deg, ${bgGrad[0]}22, #0a0a0f 40%, #0a0a0f)` }}>

      {/* Ambient blobs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full opacity-20 blur-3xl"
          style={{ background: bgGrad[0] }} />
        <div className="absolute top-1/2 -left-32 h-80 w-80 rounded-full opacity-15 blur-3xl"
          style={{ background: bgGrad[2] }} />
        <div className="absolute -bottom-20 right-1/3 h-72 w-72 rounded-full opacity-10 blur-3xl"
          style={{ background: bgGrad[1] }} />
      </div>

      <audio ref={audioRef} />

      {/* ── Expanded Player ── */}
      <AnimatePresence>
        {showPlayer && current && (
          <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 260 }}
            className="fixed inset-0 z-40 flex flex-col overflow-hidden"
            style={{ background: `linear-gradient(170deg, ${bgGrad[0]}ee 0%, #0a0a0ffa 60%)`, backdropFilter: "blur(40px)" }}>

            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-14 pb-2">
              <button onClick={() => setShowPlayer(false)}
                className="grid h-10 w-10 place-items-center rounded-full"
                style={{ background: "rgba(255,255,255,0.1)" }}>
                <ChevronDown size={22} color="white" />
              </button>
              <div className="text-center">
                <p className="text-xs font-medium text-white/50">در حال پخش</p>
                <p className="text-sm font-semibold text-white/80">{current.artist}</p>
              </div>
              <button onClick={() => setShowLyrics(!showLyrics)}
                className="grid h-10 w-10 place-items-center rounded-full"
                style={{ background: showLyrics ? `${bgGrad[0]}66` : "rgba(255,255,255,0.1)" }}>
                <Mic2 size={18} color="white" />
              </button>
            </div>

            <AnimatePresence mode="wait">
              {!showLyrics ? (
                <motion.div key="player" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="flex flex-1 flex-col items-center px-8 pt-4">

                  {/* Album Art */}
                  <motion.div
                    animate={playing ? { scale: 1, boxShadow: `0 30px 80px ${bgGrad[0]}66` } : { scale: 0.88, boxShadow: "0 10px 30px rgba(0,0,0,0.4)" }}
                    transition={{ duration: 0.4 }}
                    className="mt-2 overflow-hidden rounded-3xl"
                    style={{ width: 280, height: 280 }}>
                    <CoverArt track={current} size={280} rounded="rounded-3xl" />
                  </motion.div>

                  {/* Track Info */}
                  <div className="mt-8 w-full flex items-center justify-between">
                    <div className="flex-1">
                      <h2 className="text-2xl font-bold text-white leading-tight">{current.name}</h2>
                      <p className="mt-1 text-base text-white/60">{current.artist}</p>
                    </div>
                    <button onClick={() => toggleFav(current)}
                      className="grid h-11 w-11 place-items-center rounded-full"
                      style={{ background: "rgba(255,255,255,0.08)" }}>
                      <Heart size={22} fill={favIds.has(current.url_id) ? "#f43f5e" : "none"}
                        color={favIds.has(current.url_id) ? "#f43f5e" : "rgba(255,255,255,0.7)"} />
                    </button>
                  </div>

                  {/* Quality Badge */}
                  <div className="mt-3 w-full flex gap-2">
                    {(["128", "320", "flac"] as QualityKey[]).map(q => (
                      <button key={q} onClick={() => { setQuality(q); showToast(`کیفیت ${q} انتخاب شد`); }}
                        className="rounded-full px-3 py-1 text-xs font-bold transition-all"
                        style={{
                          background: quality === q ? bgGrad[0] : "rgba(255,255,255,0.08)",
                          color: quality === q ? "white" : "rgba(255,255,255,0.4)",
                          border: quality === q ? `1px solid ${bgGrad[0]}` : "1px solid rgba(255,255,255,0.1)"
                        }}>
                        {q === "flac" ? "FLAC" : q}
                      </button>
                    ))}
                  </div>

                  {/* Progress */}
                  <div className="mt-6 w-full">
                    <div className="relative h-1.5 w-full overflow-hidden rounded-full"
                      style={{ background: "rgba(255,255,255,0.12)" }}
                      onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const p = (e.clientX - rect.left) / rect.width;
                        setProgress(p * 100);
                        setCurrentTime(p * duration);
                      }}>
                      <motion.div className="absolute inset-y-0 left-0 rounded-full"
                        style={{ width: `${progress}%`, background: `linear-gradient(90deg, ${bgGrad[0]}, ${bgGrad[1]})` }} />
                    </div>
                    <div className="mt-2 flex justify-between text-xs text-white/40">
                      <span>{fmt(currentTime)}</span>
                      <span>{fmt(duration)}</span>
                    </div>
                  </div>

                  {/* Controls */}
                  <div className="mt-4 flex w-full items-center justify-between">
                    <button onClick={() => { setShuffle(s => !s); showToast(shuffle ? "شافل خاموش" : "شافل روشن"); }}
                      className="grid h-10 w-10 place-items-center rounded-full transition"
                      style={{ color: shuffle ? bgGrad[0] : "rgba(255,255,255,0.4)" }}>
                      <Shuffle size={20} />
                    </button>
                    <button onClick={() => playNext(-1)}
                      className="grid h-12 w-12 place-items-center rounded-full"
                      style={{ background: "rgba(255,255,255,0.1)" }}>
                      <SkipBack size={22} color="white" />
                    </button>
                    <button onClick={() => setPlaying(p => !p)}
                      className="grid h-16 w-16 place-items-center rounded-full shadow-2xl"
                      style={{ background: `linear-gradient(135deg, ${bgGrad[0]}, ${bgGrad[1]})`, boxShadow: `0 8px 32px ${bgGrad[0]}80` }}>
                      {playing ? <Pause size={28} color="white" fill="white" /> : <Play size={28} color="white" fill="white" />}
                    </button>
                    <button onClick={() => playNext(1)}
                      className="grid h-12 w-12 place-items-center rounded-full"
                      style={{ background: "rgba(255,255,255,0.1)" }}>
                      <SkipForward size={22} color="white" />
                    </button>
                    <button onClick={() => { setRepeat(r => !r); showToast(repeat ? "تکرار خاموش" : "تکرار روشن"); }}
                      className="grid h-10 w-10 place-items-center rounded-full"
                      style={{ color: repeat ? bgGrad[1] : "rgba(255,255,255,0.4)" }}>
                      <Repeat size={20} />
                    </button>
                  </div>

                  {/* Volume */}
                  <div className="mt-5 w-full flex items-center gap-3">
                    <Volume2 size={16} color="rgba(255,255,255,0.4)" />
                    <input type="range" min={0} max={100} value={volume}
                      onChange={e => setVolume(Number(e.target.value))}
                      className="flex-1 accent-white h-1" />
                  </div>
                </motion.div>
              ) : (
                /* Lyrics View */
                <motion.div key="lyrics" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  ref={lyricsRef} className="flex-1 overflow-y-auto px-8 pt-8 pb-4">
                  <h3 className="mb-6 text-center text-sm font-semibold text-white/40">متن آهنگ</h3>
                  <div className="flex flex-col gap-5">
                    {MOCK_LYRICS.map((line, i) => (
                      <motion.p key={i}
                        animate={{ scale: activeLyric === i ? 1.05 : 1, opacity: activeLyric === i ? 1 : 0.35 }}
                        className={`text-center text-xl leading-relaxed font-semibold transition-all ${activeLyric === i ? "text-white" : "text-white/30"}`}
                        style={activeLyric === i ? { textShadow: `0 0 30px ${bgGrad[0]}` } : {}}>
                        {line.text}
                      </motion.p>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Mini Player ── */}
      <AnimatePresence>
        {current && !showPlayer && (
          <motion.div initial={{ y: 80 }} animate={{ y: 0 }} exit={{ y: 80 }}
            className="fixed bottom-16 left-3 right-3 z-30 cursor-pointer overflow-hidden rounded-2xl"
            style={{ background: `linear-gradient(135deg, ${bgGrad[0]}cc, ${bgGrad[1]}cc)`, backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.15)" }}
            onClick={() => setShowPlayer(true)}>
            {/* progress bar on top */}
            <div className="h-0.5 w-full" style={{ background: "rgba(255,255,255,0.1)" }}>
              <div className="h-full rounded-full bg-white/70" style={{ width: `${progress}%` }} />
            </div>
            <div className="flex items-center gap-3 p-3">
              <CoverArt track={current} size={44} rounded="rounded-xl" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">{current.name}</p>
                <p className="truncate text-xs text-white/60">{current.artist}</p>
              </div>
              <button onClick={e => { e.stopPropagation(); toggleFav(current); }}
                className="grid h-9 w-9 place-items-center rounded-full"
                style={{ background: "rgba(255,255,255,0.15)" }}>
                <Heart size={16} fill={favIds.has(current.url_id) ? "#f43f5e" : "none"}
                  color={favIds.has(current.url_id) ? "#f43f5e" : "white"} />
              </button>
              <button onClick={e => { e.stopPropagation(); setPlaying(p => !p); }}
                className="grid h-9 w-9 place-items-center rounded-full bg-white">
                {playing ? <Pause size={16} color="#000" fill="#000" /> : <Play size={16} color="#000" fill="#000" />}
              </button>
              <button onClick={e => { e.stopPropagation(); playNext(1); }}
                className="grid h-9 w-9 place-items-center rounded-full"
                style={{ background: "rgba(255,255,255,0.15)" }}>
                <SkipForward size={16} color="white" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Content Area ── */}
      <div className="relative z-10 pb-36 pt-0">

        {/* HOME */}
        {view === "home" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {/* Header */}
            <div className="px-5 pt-14 pb-2 flex items-center justify-between">
              <div>
                <p className="text-xs text-white/40">نُوا موزیک</p>
                <h1 className="text-2xl font-bold text-white">سلام 👋</h1>
              </div>
              <div className="grid h-10 w-10 place-items-center rounded-full"
                style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" }}>
                <Sparkles size={18} color="rgba(255,255,255,0.7)" />
              </div>
            </div>

            {/* Search Bar */}
            <div className="mx-5 mt-4"
              onClick={() => setView("search")}>
              <div className="flex h-12 items-center gap-3 rounded-2xl px-4"
                style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.10)" }}>
                <Search size={18} color="rgba(255,255,255,0.4)" />
                <span className="text-sm text-white/30">جستجوی آهنگ یا خواننده...</span>
              </div>
            </div>

            {/* Featured Card */}
            {tracks[0] && (
              <div className="mx-5 mt-5 overflow-hidden rounded-3xl"
                style={{ background: `linear-gradient(135deg, ${getGradient(tracks[0].url_id)[0]}, ${getGradient(tracks[0].url_id)[2]})` }}>
                <div className="flex items-end gap-4 p-5 pt-16">
                  <CoverArt track={tracks[0]} size={80} rounded="rounded-2xl"
                    className="shadow-2xl ring-2 ring-white/20" />
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-white/60 uppercase tracking-widest">پیشنهاد ویژه</p>
                    <h3 className="mt-1 text-lg font-bold text-white leading-tight">{tracks[0].name}</h3>
                    <p className="text-sm text-white/70">{tracks[0].artist}</p>
                    <button onClick={() => playTrack(tracks[0])}
                      className="mt-3 flex items-center gap-2 rounded-full bg-white px-4 py-1.5 text-sm font-bold shadow-lg"
                      style={{ color: getGradient(tracks[0].url_id)[0] }}>
                      <Play size={14} fill="currentColor" /> پخش
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Artists Row */}
            <div className="mt-6">
              <div className="flex items-center justify-between px-5 mb-3">
                <h2 className="text-base font-bold text-white">خواننده‌ها</h2>
                <button className="text-xs text-white/40">همه</button>
              </div>
              <div className="flex gap-4 overflow-x-auto px-5 pb-1 scrollbar-hide">
                {ARTISTS.map(artist => (
                  <button key={artist.id} onClick={() => { setSelectedArtist(artist); setView("artist"); }}
                    className="flex flex-col items-center gap-2 shrink-0">
                    <div className="h-16 w-16 overflow-hidden rounded-full ring-2 ring-white/10">
                      <img src={artist.img} alt={artist.name} className="h-full w-full object-cover" />
                    </div>
                    <span className="text-xs text-white/70 text-center">{artist.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Track List */}
            <div className="mt-6 px-5">
              <h2 className="mb-3 text-base font-bold text-white">موسیقی ایرانی 🇮🇷</h2>
              <div className="flex flex-col gap-2">
                {tracks.map((track, i) => (
                  <TrackRow key={track.url_id} track={track} index={i}
                    isCurrent={current?.url_id === track.url_id}
                    isPlaying={playing && current?.url_id === track.url_id}
                    isFav={favIds.has(track.url_id)}
                    onPlay={() => playTrack(track)}
                    onFav={() => toggleFav(track)}
                    accent={bgGrad[0]} />
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* SEARCH */}
        {view === "search" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="px-5 pt-14">
            <h1 className="mb-4 text-2xl font-bold text-white">جستجو</h1>
            <form onSubmit={e => { e.preventDefault(); doSearch(query); }}
              className="flex h-12 items-center gap-3 rounded-2xl px-4"
              style={{ background: "rgba(255,255,255,0.09)", border: "1px solid rgba(255,255,255,0.13)" }}>
              <Search size={18} color="rgba(255,255,255,0.4)" />
              <input value={query} onChange={e => setQuery(e.target.value)}
                placeholder="آهنگ، خواننده..."
                autoFocus
                className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/30" />
              {query && <button type="button" onClick={() => { setQuery(""); setSearchResults([]); }}>
                <X size={16} color="rgba(255,255,255,0.4)" />
              </button>}
            </form>

            {/* Quick tags */}
            <div className="mt-4 flex flex-wrap gap-2">
              {["داریوش", "گوگوش", "ابی", "هایده", "ستار", "نمجو"].map(tag => (
                <button key={tag} onClick={() => { setQuery(tag); doSearch(tag); }}
                  className="rounded-full px-3 py-1.5 text-xs text-white/70 transition"
                  style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.10)" }}>
                  {tag}
                </button>
              ))}
            </div>

            {loadingSearch ? (
              <div className="mt-16 flex flex-col items-center gap-3">
                <Loader2 size={28} color="rgba(255,255,255,0.4)" className="animate-spin" />
                <p className="text-sm text-white/40">در حال جستجو...</p>
              </div>
            ) : searchResults.length > 0 ? (
              <div className="mt-5 flex flex-col gap-2">
                <p className="mb-2 text-xs text-white/40">{searchResults.length} نتیجه</p>
                {searchResults.map((track, i) => (
                  <TrackRow key={track.url_id} track={track} index={i}
                    isCurrent={current?.url_id === track.url_id}
                    isPlaying={playing && current?.url_id === track.url_id}
                    isFav={favIds.has(track.url_id)}
                    onPlay={() => playTrack(track)}
                    onFav={() => toggleFav(track)}
                    accent={bgGrad[0]} />
                ))}
              </div>
            ) : (
              <div className="mt-16 flex flex-col items-center gap-2">
                <Search size={36} color="rgba(255,255,255,0.1)" />
                <p className="text-sm text-white/30">جستجو کن تا نتایج ببینی</p>
              </div>
            )}
          </motion.div>
        )}

        {/* ARTIST */}
        {view === "artist" && selectedArtist && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="relative h-56 overflow-hidden">
              <img src={selectedArtist.img} alt={selectedArtist.name}
                className="h-full w-full object-cover" />
              <div className="absolute inset-0"
                style={{ background: "linear-gradient(to bottom, transparent 30%, #0a0a0f)" }} />
              <button onClick={() => setView("home")}
                className="absolute right-5 top-14 grid h-9 w-9 place-items-center rounded-full"
                style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(10px)" }}>
                <ArrowLeft size={18} color="white" />
              </button>
              <div className="absolute bottom-4 right-5">
                <h2 className="text-3xl font-bold text-white">{selectedArtist.name}</h2>
                <p className="text-sm text-white/60">{selectedArtist.genre}</p>
              </div>
            </div>
            <div className="px-5 mt-4 flex gap-3">
              <button onClick={() => artistTracks[0] && playTrack(artistTracks[0])}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl py-3 text-sm font-bold text-white"
                style={{ background: bgGrad[0] }}>
                <Play size={16} fill="white" /> پخش همه
              </button>
              <button className="flex h-12 w-12 items-center justify-center rounded-2xl"
                style={{ background: "rgba(255,255,255,0.08)" }}>
                <Shuffle size={18} color="rgba(255,255,255,0.7)" />
              </button>
            </div>
            <div className="px-5 mt-5 flex flex-col gap-2">
              {artistTracks.length > 0 ? artistTracks.map((track, i) => (
                <TrackRow key={track.url_id} track={track} index={i}
                  isCurrent={current?.url_id === track.url_id}
                  isPlaying={playing && current?.url_id === track.url_id}
                  isFav={favIds.has(track.url_id)}
                  onPlay={() => playTrack(track)}
                  onFav={() => toggleFav(track)}
                  accent={bgGrad[0]} />
              )) : (
                <p className="text-center text-sm text-white/30 mt-8">آهنگی برای این خواننده موجود نیست</p>
              )}
            </div>
          </motion.div>
        )}

        {/* QUEUE */}
        {view === "queue" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="px-5 pt-14">
            <h1 className="mb-1 text-2xl font-bold text-white">صف پخش</h1>
            <p className="mb-5 text-sm text-white/40">{queue.length} آهنگ</p>
            {queue.length === 0 ? (
              <div className="mt-16 flex flex-col items-center gap-2">
                <ListMusic size={36} color="rgba(255,255,255,0.1)" />
                <p className="text-sm text-white/30">صف پخش خالیه</p>
              </div>
            ) : queue.map((track, i) => (
              <TrackRow key={track.url_id + i} track={track} index={i}
                isCurrent={current?.url_id === track.url_id}
                isPlaying={playing && current?.url_id === track.url_id}
                isFav={favIds.has(track.url_id)}
                onPlay={() => playTrack(track)}
                onFav={() => toggleFav(track)}
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
            <p className="mb-5 text-sm text-white/40">{history.length} آهنگ</p>
            {history.length === 0 ? (
              <div className="mt-16 flex flex-col items-center gap-2">
                <Clock size={36} color="rgba(255,255,255,0.1)" />
                <p className="text-sm text-white/30">هنوز چیزی پخش نکردی</p>
              </div>
            ) : history.map((track, i) => (
              <TrackRow key={track.url_id + i} track={track} index={i}
                isCurrent={current?.url_id === track.url_id}
                isPlaying={playing && current?.url_id === track.url_id}
                isFav={favIds.has(track.url_id)}
                onPlay={() => playTrack(track)}
                onFav={() => toggleFav(track)}
                accent={bgGrad[0]} />
            ))}
          </motion.div>
        )}

        {/* FAVORITES */}
        {view === "favorites" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="px-5 pt-14">
            <h1 className="mb-1 text-2xl font-bold text-white">علاقه‌مندی‌ها</h1>
            <p className="mb-5 text-sm text-white/40">{favorites.length} آهنگ</p>
            {favorites.length === 0 ? (
              <div className="mt-16 flex flex-col items-center gap-2">
                <Heart size={36} color="rgba(255,255,255,0.1)" />
                <p className="text-sm text-white/30">هنوز آهنگی لایک نکردی</p>
              </div>
            ) : favorites.map((track, i) => (
              <TrackRow key={track.url_id} track={track} index={i}
                isCurrent={current?.url_id === track.url_id}
                isPlaying={playing && current?.url_id === track.url_id}
                isFav={true}
                onPlay={() => playTrack(track)}
                onFav={() => toggleFav(track)}
                accent={bgGrad[0]} />
            ))}
          </motion.div>
        )}
      </div>

      {/* ── Bottom Nav ── */}
      <div className="fixed bottom-0 left-0 right-0 z-20"
        style={{ background: "rgba(10,10,15,0.85)", backdropFilter: "blur(24px)", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="flex items-center justify-around py-2 pb-4">
          {([
            { id: "home", icon: Home, label: "خانه" },
            { id: "search", icon: Search, label: "جستجو" },
            { id: "queue", icon: ListMusic, label: "صف" },
            { id: "history", icon: Clock, label: "تاریخچه" },
            { id: "favorites", icon: Heart, label: "لایک" },
          ] as { id: View; icon: any; label: string }[]).map(({ id, icon: Icon, label }) => (
            <button key={id} onClick={() => setView(id)}
              className="flex flex-col items-center gap-1 px-3 py-1 transition-all">
              <Icon size={22} color={view === id ? bgGrad[0] : "rgba(255,255,255,0.35)"}
                fill={view === id && id === "favorites" ? bgGrad[0] : "none"} />
              <span className="text-[10px] font-medium" style={{ color: view === id ? bgGrad[0] : "rgba(255,255,255,0.3)" }}>
                {label}
              </span>
            </button>
          ))}
        </div>
      </div>

      <Toast msg={toast} />
    </div>
  );
}

// ─── Track Row ────────────────────────────────────────────────────────────────
function TrackRow({ track, index, isCurrent, isPlaying, isFav, onPlay, onFav, accent }: {
  track: Track; index: number; isCurrent: boolean; isPlaying: boolean;
  isFav: boolean; onPlay: () => void; onFav: () => void; accent: string;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      onClick={onPlay}
      className="flex cursor-pointer items-center gap-3 rounded-2xl p-3 transition-all active:scale-[0.98]"
      style={{
        background: isCurrent ? `${accent}22` : "rgba(255,255,255,0.04)",
        border: `1px solid ${isCurrent ? `${accent}44` : "rgba(255,255,255,0.07)"}`,
      }}>
      <div className="relative shrink-0">
        <CoverArt track={track} size={48} rounded="rounded-xl" />
        {isCurrent && (
          <div className="absolute inset-0 flex items-center justify-center rounded-xl"
            style={{ background: "rgba(0,0,0,0.45)" }}>
            {isPlaying
              ? <Pause size={16} color="white" fill="white" />
              : <Play size={16} color="white" fill="white" />}
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold" style={{ color: isCurrent ? accent : "white" }}>
          {track.name}
        </p>
        <p className="truncate text-xs text-white/50">{track.artist} · {track.source}</p>
      </div>
      <button onClick={e => { e.stopPropagation(); onFav(); }}
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full transition"
        style={{ background: "rgba(255,255,255,0.06)" }}>
        <Heart size={15} fill={isFav ? "#f43f5e" : "none"} color={isFav ? "#f43f5e" : "rgba(255,255,255,0.4)"} />
      </button>
    </motion.div>
  );
}
