import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ChevronDown,
  Heart,
  Home,
  Loader2,
  Music2,
  Pause,
  Play,
  Search,
  Shuffle,
  SkipBack,
  SkipForward,
  Sparkles,
  Volume2,
  X,
  Globe,
  Check,
  Zap,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import {
  searchTracks,
  getPlayInfo,
  fetchCover,
  constructCover,
  type GdTrack,
  type Source,
  type QualityKey,
  type PlayInfo,
} from "./lib/gdstudio";

type View = "home" | "search";

const SOURCES: { id: Source; name: string; icon: string; note?: string }[] = [
  { id: "netease", name: "نت‌ایز (پخش مطمئن)", icon: "🎶", note: "توصیه‌شده" },
  { id: "kuwo", name: "کووو", icon: "🎧" },
  { id: "joox", name: "جاکس", icon: "🎵" },
  { id: "tencent", name: "کیو‌کیو", icon: "🎼" },
];

const QUALITIES: { key: QualityKey; label: string; br: number }[] = [
  { key: "128", label: "۱۲۸", br: 128 },
  { key: "320", label: "۳۲۰", br: 320 },
  { key: "flac", label: "FLAC", br: 999 },
];

// خواننده‌های ایرانی برای صفحه اصلی (جستجو در نت‌ایز)
const IRANIAN_ARTISTS = [
  "Dariush", "Googoosh", "Ebi", "Hayedeh", "Morteza", "Sattar",
  "Mohsen Namjoo", "Homayoun Shajarian", "Reza Sadeghi", "Maziar",
  "Aref", "Vigen", "Mahasti", "Leila Forouhar", "Andy", "Kourosh",
];

const QUICK_TAGS = [
  { label: "داریوش", query: "Dariush" },
  { label: "گوگوش", query: "Googoosh" },
  { label: "ابی", query: "Ebi" },
  { label: "هایده", query: "Hayedeh" },
  { label: "مرتضی", query: "Morteza" },
  { label: "ستار", query: "Sattar" },
  { label: "نمجو", query: "Mohsen Namjoo" },
  { label: "ویگن", query: "Vigen" },
];

const glass =
  "border border-white/20 bg-white/[0.11] shadow-[inset_0_1px_0_rgba(255,255,255,0.28),0_20px_70px_rgba(0,0,0,0.35)] backdrop-blur-3xl";

const FALLBACK_GRADIENTS = [
  "from-rose-500 via-pink-500 to-purple-600",
  "from-amber-400 via-orange-500 to-rose-500",
  "from-cyan-400 via-blue-500 to-indigo-600",
  "from-emerald-400 via-teal-500 to-cyan-600",
  "from-fuchsia-500 via-purple-500 to-blue-600",
  "from-yellow-400 via-amber-500 to-orange-600",
];

function gradFor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return FALLBACK_GRADIENTS[h % FALLBACK_GRADIENTS.length];
}

function formatTime(sec: number) {
  if (!sec || !Number.isFinite(sec)) return "0:00";
  const m = Math.floor(sec / 60);
  const s = String(Math.floor(sec % 60)).padStart(2, "0");
  return `${m}:${s}`;
}

function qualityLabel(br: number): string {
  if (br >= 700) return "FLAC";
  if (br >= 320) return "۳۲۰";
  if (br >= 192) return "۱۹۲";
  return "۱۲۸";
}

// تصویر کاور با lazy fetch + cache
function Cover({
  track,
  className,
  rounded = "rounded-2xl",
}: {
  track: GdTrack;
  className?: string;
  rounded?: string;
}) {
  const [url, setUrl] = useState<string | null>(() => constructCover(track.source, track.pic_id));
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    const direct = constructCover(track.source, track.pic_id);
    if (direct) {
      setUrl(direct);
      return;
    }
    setUrl(null);
    fetchCover(track).then((u) => {
      if (active && u) setUrl(u);
    });
    return () => {
      active = false;
    };
  }, [track.source, track.pic_id]);

  if (!url || failed) {
    return (
      <div className={`${rounded} bg-gradient-to-br ${gradFor(track.id)} ${className ?? ""} relative overflow-hidden`}>
        <Music2 className="absolute left-1/2 top-1/2 h-7 w-7 -translate-x-1/2 -translate-y-1/2 text-white/40" />
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={track.name}
      loading="lazy"
      onError={() => setFailed(true)}
      className={`${rounded} object-cover ${className ?? ""}`}
    />
  );
}

function App() {
  const [view, setView] = useState<View>("home");
  const [homeTracks, setHomeTracks] = useState<GdTrack[]>([]);
  const [results, setResults] = useState<GdTrack[]>([]);
  const [query, setQuery] = useState("");
  const [source, setSource] = useState<Source>("netease");
  const [loadingHome, setLoadingHome] = useState(true);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [showSourcePicker, setShowSourcePicker] = useState(false);

  const [current, setCurrent] = useState<GdTrack | null>(null);
  const [playInfo, setPlayInfo] = useState<PlayInfo | null>(null);
  const [quality, setQuality] = useState<QualityKey>("128");
  const [playing, setPlaying] = useState(false);
  const [loadingUrl, setLoadingUrl] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const [favorites, setFavorites] = useState<GdTrack[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("nova_fav_gd") || "[]");
    } catch {
      return [];
    }
  });
  const [toast, setToast] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.clearTimeout(window.__novaToast);
    window.__novaToast = window.setTimeout(() => setToast(null), 2600);
  }, []);

  useEffect(() => {
    localStorage.setItem("nova_fav_gd", JSON.stringify(favorites));
  }, [favorites]);

  // بارگذاری صفحه اصلی — خواننده‌های ایرانی از نت‌ایز
  useEffect(() => {
    let ignore = false;
    async function loadHome() {
      try {
        const shuffled = [...IRANIAN_ARTISTS].sort(() => Math.random() - 0.5).slice(0, 8);
        const collected: GdTrack[] = [];
        for (const artist of shuffled) {
          if (collected.length >= 24) break;
          const list = await searchTracks(artist, "netease", 6);
          if (!ignore) {
            collected.push(...list.filter((t) => t.pic_id || true));
          }
        }
        // حذف تکراری
        const unique = Array.from(new Map(collected.map((t) => [t.url_id, t])).values());
        if (!ignore && unique.length > 0) {
          setHomeTracks(unique.sort(() => Math.random() - 0.5).slice(0, 30));
        }
      } catch {
        if (!ignore) showToast("اتصال به سرور ناموفق بود.");
      } finally {
        if (!ignore) setLoadingHome(false);
      }
    }
    loadHome();
    return () => {
      ignore = true;
    };
  }, [showToast]);

  const favoriteIds = useMemo(() => new Set(favorites.map((f) => f.url_id)), [favorites]);
  const heroTrack = homeTracks[0] || null;
  const listSource = view === "search" ? results : homeTracks;

  async function runSearch(term = query) {
    const clean = term.trim();
    if (!clean) return;
    setView("search");
    setLoadingSearch(true);
    try {
      const found = await searchTracks(clean, source, 40);
      const unique = Array.from(new Map(found.map((t) => [t.url_id, t])).values());
      setResults(unique);
      if (unique.length === 0) showToast("نتیجه‌ای پیدا نشد.");
    } catch {
      showToast("خطا در جستجو.");
    } finally {
      setLoadingSearch(false);
    }
  }

  async function resolveAndPlay(track: GdTrack, q: QualityKey, preserveTime?: number) {
    setLoadingUrl(true);
    const info = await getPlayInfo(track.source, track.url_id, q);
    setLoadingUrl(false);

    if (!info) {
      showToast("پخش این آهنگ از این منبع ممکن نشد.");
      return false;
    }

    setPlayInfo(info);
    const audio = audioRef.current;
    if (!audio) return true;

    const wasPlaying = playing || preserveTime !== undefined;
    const resumeAt = preserveTime ?? 0;

    audio.src = info.url;
    const onReady = () => {
      if (resumeAt > 0 && Number.isFinite(resumeAt)) {
        try {
          audio.currentTime = Math.min(resumeAt, (audio.duration || resumeAt) - 1);
        } catch {
          /* ignore */
        }
      }
      if (wasPlaying) {
        audio.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
      }
      audio.removeEventListener("loadedmetadata", onReady);
    };
    audio.addEventListener("loadedmetadata", onReady);

    if (preserveTime === undefined) {
      setProgress(0);
      setCurrentTime(0);
      audio
        .play()
        .then(() => setPlaying(true))
        .catch(() => setPlaying(false));
    }
    return true;
  }

  async function playTrack(track: GdTrack) {
    if (current?.url_id === track.url_id) {
      togglePlay();
      return;
    }
    setCurrent(track);
    setQuality("128"); // پیش‌فرض ۱۲۸
    setPlaying(true);
    await resolveAndPlay(track, "128");
  }

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio || !current || !playInfo) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      audio.play().then(() => setPlaying(true)).catch(() => showToast("پخش انجام نشد."));
    }
  }

  async function changeQuality(q: QualityKey) {
    if (!current || q === quality) return;
    const prevTime = audioRef.current?.currentTime ?? 0;
    setQuality(q);
    showToast(`کیفیت ${q === "flac" ? "FLAC" : q} در حال بارگذاری...`);
    await resolveAndPlay(current, q, prevTime > 1 ? prevTime : undefined);
  }

  function seek(value: string) {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(audio.duration)) return;
    const t = (Number(value) / 100) * audio.duration;
    audio.currentTime = t;
    setProgress(Number(value));
    setCurrentTime(t);
  }

  function toggleFavorite(track: GdTrack) {
    setFavorites((items) => {
      if (items.some((f) => f.url_id === track.url_id)) {
        showToast("از علاقه‌مندی‌ها حذف شد");
        return items.filter((f) => f.url_id !== track.url_id);
      }
      showToast("به علاقه‌مندی‌ها اضافه شد ❤️");
      return [track, ...items];
    });
  }

  function playNext(dir: 1 | -1) {
    if (!current || listSource.length === 0) return;
    const idx = listSource.findIndex((t) => t.url_id === current.url_id);
    const next = listSource[(idx + dir + listSource.length) % listSource.length];
    if (next) playTrack(next);
  }

  const visibleTracks = view === "search" ? results : homeTracks.slice(0, 20);
  const currentSource = SOURCES.find((s) => s.id === source) ?? SOURCES[0];

  return (
    <div dir="rtl" className="min-h-screen overflow-hidden bg-[#06070b] text-white">
      <audio
        ref={audioRef}
        onTimeUpdate={() => {
          const a = audioRef.current;
          if (!a || !Number.isFinite(a.duration)) return;
          setProgress((a.currentTime / a.duration) * 100);
          setCurrentTime(a.currentTime);
        }}
        onLoadedMetadata={() => {
          if (audioRef.current) setDuration(audioRef.current.duration);
        }}
        onEnded={() => {
          setPlaying(false);
          playNext(1);
        }}
      />

      {/* پس‌زمینه */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -top-28 right-[-20%] h-96 w-96 rounded-full bg-rose-500/20 blur-[100px]" />
        <div className="absolute top-1/4 left-[-18%] h-[30rem] w-[30rem] rounded-full bg-amber-500/15 blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 h-72 w-72 rounded-full bg-emerald-400/10 blur-[100px]" />
      </div>

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.96 }}
            className={`${glass} fixed left-1/2 top-5 z-[60] -translate-x-1/2 rounded-full px-5 py-2.5 text-center text-sm`}
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* انتخاب منبع */}
      <AnimatePresence>
        {showSourcePicker && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setShowSourcePicker(false)}
          >
            <motion.div
              initial={{ y: 120 }}
              animate={{ y: 0 }}
              exit={{ y: 120 }}
              onClick={(e) => e.stopPropagation()}
              className={`${glass} mx-4 mb-4 w-full max-w-[400px] rounded-[32px] p-4`}
            >
              <div className="mb-4 text-center">
                <h3 className="text-lg font-bold">منبع جستجو</h3>
                <p className="text-xs text-white/50">نت‌ایز برای پخش مطمئن توصیه می‌شود</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {SOURCES.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      setSource(s.id);
                      setShowSourcePicker(false);
                      showToast(`منبع: ${s.name}`);
                    }}
                    className={`flex items-center gap-3 rounded-2xl p-3 text-right transition ${
                      source === s.id ? "bg-white/20" : "bg-white/5 hover:bg-white/10"
                    }`}
                  >
                    <span className="text-xl">{s.icon}</span>
                    <span className="flex-1 text-sm font-medium">{s.name}</span>
                    {source === s.id && <Check className="h-4 w-4 text-emerald-400" />}
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="relative z-10 mx-auto flex min-h-screen w-full max-w-[430px] flex-col px-4 pb-44 pt-4">
        <header className="flex items-center justify-between py-2">
          <button className={`${glass} grid h-11 w-11 place-items-center rounded-full`}>
            <ChevronDown className="h-5 w-5" />
          </button>
          <div className="text-center">
            <p className="text-[11px] text-white/55">پخش آنلاین • FLAC</p>
            <h1 className="text-lg font-black tracking-tight">نُوا موزیک 🎵</h1>
          </div>
          <button onClick={() => setShowSourcePicker(true)} className={`${glass} grid h-11 w-11 place-items-center rounded-full`}>
            <Globe className="h-5 w-5" />
          </button>
        </header>

        {/* نشانگر منبع */}
        <button
          onClick={() => setShowSourcePicker(true)}
          className={`${glass} mt-3 flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm`}
        >
          <span>{currentSource.icon}</span>
          <span>{currentSource.name}</span>
          <span className="text-white/40">•</span>
          <span className="text-xs text-white/50">تغییر منبع</span>
        </button>

        {/* جستجو */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            runSearch();
          }}
          className={`${glass} mt-4 flex h-14 items-center gap-3 rounded-[28px] px-4`}
        >
          <Search className="h-5 w-5 text-white/70" />
          <input
            ref={searchRef}
            value={query}
            onFocus={() => setView("search")}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="جستجوی آهنگ یا خواننده..."
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-white/42"
          />
          {query && (
            <button type="button" onClick={() => setQuery("")} className="rounded-full bg-white/10 p-1.5">
              <X className="h-4 w-4" />
            </button>
          )}
        </form>

        {/* تگ‌های سریع ایرانی */}
        <div className="no-scrollbar mt-5 flex gap-2 overflow-x-auto pb-1">
          {QUICK_TAGS.map((t) => (
            <button
              key={t.query}
              onClick={() => {
                setQuery(t.label);
                runSearch(t.query);
              }}
              className="shrink-0 rounded-full border border-white/12 bg-white/[0.07] px-3 py-2 text-xs text-white/75 backdrop-blur-xl transition hover:bg-white/15"
            >
              {t.label}
            </button>
          ))}
        </div>

        {view === "home" ? (
          <>
            <section className="mt-7">
              <div className="mb-3 flex items-end justify-between">
                <div>
                  <p className="text-xs text-white/50">صفحه اصلی</p>
                  <h2 className="text-2xl font-black">موسیقی ایرانی 🇮🇷</h2>
                </div>
                <Sparkles className="h-5 w-5 text-amber-200" />
              </div>

              {heroTrack ? (
                <motion.button
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => playTrack(heroTrack)}
                  className="relative h-[340px] w-full overflow-hidden rounded-[42px] text-right"
                >
                  <Cover track={heroTrack} rounded="rounded-[42px]" className="absolute inset-0 h-full w-full" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/35 to-transparent" />
                  <div className="absolute inset-x-4 bottom-4">
                    <div className={`${glass} rounded-[30px] p-4`}>
                      <div className="mb-3 flex items-center justify-between">
                        <span className="rounded-full bg-white/18 px-3 py-1 text-[11px] text-white/85">پیشنهاد ویژه</span>
                        <span className="flex items-center gap-1 rounded-full bg-rose-400/20 px-2 py-1 text-[10px] font-bold text-rose-100">
                          <Zap className="h-3 w-3" /> کیفیت انتخابی
                        </span>
                      </div>
                      <h3 className="line-clamp-1 text-2xl font-black">{heroTrack.name}</h3>
                      <p className="line-clamp-1 text-sm text-white/65">{heroTrack.artist}</p>
                    </div>
                  </div>
                </motion.button>
              ) : loadingHome ? (
                <div className={`${glass} h-[340px] animate-pulse rounded-[42px]`} />
              ) : (
                <div className={`${glass} grid h-[340px] place-items-center rounded-[42px] text-center`}>
                  <div>
                    <Music2 className="mx-auto mb-3 h-12 w-12 text-white/30" />
                    <p className="text-white/50">موردی یافت نشد. جستجو کن.</p>
                  </div>
                </div>
              )}
            </section>

            <TrackList
              title="بهترین‌های ایرانی"
              tracks={homeTracks.slice(0, 20)}
              current={current}
              playing={playing}
              favIds={favoriteIds}
              onPlay={playTrack}
              onFav={toggleFavorite}
              playBr={playInfo?.br}
            />
          </>
        ) : (
          <section className="mt-7">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-white/50">نتایج در {currentSource.name}</p>
                <h2 className="text-2xl font-black">جستجو</h2>
              </div>
            </div>

            {loadingSearch ? (
              <div className={`${glass} grid place-items-center rounded-[32px] py-12`}>
                <Loader2 className="mb-2 h-7 w-7 animate-spin text-amber-100" />
                <p className="text-sm text-white/60">در حال جستجو...</p>
              </div>
            ) : visibleTracks.length === 0 ? (
              <div className={`${glass} rounded-[28px] p-6 text-center text-sm text-white/55`}>
                نتیجه‌ای نیست. منبع یا کلمه دیگری امتحان کن.
              </div>
            ) : (
              <TrackList
                title=""
                tracks={visibleTracks}
                current={current}
                playing={playing}
                favIds={favoriteIds}
                onPlay={playTrack}
                onFav={toggleFavorite}
                playBr={playInfo?.br}
              />
            )}
          </section>
        )}
      </main>

      {/* پلیر */}
      <AnimatePresence>
        {current && (
          <motion.section
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 60 }}
            className={`${glass} fixed inset-x-0 bottom-[76px] z-40 mx-auto w-[calc(100%-24px)] max-w-[406px] rounded-[32px] p-3`}
          >
            {/* انتخاب کیفیت */}
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                {QUALITIES.map((q) => {
                  const activeQ = quality === q.key;
                  return (
                    <button
                      key={q.key}
                      onClick={() => changeQuality(q.key)}
                      disabled={loadingUrl}
                      className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold transition disabled:opacity-50 ${
                        activeQ
                          ? q.key === "flac"
                            ? "border-transparent bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg shadow-purple-500/30"
                            : "border-white bg-white text-black"
                          : "border-white/15 bg-white/5 text-white/60 hover:bg-white/10"
                      }`}
                    >
                      {q.key === "flac" && <Zap className="h-3 w-3" />}
                      {q.label}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center gap-1 text-[10px] text-white/50">
                {playInfo ? (
                  <span className="rounded-full bg-emerald-500/20 px-2 py-1 font-bold text-emerald-200">
                    {qualityLabel(playInfo.br)} kbps
                  </span>
                ) : loadingUrl ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : null}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Cover track={current} className="h-14 w-14" />
              <div className="min-w-0 flex-1">
                <p className="line-clamp-1 text-sm font-bold">{current.name}</p>
                <p className="line-clamp-1 text-xs text-white/48">{current.artist}</p>
                <div className="mt-1 flex items-center gap-2 text-[10px] text-white/50">
                  <span>{formatTime(currentTime)}</span>
                  <span>/</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>
              <button onClick={togglePlay} className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white text-black">
                {loadingUrl ? <Loader2 className="h-5 w-5 animate-spin" /> : playing ? <Pause className="h-5 w-5 fill-current" /> : <Play className="mr-0.5 h-5 w-5 fill-current" />}
              </button>
            </div>

            <input
              aria-label="progress"
              type="range"
              min="0"
              max="100"
              value={progress}
              onChange={(e) => seek(e.target.value)}
              className="mt-3 w-full accent-white"
            />

            <div className="mt-2 flex items-center justify-between text-white/70">
              <button onClick={() => playNext(-1)}><SkipBack className="h-5 w-5" /></button>
              <button onClick={() => playNext(1)}><SkipForward className="h-5 w-5" /></button>
              <button onClick={() => showToast("پخش تصادفی")}><Shuffle className="h-5 w-5" /></button>
              <Volume2 className="h-5 w-5" />
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* تب‌ها */}
      <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-[430px] px-3 pb-3">
        <div className={`${glass} grid grid-cols-2 rounded-[28px] p-2`}>
          <TabButton active={view === "home"} label="خانه" icon={<Home className="h-5 w-5" />} onClick={() => setView("home")} />
          <TabButton active={view === "search"} label="جستجو" icon={<Search className="h-5 w-5" />} onClick={() => setView("search")} />
        </div>
      </nav>
    </div>
  );
}

function TabButton({ active, label, icon, onClick }: { active: boolean; label: string; icon: ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold transition ${active ? "bg-white text-black" : "text-white/55"}`}>
      {icon}
      {label}
    </button>
  );
}

function TrackList({
  title,
  tracks,
  current,
  playing,
  favIds,
  onPlay,
  onFav,
  playBr,
}: {
  title: string;
  tracks: GdTrack[];
  current: GdTrack | null;
  playing: boolean;
  favIds: Set<string>;
  onPlay: (t: GdTrack) => void;
  onFav: (t: GdTrack) => void;
  playBr?: number;
}) {
  if (tracks.length === 0) return null;
  return (
    <section className="mt-7">
      {title && <h2 className="mb-3 text-xl font-black">{title}</h2>}
      <div className="space-y-2">
        {tracks.map((track, i) => {
          const isCur = current?.url_id === track.url_id;
          const isFav = favIds.has(track.url_id);
          return (
            <motion.article
              key={`${track.url_id}-${i}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.015, 0.4) }}
              onClick={() => onPlay(track)}
              className={`flex cursor-pointer items-center gap-3 rounded-[24px] border border-white/10 p-2.5 transition ${
                isCur ? "bg-white/16" : "bg-white/[0.05] hover:bg-white/10"
              }`}
            >
              <div className="relative h-14 w-14 shrink-0">
                <Cover track={track} className="h-full w-full" />
                {isCur && (
                  <div className="absolute inset-0 grid place-items-center bg-black/40">
                    {playing ? <Pause className="h-5 w-5 fill-current" /> : <Play className="mr-0.5 h-5 w-5 fill-current" />}
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className={`line-clamp-1 text-sm font-bold ${isCur ? "text-amber-200" : ""}`}>{track.name}</p>
                <p className="line-clamp-1 text-xs text-white/45">{track.artist}</p>
                <div className="mt-1 flex items-center gap-1.5 text-[9px] font-black text-white/50">
                  {isCur && playBr ? (
                    <span className="rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-emerald-200">{qualityLabel(playBr)}</span>
                  ) : (
                    <span className="rounded-full bg-white/10 px-1.5 py-0.5">۱۲۸ / ۳۲۰ / FLAC</span>
                  )}
                  <span className="rounded-full bg-white/10 px-1.5 py-0.5">{track.source}</span>
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onFav(track);
                }}
                className="grid h-10 w-10 place-items-center rounded-full bg-white/7 text-white/70"
              >
                <Heart className={`h-5 w-5 ${isFav ? "fill-rose-400 text-rose-400" : ""}`} />
              </button>
            </motion.article>
          );
        })}
      </div>
    </section>
  );
}

declare global {
  interface Window {
    __novaToast?: number;
  }
}

export default App;
