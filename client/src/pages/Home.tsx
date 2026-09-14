import { trpc } from "@/lib/trpc";
import { saveToGitHub, postFeedbackToGitHub, fetchFeedbacksFromGitHub } from "@/lib/github";
import { 
  ArrowUpRight, Bell, ChevronDown, Heart, Menu, Pause, 
  Play, Repeat, Search, SkipBack, SkipForward, Volume2, VolumeX, X, 
  ChevronRight, Lock, Tag, Sun, Moon, Edit2, Trash2, MessageSquare, Send, GitCommit, CheckCircle2
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import websiteData from "@/data/website_data.json";

// MẬT KHẨU STUDIO DUY NHẤT
const MASTER_PASSWORD = "jk0807";

type Track = {
  id: number;
  title: string;
  artist?: string | null;
  audioUrl: string;
};

type Character = {
  id: number;
  slug: string;
  name: string;
  imageUrl?: string | null;
  caption?: string | null;
  titleColor?: string | null;
  bodyColor?: string | null;
  colorSync?: number;
  tagsJson?: string | null;
  externalUrl?: string | null;
  accessTitle?: string | null;
  sectionsJson?: string | null;
  passwordProtected?: number;
  password?: string | null;
  passwordHint?: string | null;
  description?: string | null;
  backstory?: string | null;
  firstMessage?: string | null;
  section?: string | null;
  featured?: number;
  comingSoon?: number;
  favoriteCount?: number;
  createdAt?: string | Date;
};

type NotificationItem = {
  id: string;
  title: string;
  body: string;
  publishedAt: string;
  pinned: boolean;
};

type CharacterFeedback = {
  id: string;
  characterId: number;
  authorName: string;
  content: string;
  createdAt: string;
};

type LoveParticle = { id: number; x: number; y: number; delay: number; rotation: number; scale: number };
type LoveSpark = { id: number; x: number; y: number; rotation: number; particles: LoveParticle[] };
const createLoveSpark = (clientX: number, clientY: number): LoveSpark => ({ id: Date.now() + Math.round(Math.random() * 1000), x: clientX, y: clientY, rotation: -10 + Math.random() * 20, particles: Array.from({ length: 7 }, (_, index) => ({ id: index, x: 6 + Math.random() * 88, y: 8 + Math.random() * 82, delay: index * 38 + Math.round(Math.random() * 100), rotation: -20 + Math.random() * 40, scale: 0.65 + Math.random() * 0.7 })) });
const rabbitLogo = "/brand/lalapine-rabbit-logo.png";

function resolveColors(c?: any) {
  const titleColor = String(c?.titleColor || "#eff8ff");
  const bodyColor = (c?.colorSync ? titleColor : String(c?.bodyColor || "#9db8d4"));
  return { titleColor, bodyColor };
}

function sanitizeCharacter(c: any): Character {
  if (!c || typeof c !== "object") {
    return { id: Date.now(), slug: "rabbit", name: "Chú thỏ nhỏ", section: "new", tagsJson: "[]" };
  }
  return {
    ...c,
    id: c.id || Date.now(),
    name: String(c.name || "Chú thỏ nhỏ"),
    slug: String(c.slug || "tho"),
    caption: String(c.caption || ""),
    section: String(c.section || "new").toLowerCase(),
    tagsJson: typeof c.tagsJson === "string" ? c.tagsJson : JSON.stringify(c.tagsJson || []),
    imageUrl: c.imageUrl || null,
    titleColor: c.titleColor || "#eff8ff",
    bodyColor: c.bodyColor || "#9db8d4",
  };
}

function safeSectionsOf(c?: Character | null): string[] {
  if (!c) return ["new"];
  try {
    if (c.sectionsJson) {
      const parsed = JSON.parse(c.sectionsJson);
      if (Array.isArray(parsed) && parsed.length) return parsed.map((s) => String(s || "").toLowerCase());
    }
  } catch {}
  return [String(c.section || "new").toLowerCase()];
}

function safeIsIn(c: Character | null | undefined, targetSection: string): boolean {
  if (!c) return false;
  const target = String(targetSection || "").toLowerCase();
  const currentSection = String(c.section || "").toLowerCase();
  if (currentSection === target) return true;
  return safeSectionsOf(c).includes(target);
}

function tagsOf(character?: Character | null) {
  if (!character || !character.tagsJson) return [];
  try { 
    const value = JSON.parse(character.tagsJson); 
    return Array.isArray(value) ? value.map((t) => String(t || "").trim()).filter(Boolean) : []; 
  } catch { 
    return String(character.tagsJson || "").split(",").map((tag) => String(tag || "").trim()).filter(Boolean); 
  }
}

function visitorId() { 
  const key = "lalapine-visitor"; 
  try {
    const existing = localStorage.getItem(key); 
    if (existing) return existing; 
    const value = crypto.randomUUID(); 
    localStorage.setItem(key, value); 
    return value; 
  } catch {
    return "guest-user";
  }
}

function sanitizeRichText(value?: string | null) {
  const raw = value || "";
  if (!raw) return "";
  if (!/<[a-z][\s\S]*>/i.test(raw)) {
    return raw.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br />");
  }
  const container = document.createElement("div");
  container.innerHTML = raw;
  container.querySelectorAll("script,style,iframe,object,embed,form,meta,link").forEach((node) => node.remove());
  return container.innerHTML;
}
function renderRichText(value?: string | null) { return sanitizeRichText(value) || "Nội dung đang được gieo mầm."; }
async function fileToDataUrl(file: File) { return await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file); }); }
function encodeStorageUrl(value?: string | null) { if (!value || !value.startsWith("/manus-storage/")) return value || undefined; const key = value.slice("/manus-storage/".length); return `/manus-storage/${key.split("/").map((part) => encodeURIComponent(decodeURIComponent(part))).join("/")}`; }

function SparklesLayer() {
  const [particles] = useState(() => Array.from({ length: 36 }, (_, index) => ({ id: index, x: Math.random() * 100, duration: 7 + Math.random() * 9, delay: -(Math.random() * 14), drift: -90 + Math.random() * 180, size: .7 + Math.random() * 1.4, tilt: -35 + Math.random() * 70 })));
  return <div className="particle-field" aria-hidden="true">{particles.map((particle) => <i key={particle.id} style={{ "--x": `${particle.x}%`, "--duration": `${particle.duration}s`, "--delay": `${particle.delay}s`, "--drift": `${particle.drift}px`, "--size": particle.size, "--tilt": `${particle.tilt}deg` } as React.CSSProperties} />)}</div>;
}

function LoveLayer({ loveSparks }: { loveSparks: LoveSpark[] }) {
  return <div className="love-sparks" aria-hidden="true">{loveSparks.map((spark) => <span className="love-spark" key={spark.id} style={{ left: spark.x, top: spark.y, transform: `rotate(${spark.rotation}deg)` }}><span className="love-spark__word">Love{spark.particles.map((particle) => <span className="love-spark__glint" key={particle.id} style={{ left: `${particle.x}%`, top: `${particle.y}%`, animationDelay: `${particle.delay}ms`, transform: `rotate(${particle.rotation}deg) scale(${particle.scale})` }}>✦</span>)}</span></span>)}</div>;
}

function Logo() {
  return <Link href="/discover" className="brand-lockup" style={{fontFamily: '"MTD Black Night", "Cormorant Garamond", serif'}}><img src={rabbitLogo} alt="la Lapine" style={{fontFamily: '"MTD Black Night", "Cormorant Garamond", serif'}} /><span style={{fontFamily: '"MTD Black Night", "Cormorant Garamond", serif'}}><strong style={{fontFamily: '"MTD Black Night", "Cormorant Garamond", serif'}}>la Lapine</strong><em style={{fontFamily: '"MTD Black Night", "Cormorant Garamond", serif'}}>nàng thỏ mộng mơ</em></span></Link>;
}

function Header({ onStudio, onNotifications, notificationCount }: { onStudio: () => void; onNotifications: () => void; notificationCount: number }) {
  const [location] = useLocation();
  const jumpTo = (anchor: string) => { if (location === "/discover" || location === "/") { document.getElementById(anchor)?.scrollIntoView({ behavior: "smooth", block: "start" }); window.history.replaceState({}, "", `/discover#${anchor}`); } else { window.location.href = `/discover#${anchor}`; } };
  return <header className="site-header"><Logo /><nav className="site-nav" aria-label="Điều hướng chính"><Link className={location === "/discover" || location === "/" ? "active" : ""} href="/discover#archive">Khám phá</Link><a href="/discover#new" onClick={(event) => { event.preventDefault(); jumpTo("new"); }}>Thỏ mới ra</a><a href="/discover#featured" onClick={(event) => { event.preventDefault(); jumpTo("featured"); }}>Thỏ có sẵn</a><Link className={location === "/meadow" ? "active" : ""} href="/meadow#coming">Thỏ chưa ra</Link><button className="nav-notification" onClick={onNotifications}><span className="notification-bell-wrap"><Bell size={13} />{notificationCount > 0 && <b className="notification-badge">{notificationCount > 99 ? "99+" : notificationCount}</b>}</span> Thông báo</button></nav><div className="header-actions"><span className="live-status"><i /> đồng cỏ đang mở</span><button className="studio-trigger" onClick={onStudio} aria-label="Mở studio"><Menu size={18} /></button></div></header>;
}

// MÀN HÌNH BẮT ĐẦU VỚI HIỆU ỨNG POP-UP PHÓNG TO THU NHỎ NGUYÊN BẢN
function StartScreen({ onStart }: { onStart: () => void }) {
  return (
    <div 
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "radial-gradient(circle at 50% 45%, #0c254a 0%, #06122a 68%, #030814 100%)",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        padding: "2rem", textAlign: "center", color: "#edf5ff", overflow: "hidden"
      }}
    >
      <style>{`
        @keyframes center-stage-motion {
          0%, 55% { transform: translateY(40px); }
          100% { transform: translateY(0); }
        }
        @keyframes logo-expand-shrink {
          0% { transform: scale(0.12); opacity: 0; filter: blur(6px); }
          38% { transform: scale(2.4); opacity: 1; filter: blur(0px) drop-shadow(0 0 35px rgba(162, 218, 255, 0.65)); }
          58% { transform: scale(2.4); opacity: 1; filter: blur(0px) drop-shadow(0 0 35px rgba(162, 218, 255, 0.65)); }
          100% { transform: scale(1); opacity: 1; filter: blur(0px) drop-shadow(0 0 18px rgba(162, 218, 255, 0.35)); }
        }
        @keyframes intro-content-fade {
          0% { opacity: 0; transform: translateY(10px); }
          100% { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div style={{ position: "relative", width: "140px", height: "140px", display: "grid", placeItems: "center", marginBottom: "0.8rem", animation: "center-stage-motion 2.8s cubic-bezier(0.2, 1, 0.3, 1) both", zIndex: 10 }}>
        <img src={rabbitLogo} alt="la Lapine" style={{ width: "90px", height: "90px", objectFit: "contain", position: "relative", zIndex: 20, animation: "logo-expand-shrink 2.8s cubic-bezier(0.2, 1, 0.3, 1) both" }} />
      </div>

      <div style={{ animation: "intro-content-fade 1.5s ease-out 2.4s both", zIndex: 10 }}>
        <h1 style={{ fontFamily: '"MTD Black Night", "Playfair Display", "Cormorant Garamond", serif', fontSize: "clamp(2.4rem, 5.5vw, 3.6rem)", margin: "0 0 0.35rem", letterSpacing: "0.04em", color: "#f1f8ff", textShadow: "0 0 20px rgba(173, 214, 255, 0.25)" }}>
          la Lapine
        </h1>

        <p style={{ fontSize: "12px", color: "#9db8d4", margin: "0 0 1.8rem", letterSpacing: "0.08em", textTransform: "lowercase", fontFamily: '"DM Mono", monospace', opacity: 0.85 }}>
          không dành cho người dưới 18 tuổi.
        </p>

        <button 
          className="primary-button" 
          onClick={onStart}
          style={{ minHeight: "46px", padding: "0 2.2rem", fontSize: "12.5px", letterSpacing: "0.12em", textTransform: "uppercase", borderRadius: "999px", boxShadow: "0 0 25px rgba(185, 221, 255, 0.35)", cursor: "pointer" }}
        >
          Bắt đầu hành trình
        </button>
      </div>
    </div>
  );
}

const defaultTracks: Track[] = [
  { id: 1, title: "southbound", artist: "Artemas", audioUrl: "/audio/Artemas - southbound (official visualizer) - Artemas.mp3" },
  { id: 2, title: "Gimme More", artist: "Britney Spears", audioUrl: "/audio/Britney Spears - Gimme More (Official HD Video) - BritneySpearsVEVO.mp3" },
  { id: 3, title: "Toxic", artist: "Britney Spears", audioUrl: "/audio/Britney Spears - Toxic (Official HD Video) - BritneySpearsVEVO.mp3" },
  { id: 4, title: "Everything is romantic", artist: "Charli xcx", audioUrl: "/audio/Charli xcx - Everything is romantic (official lyric video) - Charli xcx.mp3" },
  { id: 5, title: "LET THE WORLD BURN", artist: "Chris Grey", audioUrl: "/audio/Chris Grey - LET THE WORLD BURN (Official Lyric Video) - Chris Grey.mp3" },
  { id: 6, title: "Dark Paradise", artist: "Lana Del Rey", audioUrl: "/audio/Dark Paradise - Lana Del Rey.mp3" },
  { id: 7, title: "Training Season (Live)", artist: "Dua Lipa", audioUrl: "/audio/Dua Lipa - Training Season (Live from the Royal Albert Hall) [Official Performance Video] - Dua Lipa.mp3" },
  { id: 8, title: "UNETHICAL", artist: "Faouzia", audioUrl: "/audio/Faouzia - UNETHICAL (Official Music Video) - Faouzia.mp3" },
  { id: 9, title: "On The Floor", artist: "Jennifer Lopez, Pitbull", audioUrl: "/audio/Jennifer Lopez, Pitbull - On The Floor (Official Music Video) - JenniferLopezVEVO.mp3" },
  { id: 10, title: "Born To Die", artist: "Lana Del Rey", audioUrl: "/audio/Lana Del Rey - Born To Die - LanaDelReyVEVO.mp3" },
  { id: 11, title: "Brooklyn Baby", artist: "Lana Del Rey", audioUrl: "/audio/Lana Del Rey - Brooklyn Baby (Official Audio) - LanaDelReyVEVO.mp3" },
  { id: 12, title: "Doin' Time", artist: "Lana Del Rey", audioUrl: "/audio/Lana Del Rey - Doin' Time - LanaDelReyVEVO.mp3" },
  { id: 13, title: "Ultraviolence", artist: "Lana Del Rey", audioUrl: "/audio/Lana Del Rey - Ultraviolence (Audio) - LanaDelReyVEVO.mp3" },
  { id: 14, title: "Legendary Lovers", artist: "Katy Perry", audioUrl: "/audio/Legendary Lovers - Katy Perry.mp3" },
  { id: 15, title: "When Did You Get Hot", artist: "Sabrina Carpenter", audioUrl: "/audio/Sabrina Carpenter - When Did You Get Hot (Official Lyric Video) - SabrinaCarpenterVEVO.mp3" },
  { id: 16, title: "Sad Girl", artist: "Lana Del Rey", audioUrl: "/audio/Sad Girl - Lana Del Rey.mp3" },
  { id: 17, title: "Salvatore", artist: "Lana Del Rey", audioUrl: "/audio/Salvatore - Lana Del Rey.mp3" },
  { id: 18, title: "Can't Remember to Forget You", artist: "Shakira ft. Rihanna", audioUrl: "/audio/Shakira - Can't Remember to Forget You (Official Video) ft. Rihanna - shakiraVEVO.mp3" },
  { id: 19, title: "back to friends", artist: "sombr", audioUrl: "/audio/sombr - back to friends (official video) - sombr.mp3" },
  { id: 20, title: "undressed", artist: "sombr", audioUrl: "/audio/sombr - undressed (official lyric video) - sombr.mp3" },
  { id: 21, title: "we never dated", artist: "sombr", audioUrl: "/audio/sombr - we never dated (official lyric video) - sombr.mp3" },
  { id: 22, title: "Moth To A Flame", artist: "Swedish House Mafia, The Weeknd", audioUrl: "/audio/Swedish House Mafia and The Weeknd - Moth To A Flame (Official Lyric Video) - SHMVEVO.mp3" },
  { id: 23, title: "A Little Death", artist: "The Neighbourhood", audioUrl: "/audio/The Neighbourhood - A Little Death (Official Audio) - TheNeighbourhoodVEVO.mp3" },
  { id: 24, title: "Afraid", artist: "The Neighbourhood", audioUrl: "/audio/The Neighbourhood - Afraid (Official Audio) - TheNeighbourhoodVEVO.mp3" },
  { id: 25, title: "Sweater Weather", artist: "The Neighbourhood", audioUrl: "/audio/The Neighbourhood - Sweater Weather (Official Video) - TheNeighbourhoodVEVO.mp3" },
  { id: 26, title: "After Hours", artist: "The Weeknd", audioUrl: "/audio/The Weeknd - After Hours (Audio) - The Weeknd.mp3" },
  { id: 27, title: "Call Out My Name", artist: "The Weeknd", audioUrl: "/audio/The Weeknd - Call Out My Name (Official Audio) - The Weeknd.mp3" },
  { id: 28, title: "House Of Balloons / Glass Table Girls", artist: "The Weeknd", audioUrl: "/audio/The Weeknd - House Of Balloons _ Glass Table Girls - The Weeknd.mp3" },
  { id: 29, title: "One Of The Girls", artist: "The Weeknd, JENNIE, Lily-Rose Depp", audioUrl: "/audio/The Weeknd, JENNIE, Lily-Rose Depp - One Of The Girls (Official Video) - TheWeekndVEVO.mp3" },
  { id: 30, title: "The Abyss", artist: "The Weeknd, Lana Del Rey", audioUrl: "/audio/The Weeknd, Lana Del Rey - The Abyss (Audio) - TheWeekndVEVO.mp3" }
];

const fallbackCharacters: Character[] = [
  { id: 201, slug: "mup-sua", name: "Thỏ Múp Sữa", imageUrl: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=900&q=86", caption: "Một chiếc bánh sữa mềm đi lạc vào đồng cỏ xanh.", tagsJson: JSON.stringify(["mới ra lò", "mềm", "ấm áp"]), externalUrl: "https://character.ai/", description: "Múp Sữa thích những buổi chiều có nắng nhạt và một chiếc khăn len vừa đủ ấm.", backstory: "Bạn ấy được tìm thấy trong một hộp sữa rỗng, bên cạnh một bông cỏ bốn lá.", firstMessage: "Bạn có muốn chia đôi chiếc bánh này không?", section: "new", favoriteCount: 128 },
  { id: 202, slug: "ky-tich-a", name: "Thỏ Kỳ Tích Aster", imageUrl: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=900&q=86", caption: "Người giữ những điều nhỏ bé nhưng không thể giải thích.", tagsJson: JSON.stringify(["kỳ tích", "a-z", "phiêu lưu"]), externalUrl: "https://character.ai/", description: "Aster luôn xuất hiện trước một khoảnh khắc kỳ diệu, như thể bạn ấy đã biết từ lâu.", backstory: "Trong cuốn sổ của Aster có tên của mọi người từng tin vào điều không thể.", firstMessage: "Mình nghĩ hôm nay có thể xảy ra một điều rất đẹp.", section: "featured", featured: 1, favoriteCount: 246 },
];

function MusicPlayer({ tracks }: { tracks: Track[] }) {
  const [expanded, setExpanded] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [playlist, setPlaylist] = useState(false);
  const [repeat, setRepeat] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const [trackIndex, setTrackIndex] = useState(() => Math.floor(Math.random() * (tracks.length || 1)));
  const current = tracks[trackIndex] || tracks[0] || defaultTracks[0];
  const audioSrc = useMemo(() => encodeStorageUrl(current?.audioUrl), [current?.audioUrl]);

  const playCurrent = async () => {
    const audio = audioRef.current;
    if (!audio || !audioSrc) return;
    try {
      if (audio.src !== new URL(audioSrc, window.location.href).href) {
        audio.src = audioSrc;
        audio.load();
      }
      await audio.play();
      setPlaying(true);
    } catch {
      setPlaying(false);
    }
  };

  const playCurrentRef = useRef(playCurrent);
  playCurrentRef.current = playCurrent;
  const startedByTapRef = useRef(false);

  useEffect(() => {
    const start = () => {
      if (startedByTapRef.current) return;
      startedByTapRef.current = true;
      void playCurrentRef.current();
    };
    document.addEventListener("pointerdown", start, { once: true });
    document.addEventListener("keydown", start, { once: true });
    return () => {
      document.removeEventListener("pointerdown", start);
      document.removeEventListener("keydown", start);
    };
  }, []);

  const gotoTrack = (index: number) => {
    if (!tracks.length) return;
    const next = ((index % tracks.length) + tracks.length) % tracks.length;
    setTrackIndex(next);
    setPlaying(true);
  };

  const goNext = () => gotoTrack(trackIndex + 1);
  const goPrev = () => gotoTrack(trackIndex - 1);

  const handleEnded = () => {
    if (repeat) {
      const audio = audioRef.current;
      if (audio) {
        audio.currentTime = 0;
        void audio.play();
        setPlaying(true);
      }
      return;
    }
    if (tracks.length <= 1) {
      gotoTrack(0);
      return;
    }
    let next = trackIndex;
    while (next === trackIndex) {
      next = Math.floor(Math.random() * tracks.length);
    }
    gotoTrack(next);
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audioSrc) return;
    audio.src = audioSrc;
    audio.load();
    if (playing) void audio.play().catch(() => setPlaying(false));
  }, [audioSrc]);

  return (
    <div className={`music-dock ${expanded ? "expanded" : ""}`} style={{ alignItems: "flex-end", position: "fixed", left: "clamp(1rem,3vw,2.4rem)", bottom: "1.3rem", zIndex: 30 }}>
      <audio ref={audioRef} src={audioSrc} onEnded={handleEnded} muted={muted} preload="auto" />
      
      <button 
        className="music-disc spinning" 
        onClick={() => setExpanded(!expanded)} 
        style={{ 
          animation: "spin 5s linear infinite", cursor: "pointer", flexShrink: 0,
          background: "radial-gradient(circle, #000000 0 10%, #d4a373 11% 24%, #121212 25% 28%, #1f1f1f 29% 45%, #0f0f0f 46% 48%, #1f1f1f 49% 68%, #0d0d0d 69% 72%, #1a1a1a 73% 100%)",
          border: "1.5px solid rgba(212, 163, 115, 0.45)", boxShadow: "0 10px 30px rgba(0,0,0,0.6), inset 0 0 10px rgba(0,0,0,0.8)", color: "#faedcd"
        }}
        aria-label={expanded ? "Đóng cửa sổ nhạc" : "Mở cửa sổ nhạc"}
      >
        <span style={{ fontSize: "1rem", color: "#faedcd", opacity: 0.9 }}>♪</span>
      </button>

      {expanded && (
        <div className="music-card" style={{ transition: "all 0.25s ease-out" }}>
          <div>
            <span className="eyebrow">la Lapine radio</span>
            <strong>{current.title}</strong>
            <small>{current.artist || "la Lapine"}</small>
          </div>
          <div className="music-actions" style={{ display: "flex", alignItems: "center", gap: "0.35rem", marginTop: "0.75rem" }}>
            <button onClick={goPrev} disabled={tracks.length <= 1}><SkipBack size={15} /></button>
            <button onClick={() => {
              if (playing) {
                audioRef.current?.pause();
                setPlaying(false);
              } else void playCurrent();
            }}>{playing ? <Pause size={15} /> : <Play size={15} />}</button>
            <button onClick={goNext} disabled={tracks.length <= 1}><SkipForward size={15} /></button>
            <button onClick={() => setRepeat(!repeat)} className={repeat ? "selected" : ""} title={repeat ? "Đang bật lặp lại bài" : "Bật lặp lại 1 bài"}><Repeat size={14} style={{ color: repeat ? "#a8d5ff" : "inherit" }} /></button>
            <button onClick={() => setMuted(!muted)}>{muted ? <VolumeX size={15} /> : <Volume2 size={15} />}</button>
            <button onClick={() => setPlaylist(!playlist)} className={playlist ? "selected" : ""}>Playlist</button>
          </div>

          {playlist && (
            <div className="playlist-list" style={{ maxHeight: "145px", overflowY: "auto", paddingRight: "6px", marginTop: "0.75rem", borderTop: "1px solid rgba(173,214,255,0.14)", display: "flex", flexDirection: "column", gap: "2px" }}>
              {tracks.map((track, index) => (
                <button 
                  key={track.id || index} 
                  onClick={() => { setTrackIndex(index); setPlaying(true); }} 
                  className={index === trackIndex ? "selected" : ""}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 8px", borderRadius: "4px", background: index === trackIndex ? "rgba(173,214,255,0.15)" : "transparent" }}
                >
                  <span style={{ fontSize: "11px" }}>0{index + 1}. {track.title}</span>
                  <small style={{ opacity: 0.7 }}>{track.artist || "la Lapine"}</small>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CharacterCard({ character, onOpen, favorite, onFavorite }: { character: Character; onOpen: () => void; favorite: boolean; onFavorite: () => void }) {
  const safeChar = sanitizeCharacter(character);
  const tags = tagsOf(safeChar);
  const { titleColor, bodyColor } = resolveColors(safeChar);

  return (
    <article 
      className="character-card" 
      onClick={onOpen} 
      style={{ 
        "--title-color": titleColor, 
        "--body-color": bodyColor,
        position: "relative", overflow: "hidden", borderRadius: "16px", cursor: "pointer", border: "1px solid rgba(173,214,255,.2)"
      } as React.CSSProperties}
    >
      <div className="character-art" style={{ aspectRatio: "1 / 1.15", width: "100%", height: "100%", position: "relative", margin: 0, padding: 0 }}>
        {safeChar.imageUrl ? (
          <img src={safeChar.imageUrl} alt={safeChar.name} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        ) : (
          <div className="image-placeholder">☾</div>
        )}
        <div className="art-sheen" />

        <button 
          className={`card-favorite ${favorite ? "is-favorite" : ""}`} 
          onClick={(event) => { event.stopPropagation(); onFavorite(); }} 
          aria-label={favorite ? "Bỏ yêu thích" : "Yêu thích"}
        >
          <Heart size={16} fill={favorite ? "currentColor" : "none"} />
        </button>

        <div style={{ position: "absolute", bottom: "0.65rem", left: "0.65rem", right: "0.65rem", padding: "0.8rem 0.95rem", background: "rgba(255, 255, 255, 0.18)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", borderRadius: "14px", border: "1px solid rgba(255, 255, 255, 0.3)", boxShadow: "0 8px 32px 0 rgba(0, 0, 0, 0.25)", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(255,255,255,0.9)", fontFamily: '"DM Mono", monospace', fontWeight: 600 }}>
              {safeChar.section === "coming" ? "đang ủ mầm" : safeChar.section === "featured" ? "thỏ kỳ tích" : "mới ra lò"}
            </span>
            <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.75)", fontFamily: '"DM Mono", monospace' }}>
              #{String(safeChar.id).slice(-2)}
            </span>
          </div>

          <strong style={{ fontSize: "1.18rem", color: titleColor || "#ffffff", fontFamily: '"Playfair Display", serif', lineHeight: 1.15, margin: "0.15rem 0" }}>
            {safeChar.name}
          </strong>

          {safeChar.caption && (
            <small style={{ fontSize: "11px", color: bodyColor || "rgba(255,255,255,0.85)", lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
              {safeChar.caption}
            </small>
          )}

          {tags.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem", marginTop: "0.35rem" }}>
              {tags.slice(0, 3).map((tag) => (
                <span key={tag} style={{ fontSize: "10px", padding: "2px 7px", borderRadius: "999px", background: "rgba(255, 255, 255, 0.22)", color: "#ffffff", border: "1px solid rgba(255, 255, 255, 0.35)", fontFamily: '"DM Mono", monospace' }}>
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

function DetailModal({ 
  character, 
  onClose, 
  onFavorite, 
  favorite,
  feedbacks,
  onAddFeedback
}: { 
  character: Character; 
  onClose: () => void; 
  onFavorite: () => void; 
  favorite: boolean;
  feedbacks: CharacterFeedback[];
  onAddFeedback: (charId: number, charName: string, author: string, content: string) => void;
}) {
  const safeChar = sanitizeCharacter(character);
  const [open, setOpen] = useState("description");
  const [showAccess, setShowAccess] = useState(false);
  const { titleColor, bodyColor } = resolveColors(safeChar);
  
  const [authorName, setAuthorName] = useState("");
  const [fbContent, setFbContent] = useState("");

  const charFeedbacks = useMemo(() => {
    return feedbacks.filter((f) => f && f.characterId === safeChar.id);
  }, [feedbacks, safeChar.id]);

  const handleSendFeedback = (e: FormEvent) => {
    e.preventDefault();
    if (!fbContent.trim()) {
      toast.error("Vui lòng nhập nội dung lời nhắn.");
      return;
    }
    onAddFeedback(safeChar.id, safeChar.name, authorName.trim() || "Người bạn nhỏ", fbContent.trim());
    toast.success(`Đã gửi lời nhắn công khai đến bé ${safeChar.name}! 💌`);
    setFbContent("");
  };

  const parts = [
    ["description", "Mô tả", safeChar.description], 
    ["backstory", "Câu chuyện phía sau", safeChar.backstory], 
    ["firstMessage", "Tin nhắn đầu tiên", safeChar.firstMessage]
  ] as const;
  
  return (
    <div className="modal-layer">
      <div className="modal-panel detail-modal" style={{ maxHeight: "90vh", overflowY: "auto" }}>
        <button className="icon-button modal-close" onClick={onClose} aria-label="Đóng"><X size={18} /></button>
        <div className="detail-layout">
          <div className="detail-cover">
            {safeChar.imageUrl && <img src={safeChar.imageUrl} alt={safeChar.name} />}
            <span>lưu trữ số<br /><b>#{String(safeChar.id).padStart(3, "0")}</b></span>
          </div>
          <div className="detail-copy" style={{ "--title-color": titleColor, "--body-color": bodyColor } as React.CSSProperties}>
            <span className="eyebrow">rabbit file / la Lapine</span>
            <h1>{safeChar.name}</h1>
            <p className="detail-caption">{safeChar.caption}</p>
            <div className="tag-row detail-tags">
              {tagsOf(safeChar).map((tag) => <span className="tag-chip" key={tag}>#{tag}</span>)}
            </div>
            
            {/* ĐÃ SỬA: NẾU KHÔNG CÓ PASS THÌ BẤM VÀO LÀ BAY THẲNG SANG LINK, CÓ PASS MỚI HIỆN BẢNG NHẬP PASS */}
            <div className="detail-actions">
              <button 
                className="primary-button" 
                onClick={() => {
                  const hasPass = Boolean(safeChar.password && String(safeChar.password).trim());
                  if (hasPass) {
                    setShowAccess(true);
                  } else {
                    if (safeChar.externalUrl) {
                      window.open(safeChar.externalUrl, "_blank", "noopener,noreferrer");
                    }
                  }
                }} 
                disabled={!safeChar.externalUrl}
              >
                Mở cửa trái tim <ArrowUpRight size={15} />
              </button>
              <button className={`secondary-button ${favorite ? "is-favorite" : ""}`} onClick={onFavorite}>
                <Heart size={15} fill={favorite ? "currentColor" : "none"} /> {favorite ? "Đã lưu" : "Lưu lại"}
              </button>
            </div>
            
            <div className="accordions">
              {parts.map(([key, label, content]) => (
                <div className={`accordion-item ${open === key ? "open" : ""}`} key={key}>
                  <button className="accordion-trigger" onClick={() => setOpen(open === key ? "" : key)}>
                    {label}<ChevronDown size={15} />
                  </button>
                  {open === key && (
                    <div 
                      className="accordion-content rich-content-rendered" 
                      style={{ color: "var(--body-color, #9ab1ce)", fontSize: "0.8rem", paddingBottom: "1rem" }}
                      dangerouslySetInnerHTML={{ __html: renderRichText(content) }} 
                    />
                  )}
                </div>
              ))}
            </div>

            {/* MỤC LỜI NHẮN FEEDBACK TỪ KHÁCH */}
            <div style={{ marginTop: "1.6rem", borderTop: "1px solid rgba(173,214,255,0.18)", paddingTop: "1.2rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "0.8rem" }}>
                <MessageSquare size={16} style={{ color: "#a8d5ff" }} />
                <strong style={{ fontSize: "14px", color: "#edf5ff" }}>Hòm thư gửi {safeChar.name} ({charFeedbacks.length})</strong>
              </div>

              <form onSubmit={handleSendFeedback} style={{ display: "grid", gap: "8px", marginBottom: "1rem" }}>
                <input 
                  value={authorName} 
                  onChange={(e) => setAuthorName(e.target.value)} 
                  placeholder="Tên của bạn (để trống = Người bạn nhỏ)" 
                  style={{ width: "100%", height: "36px", padding: "0 10px", borderRadius: "6px", background: "rgba(6,23,49,0.5)", border: "1px solid rgba(173,214,255,0.2)", color: "#edf5ff", fontSize: "12px" }}
                />
                <textarea 
                  rows={2} 
                  value={fbContent} 
                  onChange={(e) => setFbContent(e.target.value)} 
                  placeholder={`Viết lời nhắn gửi đến ${safeChar.name}…`} 
                  style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", background: "rgba(6,23,49,0.5)", border: "1px solid rgba(173,214,255,0.2)", color: "#edf5ff", fontSize: "12px" }}
                />
                <button type="submit" className="primary-button" style={{ minHeight: "34px", fontSize: "11.5px", justifySelf: "end", padding: "0 1rem" }}>
                  Gửi lời nhắn <Send size={13} style={{ marginLeft: "4px" }} />
                </button>
              </form>

              <div style={{ display: "grid", gap: "6px", maxHeight: "180px", overflowY: "auto" }}>
                {charFeedbacks.length > 0 ? (
                  charFeedbacks.map((fb) => (
                    <div key={fb.id} style={{ padding: "8px 10px", borderRadius: "6px", background: "rgba(173,214,255,0.06)", border: "1px solid rgba(173,214,255,0.12)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2px" }}>
                        <strong style={{ fontSize: "11.5px", color: "#a8d5ff" }}>{fb.authorName}</strong>
                        <small style={{ fontSize: "10px", color: "#7898bd" }}>{new Date(fb.createdAt).toLocaleDateString("vi-VN")}</small>
                      </div>
                      <p style={{ margin: 0, fontSize: "12px", color: "#d2e4f7", lineHeight: 1.5 }}>{fb.content}</p>
                    </div>
                  ))
                ) : (
                  <small style={{ color: "#7898bd", fontStyle: "italic", fontSize: "11px" }}>Chưa có lời nhắn nào. Hãy là người đầu tiên nhắn gửi đến bé thỏ này nhé!</small>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      {showAccess && <AccessModal character={safeChar} onClose={() => setShowAccess(false)} onSuccess={(url) => window.open(url, "_blank", "noopener,noreferrer")} />}
    </div>
  );
}

function AccessModal({ character, onClose, onSuccess }: { character: Character; onClose: () => void; onSuccess: (url: string) => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const verify = trpc.characters.verifyAccess.useMutation();

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    const cleanInput = String(password || "").trim().toLowerCase();
    const cleanTarget = String(character?.password || "").trim().toLowerCase();

    if (cleanTarget) {
      if (cleanInput === cleanTarget) {
        if (character?.externalUrl) onSuccess(character.externalUrl);
        return;
      } else {
        setError("Mật khẩu chưa đúng, thử lại nhé.");
        return;
      }
    }

    if (!character?.passwordProtected) {
      if (character?.externalUrl) onSuccess(character.externalUrl);
      return;
    }

    try {
      const result = await verify.mutateAsync({ id: character.id, password });
      if (result.ok && result.url) {
        onSuccess(result.url);
        return;
      }
    } catch {}

    setError("Mật khẩu chưa đúng, thử lại nhé.");
  };

  return (
    <div className="modal-layer">
      <div className="modal-panel access-modal">
        <button className="icon-button modal-close" onClick={onClose} aria-label="Đóng"><X size={18} /></button>
        <img src={rabbitLogo} alt="" className="gate-rabbit" />
        <h2>{character?.accessTitle || "Mở cánh cửa nhỏ"}</h2>
        <p>{character?.passwordHint || "Nhập mật khẩu được chia sẻ cùng bạn để tiếp tục."}</p>
        <form onSubmit={submit}>
          <input autoFocus type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Mật khẩu" />
          {error && <div className="form-error">{error}</div>}
          <button className="primary-button full-width" type="submit">
            Mở liên kết <ArrowUpRight size={15} />
          </button>
        </form>
      </div>
    </div>
  );
}

function SlotRandomModal({ pool, onSelect, onClose }: { pool: Character[]; onSelect: (c: Character) => void; onClose: () => void }) {
  const safePool = useMemo(() => pool.map(sanitizeCharacter), [pool]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [spinning, setSpinning] = useState(true);
  const winnerIndex = useRef(Math.floor(Math.random() * (safePool.length || 1)));

  useEffect(() => {
    if (!safePool.length) return;
    let speed = 40;
    let count = 0;
    const totalSteps = 26 + Math.floor(Math.random() * 8);

    const runSlot = () => {
      count++;
      setCurrentIndex((prev) => (prev + 1) % safePool.length);
      
      if (count > totalSteps - 10) speed += 40;
      if (count >= totalSteps) {
        setSpinning(false);
        setCurrentIndex(winnerIndex.current);
      } else {
        setTimeout(runSlot, speed);
      }
    };

    const timer = setTimeout(runSlot, speed);
    return () => clearTimeout(timer);
  }, [safePool]);

  const active = safePool[currentIndex] || safePool[0];

  return (
    <div className="modal-layer">
      <div className="modal-panel random-modal" style={{ width: "min(400px, 92vw)", textAlign: "center", padding: "1.8rem 1.4rem" }}>
        <button className="icon-button modal-close" onClick={onClose} aria-label="Đóng"><X size={18} /></button>
        
        <span className="eyebrow" style={{ color: "#a8d5ff", letterSpacing: "0.15em" }}>
          {spinning ? "✦ đang quay slot tìm bạn..." : "✦ một chú thỏ đã được chọn!"}
        </span>

        <div style={{ margin: "1.2rem auto", padding: "1rem", borderRadius: "16px", background: "linear-gradient(180deg, rgba(8, 25, 52, 0.95), rgba(4, 15, 33, 0.95))", border: spinning ? "1.5px solid #a8d5ff" : "1.5px solid #ffd166", boxShadow: spinning ? "0 0 25px rgba(168, 213, 255, 0.3)" : "0 0 35px rgba(255, 209, 102, 0.45)" }}>
          <div style={{ width: "110px", height: "110px", margin: "0 auto 0.8rem", borderRadius: "12px", overflow: "hidden", background: "#0a2851" }}>
            {active?.imageUrl ? (
              <img src={active.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", filter: spinning ? "blur(1px)" : "none" }} />
            ) : (
              <div style={{ display: "grid", placeItems: "center", height: "100%", fontSize: "2rem", color: "#a8d5ff" }}>☾</div>
            )}
          </div>
          <h2 style={{ fontSize: "1.5rem", margin: "0 0 0.3rem", color: "#f1f8ff", fontFamily: '"Playfair Display", serif' }}>
            {active?.name || "Một người bạn"}
          </h2>
          <p style={{ fontSize: "11px", color: "#9db8d4", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {active?.caption || "Một người bạn vừa tìm thấy đường về."}
          </p>
        </div>

        <button className="primary-button" disabled={spinning} onClick={() => active && onSelect(active)} style={{ width: "100%", minHeight: "44px", marginTop: "0.5rem", opacity: spinning ? 0.6 : 1 }}>
          {spinning ? "Đang quay..." : "Xem thông tin chú thỏ"} <ArrowUpRight size={15} />
        </button>
      </div>
    </div>
  );
}

function PublicPage({ 
  characters, 
  onStudio, 
  tracks,
  notifications,
  readNotificationIds,
  onMarkNotificationRead,
  feedbacks,
  onAddFeedback
}: { 
  characters: Character[]; 
  onStudio: () => void; 
  tracks: Track[];
  notifications: NotificationItem[];
  readNotificationIds: string[];
  onMarkNotificationRead: (id: string) => void;
  feedbacks: CharacterFeedback[];
  onAddFeedback: (charId: number, charName: string, author: string, content: string) => void;
}) {
  const [location] = useLocation();
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState<string | null>(null);
  const [tagsExpanded, setTagsExpanded] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  
  const safeCharacters = useMemo(() => characters.map(sanitizeCharacter), [characters]);
  const unreadCount = notifications.filter((item) => item && !readNotificationIds.includes(item.id)).length;
  const latest = useMemo(() => [...safeCharacters].filter((c) => safeIsIn(c, "new")).sort((a, b) => b.id - a.id)[0] || safeCharacters[0], [safeCharacters]);
  const [selected, setSelected] = useState<Character | null>(null);
  const [showSlot, setShowSlot] = useState(false);
  const [favorites, setFavorites] = useState<number[]>(() => JSON.parse(localStorage.getItem("lalapine-favorites") || "[]"));
  const [loves, setLoves] = useState<LoveSpark[]>([]);

  const allTags = useMemo(() => {
    const raw = safeCharacters.flatMap((c) => tagsOf(c)).filter(Boolean);
    return Array.from(new Set(raw)).sort((a, b) => String(a).localeCompare(String(b)));
  }, [safeCharacters]);

  const visible = useMemo(() => safeCharacters.filter((character) => { 
    if (!character) return false;
    const name = String(character.name || "");
    const caption = String(character.caption || "");
    const tags = tagsOf(character).join(" ");
    const haystack = `${name} ${caption} ${tags}`.toLowerCase(); 
    const cleanQuery = String(query || "").toLowerCase().trim();
    return haystack.includes(cleanQuery) && (!tag || tagsOf(character).includes(tag)); 
  }), [safeCharacters, query, tag]);

  const newer = visible.filter((c) => safeIsIn(c, "new"));
  const miracles = visible.filter((c) => safeIsIn(c, "featured")).sort((a, b) => String(a?.name || "").localeCompare(String(b?.name || "")));
  const coming = visible.filter((c) => safeIsIn(c, "coming"));
  const favoriteMutation = trpc.characters.favorite.useMutation();
  
  const toggleFavorite = (character: Character) => { 
    if (!character) return;
    const next = favorites.includes(character.id) ? favorites.filter((id) => id !== character.id) : [...favorites, character.id]; 
    setFavorites(next); 
    localStorage.setItem("lalapine-favorites", JSON.stringify(next)); 
    try {
      favoriteMutation.mutate({ characterId: character.id, visitorId: visitorId() }); 
    } catch {}
  };
  
  useEffect(() => { 
    const onPointerDown = (event: PointerEvent) => { 
      const spark = createLoveSpark(event.clientX, event.clientY); 
      setLoves((current) => [...current.slice(-7), spark]); 
      window.setTimeout(() => setLoves((current) => current.filter((item) => item.id !== spark.id)), 900); 
    }; 
    window.addEventListener("pointerdown", onPointerDown); 
    return () => window.removeEventListener("pointerdown", onPointerDown); 
  }, []);

  return (
    <>
      <div className="archive-shell">
        <SparklesLayer />
        <LoveLayer loveSparks={loves} />
        <Header onStudio={onStudio} onNotifications={() => setShowNotifications(true)} notificationCount={unreadCount} />
        
        <main className="public-content">
          {location !== "/archive" && location !== "/meadow" && (
            <section className="hero-section">
              <div className="hero-copy">
                <span className="eyebrow">thỏ nhỏ đã tìm thấy đường về nhà</span>
                <h1>để hồn ta tìm đến<br /><i>nơi nó thuộc về.</i></h1>
                <div className="hero-meta">
                  <div><strong>{safeCharacters.filter((character) => character && !character.comingSoon).length.toString().padStart(2, "0")}</strong><span>hồ sơ đang mở</span></div>
                  <div><strong>∞</strong><span>giấc mơ</span></div>
                </div>
              </div>
              <div className="hero-art-wrap">
                <div className="hero-art rabbit-hero latest-rabbit" onClick={() => latest && setSelected(latest)}>
                  {latest?.imageUrl ? <img src={latest.imageUrl} alt={latest.name || "Nhân vật mới nhất"} /> : <div className="image-placeholder">☾</div>}
                  <div className="hero-art-label">
                    <span>mới ra gần đây / field 01</span>
                    <strong>{latest?.name || "Một chú thỏ mới"}</strong>
                    <small>{latest?.caption || "Một người bạn vừa tìm thấy đường về."}</small>
                  </div>
                </div>
              </div>
            </section>
          )}

          {location === "/meadow" && (
            <section className="field-header">
              <span className="eyebrow">coming to the field</span>
              <h1>Những chú thỏ<br /><i>đang ủ mầm.</i></h1>
              <p>Một vài cái tên đang ngủ dưới lớp cỏ. Chúng sẽ tỉnh dậy khi đến mùa.</p>
            </section>
          )}

          {location !== "/meadow" && (
            <section className="search-section" id="archive">
              <div className="search-intro">
                <h2>⟡ thỏ nhỏ đang tìm ai?</h2>
              </div>
              <div className="search-tools">
                <label className="search-box">
                  <Search size={17} />
                  <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm theo tên, cảm giác, câu chuyện…" />
                  <span>{visible.length} kết quả</span>
                </label>
                <div className="tag-filter">
                  <div className="tag-filter-heading">
                    <span className="filter-label">tags</span>
                    <button className="tag-toggle" aria-label={tagsExpanded ? "Thu gọn tags" : "Mở rộng tags"} onClick={() => setTagsExpanded(!tagsExpanded)}>
                      {tagsExpanded ? "⌃" : "⌄"}
                    </button>
                  </div>
                  <div className={`tag-scroll ${tagsExpanded ? "expanded" : ""}`}>
                    <button className={!tag ? "active" : ""} onClick={() => setTag(null)}>tất cả</button>
                    {allTags.slice(0, tagsExpanded ? allTags.length : 6).map((item) => (
                      <button className={tag === item ? "active" : ""} onClick={() => setTag(item)} key={item}>{item}</button>
                    ))}
                  </div>
                </div>

                <button className="random-button main-random" onClick={() => setShowSlot(true)}>
                  <span>𐔌՞. .՞𐦯 hôm nay thỏ nhỏ sẽ gặp được ai đây .ᐣ.ᐟ</span>
                  <ArrowUpRight size={16} />
                </button>
              </div>
            </section>
          )}

          {location !== "/meadow" && (
            <section className="archive-section">
              <div className="archive-rule"><div style={{ gridColumn: "1 / -1" }} /></div>
              <div className="section-block" id="new">
                <SectionLabel eyebrow="freshly baked" title="Thỏ Múp Sữa" count={newer.length} />
                <div className="card-grid">
                  {newer.map((character) => (
                    <CharacterCard key={character.id} character={character} onOpen={() => setSelected(character)} favorite={favorites.includes(character.id)} onFavorite={() => toggleFavorite(character)} />
                  ))}
                </div>
              </div>
              <div className="section-block miracle-block" id="featured">
                <SectionLabel eyebrow="alphabetical miracles" title="Thỏ Kỳ Tích" count={miracles.length} />
                <div className="card-grid">
                  {miracles.map((character) => (
                    <CharacterCard key={character.id} character={character} onOpen={() => setSelected(character)} favorite={favorites.includes(character.id)} onFavorite={() => toggleFavorite(character)} />
                  ))}
                </div>
              </div>
            </section>
          )}

          {location === "/meadow" && (
            <section className="archive-section coming-only" id="coming">
              <div className="archive-rule"><div style={{ gridColumn: "1 / -1" }} /></div>
              <div className="section-block">
                <SectionLabel eyebrow="coming soon" title="Thỏ Mặt Trăng" count={coming.length} />
                <div className="coming-field">
                  {coming.map((character) => (
                    <button className="coming-card" key={character.id} onClick={() => setSelected(character)}>
                      <span className="coming-art">{character.imageUrl && <img src={character.imageUrl} alt="" />}</span>
                      <span><strong>{character.name}</strong><small>{character.caption}</small></span>
                      <ArrowUpRight size={16} />
                    </button>
                  ))}
                </div>
              </div>
            </section>
          )}

          {location === "/archive" && (
            <section className="archive-section">
              <div className="archive-rule"><div style={{ gridColumn: "1 / -1" }} /></div>
              <div className="section-block">
                <SectionLabel eyebrow="the complete field" title="Tất cả những chú thỏ" count={visible.length} />
                <div className="card-grid full-field">
                  {visible.map((character) => (
                    <CharacterCard key={character.id} character={character} onOpen={() => setSelected(character)} favorite={favorites.includes(character.id)} onFavorite={() => toggleFavorite(character)} />
                  ))}
                </div>
              </div>
            </section>
          )}

          <footer className="site-footer">
            <div><strong>la Lapine</strong><span>nàng thỏ mộng mơ</span></div>
          </footer>
        </main>

        <MusicPlayer tracks={tracks} />
        
        {selected && (
          <DetailModal 
            character={selected} 
            onClose={() => setSelected(null)} 
            favorite={favorites.includes(selected.id)} 
            onFavorite={() => toggleFavorite(selected)}
            feedbacks={feedbacks}
            onAddFeedback={onAddFeedback}
          />
        )}

        {showSlot && (
          <SlotRandomModal 
            pool={visible.length ? visible : safeCharacters} 
            onSelect={(c) => { 
              setShowSlot(false); 
              setSelected(c); 
            }} 
            onClose={() => setShowSlot(false)} 
          />
        )}
      </div>

      {showNotifications && (
        <NotificationModal notifications={notifications} readIds={readNotificationIds} onRead={onMarkNotificationRead} onClose={() => setShowNotifications(false)} />
      )}
    </>
  );
}

function NotificationModal({ notifications, readIds, onRead, onClose }: { notifications: NotificationItem[]; readIds: string[]; onRead: (id: string) => void; onClose: () => void }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = notifications.find((item) => item && item.id === selectedId);

  return (
    <div className="modal-layer" onClick={onClose}>
      <div className="modal-panel notification-modal notification-inbox" onClick={(event) => event.stopPropagation()} style={{ width: "min(520px, 100%)" }}>
        <button className="icon-button modal-close" onClick={onClose} aria-label="Đóng"><X size={18} /></button>
        
        {selected ? (
          <div>
            <button className="notification-back" onClick={() => setSelectedId(null)} style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "4px 8px", background: "rgba(173,214,255,0.1)", borderRadius: "4px", border: 0, color: "#9dd5ff", cursor: "pointer", fontSize: "12px", marginBottom: "1rem" }}>
              ← Quay lại danh sách thông báo
            </button>
            <span className="eyebrow">la Lapine / thư từ đồng cỏ</span>
            <h2 style={{ fontSize: "1.8rem", margin: "0.6rem 0 1rem", color: "#ebf5ff" }}>{selected.title}</h2>
            <div className="notification-detail-body" style={{ whiteSpace: "pre-wrap", lineHeight: 1.8, fontSize: "14px", color: "#cde4ff", background: "rgba(6,23,49,0.4)", padding: "1rem", borderRadius: "8px", border: "1px solid rgba(173,214,255,0.12)" }}>
              {selected.body}
            </div>
            <span className="notification-date" style={{ marginTop: "1rem", display: "block", color: "#7898bd", fontSize: "11px" }}>
              {new Date(selected.publishedAt).toLocaleString("vi-VN")}{selected.pinned ? " · ★ Đã ghim" : ""}
            </span>
          </div>
        ) : (
          <div>
            <span className="eyebrow">la Lapine / hộp thư</span>
            <h2 style={{ margin: "0.5rem 0 1rem" }}>Thông báo đồng cỏ</h2>
            
            {notifications.length ? (
              <div className="notification-list" style={{ display: "flex", flexDirection: "column", gap: "0.55rem", maxHeight: "60vh", overflowY: "auto", paddingRight: "4px" }}>
                {notifications.map((item) => {
                  if (!item) return null;
                  const isRead = readIds.includes(item.id);
                  return (
                    <button 
                      type="button" 
                      key={item.id} 
                      onClick={() => { onRead(item.id); setSelectedId(item.id); }}
                      style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.85rem 1rem", borderRadius: "8px", border: "1px solid",
                        borderColor: isRead ? "rgba(173,214,255,0.12)" : "rgba(173,214,255,0.35)", background: isRead ? "rgba(173,214,255,0.03)" : "rgba(173,214,255,0.08)",
                        textAlign: "left", cursor: "pointer", transition: "all 0.2s"
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                        <span style={{ width: "7px", height: "7px", borderRadius: "50%", backgroundColor: isRead ? "transparent" : "#86cfff", border: isRead ? "1px solid #5a7d9f" : "none", flexShrink: 0 }} />
                        <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          <strong style={{ display: "block", color: isRead ? "#a5beda" : "#f1f7ff", fontSize: "14px", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {item.title}
                          </strong>
                          <small style={{ color: "#7898bd", fontSize: "11px" }}>
                            {new Date(item.publishedAt).toLocaleDateString("vi-VN")} {item.pinned ? "· ★ Ghim" : ""}
                          </small>
                        </div>
                      </div>
                      <ChevronRight size={16} style={{ opacity: 0.6, flexShrink: 0, marginLeft: "8px" }} />
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="notification-empty">Chưa có thông báo mới nào từ đồng cỏ.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function RichTextField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const editor = useRef<HTMLDivElement>(null);
  useEffect(() => { 
    if (editor.current && document.activeElement !== editor.current) {
      editor.current.innerHTML = renderRichText(value); 
    }
  }, [value]);

  const command = (name: string, commandValue?: string) => { 
    editor.current?.focus(); 
    document.execCommand(name, false, commandValue); 
    if (editor.current) onChange(editor.current.innerHTML); 
  };

  return (
    <div className="rich-text-field">
      <span className="rich-text-label">{label}</span>
      <div className="rich-text-toolbar" role="toolbar" aria-label={`Định dạng ${label}`}>
        <button type="button" aria-label="In đậm" onMouseDown={(event) => event.preventDefault()} onClick={() => command("bold")}><b>B</b></button>
        <button type="button" aria-label="In nghiêng" onMouseDown={(event) => event.preventDefault()} onClick={() => command("italic")}><i>I</i></button>
        <button type="button" aria-label="Gạch chân" onMouseDown={(event) => event.preventDefault()} onClick={() => command("underline")}><u>U</u></button>
        <span className="rich-text-divider" />
        <button type="button" aria-label="Căn trái" onMouseDown={(event) => event.preventDefault()} onClick={() => command("justifyLeft")}>≡</button>
        <button type="button" aria-label="Căn giữa" onMouseDown={(event) => event.preventDefault()} onClick={() => command("justifyCenter")}>≡</button>
        <button type="button" aria-label="Căn phải" onMouseDown={(event) => event.preventDefault()} onClick={() => command("justifyRight")}>≡</button>
        <span className="rich-text-divider" />
        <button type="button" aria-label="Danh sách" onMouseDown={(event) => event.preventDefault()} onClick={() => command("insertUnorderedList")}>• list</button>
        <button type="button" aria-label="Xóa định dạng" onMouseDown={(event) => event.preventDefault()} onClick={() => command("removeFormat")}>Aa</button>
      </div>
      <div ref={editor} className="rich-text-editor" contentEditable suppressContentEditableWarning onInput={(event) => onChange(event.currentTarget.innerHTML)} role="textbox" aria-multiline="true" style={{ whiteSpace: "pre-wrap", lineHeight: 1.8 }} />
    </div>
  );
}

function SectionLabel({ eyebrow, title, count }: { eyebrow: string; title: string; count: number }) { return <div className="section-heading"><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2></div><span className="section-count">{String(count).padStart(2, "0")}</span></div>; }

function AdminGate({ onUnlock, onClose }: { onUnlock: () => void; onClose: () => void }) {
  const [pass, setPass] = useState(""); 
  const [error, setError] = useState(""); 

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const clean = String(pass || "").trim();
    if (clean === MASTER_PASSWORD) { 
      onUnlock(); 
      return; 
    }
    setError("Mật khẩu không chính xác.");
  };

  return (
    <div className="modal-layer">
      <div className="modal-panel admin-gate">
        <button className="icon-button modal-close" onClick={onClose}><X size={18} /></button>
        <img src={rabbitLogo} alt="" className="gate-rabbit" />
        <span className="eyebrow">private studio / owner only</span>
        <h2>Vào phòng cỏ riêng</h2>
        <form onSubmit={submit}>
          <input autoFocus type="password" value={pass} onChange={(event) => setPass(event.target.value)} placeholder="Nhập mật khẩu" />
          {error && <div className="form-error">{error}</div>}
          <button className="primary-button full-width" type="submit">
            Mở studio <ArrowUpRight size={15} />
          </button>
        </form>
      </div>
    </div>
  );
}

function OwnerWorkspace({ 
  characters, 
  onClose, 
  onSaveCharacters,
  tracks,
  onSaveTracks,
  notifications,
  onSaveNotifications,
  feedbacks,
  onCommitToGitHub
}: { 
  characters: Character[]; 
  onClose: () => void; 
  onSaveCharacters: (newChars: Character[]) => void;
  tracks: Track[];
  onSaveTracks: (newTracks: Track[]) => void;
  notifications: NotificationItem[];
  onSaveNotifications: (newNotifs: NotificationItem[]) => void;
  feedbacks: CharacterFeedback[];
  onCommitToGitHub: () => Promise<void>;
}) {
  const [isDark, setIsDark] = useState<boolean>(() => localStorage.getItem("lalapine-studio-theme") !== "light");
  const toggleTheme = () => { const next = !isDark; setIsDark(next); localStorage.setItem("lalapine-studio-theme", next ? "dark" : "light"); };
  const theme = {
    bg: isDark ? "#061329" : "#f4f8fc", sidebarBg: isDark ? "#081b38" : "#e8f2fa", cardBg: isDark ? "rgba(11, 31, 61, 0.85)" : "#ffffff",
    cardBorder: isDark ? "rgba(173, 214, 255, 0.16)" : "#d6e4f0", textMain: isDark ? "#edf5ff" : "#1c2e44", textMuted: isDark ? "#8ea8c7" : "#617996",
    inputBg: isDark ? "rgba(5, 18, 41, 0.6)" : "#f8fbfe", inputBorder: isDark ? "rgba(173, 214, 255, 0.2)" : "#d2e0ed",
  };

  const blank = { 
    name: "", slug: "", caption: "", imageUrl: "", titleColor: "#eff8ff", bodyColor: "#9db8d4", colorSync: 1, 
    tags: "", section: "new", sections: ["new"], accessTitle: "", description: "", backstory: "", 
    firstMessage: "", externalUrl: "", password: "", passwordHint: "", clearPassword: false, hasPassword: false
  };

  const [editing, setEditing] = useState<Character | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [form, setForm] = useState(blank);
  const [confirmDelete, setConfirmDelete] = useState<Character | null>(null);
  const [studioTab, setStudioTab] = useState("characters");
  const [isPushing, setIsPushing] = useState(false);
  const uploadAsset = trpc.owner.uploadAsset.useMutation();

  const safeChars = useMemo(() => characters.map(sanitizeCharacter), [characters]);
  const systemAvailableTags = useMemo(() => {
    const all = safeChars.flatMap((c) => tagsOf(c)).filter(Boolean);
    return Array.from(new Set(all)).sort((a, b) => String(a).localeCompare(String(b)));
  }, [safeChars]);

  const toggleTagSelection = (selectedTag: string) => {
    const currentTags = (form.tags || "").split(",").map((t) => t.trim()).filter(Boolean);
    const target = String(selectedTag || "").toLowerCase();
    let updatedTags: string[];
    if (currentTags.map((t) => String(t || "").toLowerCase()).includes(target)) {
      updatedTags = currentTags.filter((t) => String(t || "").toLowerCase() !== target);
    } else {
      updatedTags = [...currentTags, selectedTag];
    }
    setForm({ ...form, tags: updatedTags.join(", ") });
  };

  const [noticeTitle, setNoticeTitle] = useState("Một lời nhắn từ đồng cỏ");
  const [noticeBody, setNoticeBody] = useState("");
  const [noticePublishedAt, setNoticePublishedAt] = useState("");
  const [noticePinned, setNoticePinned] = useState(false);
  const [editingNotifId, setEditingNotifId] = useState<string | null>(null);

  const handleSendNotification = () => {
    if (!noticeBody.trim()) { toast.error("Vui lòng nhập nội dung thông báo."); return; }
    let nextList: NotificationItem[];
    if (editingNotifId) {
      nextList = notifications.map((n) => n && n.id === editingNotifId ? { ...n, title: noticeTitle.trim() || "Một lời nhắn từ đồng cỏ", body: noticeBody.trim(), publishedAt: noticePublishedAt ? new Date(noticePublishedAt).toISOString() : new Date().toISOString(), pinned: noticePinned } : n);
      toast.success("Cập nhật thông báo thành công!");
    } else {
      const newNotif: NotificationItem = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, title: noticeTitle.trim() || "Một lời nhắn từ đồng cỏ", body: noticeBody.trim(), publishedAt: noticePublishedAt ? new Date(noticePublishedAt).toISOString() : new Date().toISOString(), pinned: noticePinned };
      nextList = [newNotif, ...notifications];
      toast.success("Gửi thông báo thành công!");
    }
    onSaveNotifications(nextList);
    setNoticeTitle("Một lời nhắn từ đồng cỏ"); setNoticeBody(""); setNoticePublishedAt(""); setNoticePinned(false); setEditingNotifId(null);
  };

  const handleEditNotif = (notif: NotificationItem) => {
    if (!notif) return;
    setEditingNotifId(notif.id); setNoticeTitle(notif.title); setNoticeBody(notif.body); setNoticePinned(notif.pinned);
    setNoticePublishedAt(notif.publishedAt ? new Date(notif.publishedAt).toISOString().slice(0, 16) : "");
  };

  const handleDeleteNotif = (id: string) => {
    if (window.confirm("Bạn có chắc chắn muốn xóa thông báo này?")) {
      const nextList = notifications.filter((n) => n && n.id !== id);
      onSaveNotifications(nextList);
      toast.success("Đã xóa thông báo.");
      if (editingNotifId === id) { setNoticeTitle("Một lời nhắn từ đồng cỏ"); setNoticeBody(""); setNoticePublishedAt(""); setNoticePinned(false); setEditingNotifId(null); }
    }
  };

  const [editingTrack, setEditingTrack] = useState<Track | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editArtist, setEditArtist] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newArtist, setNewArtist] = useState("");
  const [newUrl, setNewUrl] = useState("");

  const handleUpdateTrack = (e: FormEvent) => {
    e.preventDefault();
    if (!editingTrack || !editTitle.trim() || !editUrl.trim()) return;
    const nextTracks = tracks.map((t) => t.id === editingTrack.id ? { ...t, title: editTitle.trim(), artist: editArtist.trim() || "la Lapine", audioUrl: editUrl.trim() } : t);
    onSaveTracks(nextTracks);
    toast.success(`Đã cập nhật bài "${editTitle.trim()}"!`);
    setEditingTrack(null);
  };

  const handleAddNewTrack = (e: FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newUrl.trim()) { toast.error("Vui lòng nhập tên bài hát và đường dẫn âm thanh."); return; }
    const newTrackItem: Track = { id: Date.now(), title: newTitle.trim(), artist: newArtist.trim() || "la Lapine", audioUrl: newUrl.trim() };
    const nextTracks = [...tracks, newTrackItem];
    onSaveTracks(nextTracks);
    toast.success(`Đã thêm bài "${newTitle.trim()}" vào playlist!`);
    setNewTitle(""); setNewArtist(""); setNewUrl("");
  };

  const handleDeleteTrack = (trackToDelete: Track) => {
    if (window.confirm(`Xóa bài "${trackToDelete.title}" khỏi danh sách phát?`)) {
      const nextTracks = tracks.filter((t) => t.id !== trackToDelete.id);
      onSaveTracks(nextTracks);
      toast.success(`Đã xóa bài "${trackToDelete.title}".`);
      if (editingTrack?.id === trackToDelete.id) setEditingTrack(null);
    }
  };

  const handleResetDefaultTracks = () => {
    if (window.confirm("Khôi phục danh sách về 30 bài hát gốc mặc định?")) {
      onSaveTracks(defaultTracks);
      toast.success("Đã khôi phục 30 bài hát mặc định!");
      setEditingTrack(null);
    }
  };

  const reset = () => { setEditing(null); setForm(blank); };

  const startEdit = (character: Character) => { 
    const c = sanitizeCharacter(character);
    setEditing(c); 
    setForm({ 
      name: c.name, slug: c.slug, caption: c.caption || "", imageUrl: c.imageUrl || "", titleColor: c.titleColor || "#eff8ff", bodyColor: c.bodyColor || "#9db8d4", colorSync: c.colorSync ?? 1, 
      tags: tagsOf(c).join(", "), section: c.section || "new", sections: safeSectionsOf(c), description: c.description || "", backstory: c.backstory || "", 
      firstMessage: c.firstMessage || "", externalUrl: c.externalUrl || "", accessTitle: c.accessTitle || "", password: c.password || "", passwordHint: c.passwordHint || "", clearPassword: false,
      hasPassword: Boolean(c.passwordProtected || c.password)
    }); 
  };
  
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const hasPass = Boolean(form.hasPassword && form.password.trim());
    const cleanTags = Array.from(new Set((form.tags || "").split(",").map((t) => t.trim()).filter(Boolean)));

    const characterData: Character = {
      id: editing ? editing.id : Date.now(),
      slug: form.slug || (form.name || "").toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      name: form.name,
      caption: form.caption,
      imageUrl: form.imageUrl || null,
      tagsJson: JSON.stringify(cleanTags),
      section: form.sections[0] || form.section,
      sectionsJson: JSON.stringify(form.sections),
      description: form.description,
      backstory: form.backstory,
      firstMessage: form.firstMessage,
      externalUrl: form.externalUrl || null,
      accessTitle: form.accessTitle || null,
      passwordProtected: hasPass ? 1 : 0,
      password: hasPass ? form.password.trim() : null,
      passwordHint: hasPass ? form.passwordHint.trim() : null,
      titleColor: form.titleColor || "#eff8ff",
      bodyColor: form.bodyColor || "#9db8d4",
      colorSync: form.colorSync ?? 1,
      featured: form.section === "featured" ? 1 : 0,
      comingSoon: form.section === "coming" ? 1 : 0,
      favoriteCount: editing ? (editing.favoriteCount || 0) : 0
    };

    let nextChars: Character[];
    if (editing) {
      nextChars = characters.map((c) => (c.id === editing.id ? characterData : c));
      toast.success(`Đã cập nhật hồ sơ ${characterData.name}!`);
    } else {
      nextChars = [characterData, ...characters];
      toast.success(`Đã thêm chú thỏ ${characterData.name}!`);
    }

    onSaveCharacters(nextChars);
    reset();
  };

  const handleDeleteCharacter = (character: Character) => {
    const nextChars = characters.filter((c) => c.id !== character.id);
    onSaveCharacters(nextChars);
    toast.success(`Đã xóa ${character.name}.`);
    setConfirmDelete(null);
  };

  const handlePushToGitHub = async () => {
    setIsPushing(true);
    await onCommitToGitHub();
    setIsPushing(false);
  };
  
  return (
    <div className="workspace-layer" style={{ background: theme.bg, color: theme.textMain, transition: "background 0.3s ease" }}>
      <aside className="workspace-sidebar" style={{ background: theme.sidebarBg, borderRight: `1px solid ${theme.cardBorder}` }}>
        <div className="workspace-brand">
          <img src={rabbitLogo} alt="" />
          <div>
            <strong style={{ color: theme.textMain }}>la Lapine</strong>
            <span style={{ color: theme.textMuted }}>private studio</span>
          </div>
        </div>

        <nav>
          <button className={studioTab === "characters" ? "active" : ""} onClick={() => setStudioTab("characters")}>Hồ sơ thỏ</button>
          <button className={studioTab === "feedbacks" ? "active" : ""} onClick={() => setStudioTab("feedbacks")}>Lời nhắn ({feedbacks.length})</button>
          <button className={studioTab === "tags" ? "active" : ""} onClick={() => setStudioTab("tags")}>Tags đồng cỏ</button>
          <button className={studioTab === "playlist" ? "active" : ""} onClick={() => setStudioTab("playlist")}>Playlist</button>
          <button className={studioTab === "settings" ? "active" : ""} onClick={() => setStudioTab("settings")}>Thông báo</button>
        </nav>

        <div style={{ marginTop: "auto", padding: "1rem 0.4rem", display: "flex", flexDirection: "column", gap: "8px" }}>
          <button 
            type="button" 
            onClick={handlePushToGitHub}
            disabled={isPushing}
            style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", padding: "0.65rem 0.8rem", borderRadius: "8px", border: "1px solid #3a86ff", background: "#3a86ff", color: "#ffffff", fontSize: "12px", fontWeight: 600, cursor: isPushing ? "not-allowed" : "pointer" }}
          >
            <GitCommit size={15} />
            <span>{isPushing ? "Đang đẩy lên GitHub..." : "Lưu vĩnh viễn lên GitHub"}</span>
          </button>

          <button 
            type="button" 
            onClick={toggleTheme}
            style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", padding: "0.55rem 0.8rem", borderRadius: "8px", border: `1px solid ${theme.cardBorder}`, background: isDark ? "rgba(255,255,255,0.06)" : "#ffffff", color: theme.textMain, fontSize: "11.5px", cursor: "pointer" }}
          >
            {isDark ? <Sun size={14} style={{ color: "#ffd166" }} /> : <Moon size={14} style={{ color: "#3a86ff" }} />}
            <span>{isDark ? "Giao diện Sáng" : "Giao diện Tối"}</span>
          </button>
        </div>
      </aside>

      <main className="workspace-main">
        <header className="workspace-top">
          <div>
            <span className="eyebrow" style={{ color: theme.textMuted }}>rabbit field management</span>
            <h1 style={{ color: theme.textMain }}>Studio của nàng thỏ</h1>
          </div>
          <button className="secondary-button" onClick={onClose} style={{ borderColor: theme.cardBorder, color: theme.textMain }}>
            Rời studio
          </button>
        </header>

        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.35fr) minmax(320px, 0.9fr)", gap: "1.4rem" }}>
          <section className={`editor-card studio-pane ${studioTab === "characters" ? "is-active" : "is-hidden"}`} style={{ background: theme.cardBg, borderColor: theme.cardBorder }}>
            <span className="eyebrow" style={{ color: theme.textMuted }}>{editing ? "edit rabbit / đang chỉnh sửa" : "new rabbit"}</span>
            <h2 style={{ color: theme.textMain }}>{editing ? `Chỉnh sửa ${editing.name}` : "Gieo một hồ sơ mới"}</h2>
            
            <form className="admin-form" onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div>
                <label style={{ color: theme.textMuted, display: "block", marginBottom: "0.3rem" }}>Tên thỏ</label>
                <input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Thỏ Mặt Trăng" style={{ width: "100%", height: "42px", padding: "0 12px", borderRadius: "8px", background: theme.inputBg, border: `1px solid ${theme.inputBorder}`, color: theme.textMain }} />
              </div>
              
              <div>
                <label style={{ color: theme.textMuted, display: "block", marginBottom: "0.3rem" }}>Ảnh đại diện</label>
                <input value={form.imageUrl} onChange={(event) => setForm({ ...form, imageUrl: event.target.value })} placeholder="Dán link ảnh hoặc chọn file từ máy..." style={{ width: "100%", height: "42px", padding: "0 12px", borderRadius: "8px", background: theme.inputBg, border: `1px solid ${theme.inputBorder}`, color: theme.textMain }} />
                <input type="file" accept="image/*" style={{ marginTop: "6px" }} onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  try {
                    const dataUrl = await fileToDataUrl(file);
                    setForm({ ...form, imageUrl: dataUrl });
                    toast.success("Đã tải ảnh lên thành công!");
                  } catch {
                    toast.error("Không nạp được ảnh từ máy tính.");
                  }
                }} />
              </div>

              <div>
                <label style={{ color: theme.textMuted, display: "block", marginBottom: "0.3rem" }}>Caption ngắn</label>
                <input value={form.caption} onChange={(event) => setForm({ ...form, caption: event.target.value })} placeholder="Một câu để nhớ" style={{ width: "100%", height: "42px", padding: "0 12px", borderRadius: "8px", background: theme.inputBg, border: `1px solid ${theme.inputBorder}`, color: theme.textMain }} />
              </div>
              
              <div style={{ padding: "0.85rem 1rem", background: theme.inputBg, border: `1px solid ${theme.inputBorder}`, borderRadius: "10px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", alignItems: "center" }}>
                  <div>
                    <label style={{ color: theme.textMuted, fontSize: "11px", display: "block", marginBottom: "4px" }}>Màu tiêu đề</label>
                    <input type="color" value={form.titleColor} onChange={(event) => setForm({ ...form, titleColor: event.target.value })} style={{ width: "100%", height: "36px", border: "0", background: "none", cursor: "pointer" }} />
                  </div>
                  <div>
                    <label style={{ color: theme.textMuted, fontSize: "11px", display: "block", marginBottom: "4px" }}>Màu nội dung</label>
                    <input type="color" value={form.bodyColor} disabled={Boolean(form.colorSync)} onChange={(event) => setForm({ ...form, bodyColor: event.target.value })} style={{ width: "100%", height: "36px", border: "0", background: "none", cursor: "pointer", opacity: form.colorSync ? 0.4 : 1 }} />
                  </div>
                </div>

                <label style={{ display: "inline-flex", alignItems: "center", gap: "8px", marginTop: "10px", cursor: "pointer", fontSize: "12px", color: theme.textMain }}>
                  <input type="checkbox" checked={Boolean(form.colorSync)} onChange={(event) => setForm({ ...form, colorSync: event.target.checked ? 1 : 0, bodyColor: event.target.checked ? form.titleColor : form.bodyColor })} style={{ width: "17px", height: "17px", accentColor: "#3a86ff", cursor: "pointer" }} /> 
                  <span>Đồng bộ một màu cho cả tiêu đề và nội dung</span>
                </label>
              </div>

              <div>
                <label style={{ color: theme.textMuted, display: "block", marginBottom: "0.3rem" }}>URL nhân vật</label>
                <input type="url" value={form.externalUrl} onChange={(event) => setForm({ ...form, externalUrl: event.target.value })} placeholder="https://character.ai/…" style={{ width: "100%", height: "42px", padding: "0 12px", borderRadius: "8px", background: theme.inputBg, border: `1px solid ${theme.inputBorder}`, color: theme.textMain }} />
              </div>
              
              <div>
                <label style={{ color: theme.textMuted, display: "block", marginBottom: "0.3rem" }}>Tiêu đề khi mở liên kết</label>
                <input value={form.accessTitle} onChange={(event) => setForm({ ...form, accessTitle: event.target.value })} placeholder="Mở cánh cửa nhỏ" style={{ width: "100%", height: "42px", padding: "0 12px", borderRadius: "8px", background: theme.inputBg, border: `1px solid ${theme.inputBorder}`, color: theme.textMain }} />
              </div>
              
              <div style={{ padding: "0.9rem 1rem", background: theme.inputBg, borderRadius: "10px", border: `1px solid ${theme.inputBorder}` }}>
                <label style={{ display: "inline-flex", alignItems: "center", gap: "10px", cursor: "pointer", fontWeight: 600, color: theme.textMain, fontSize: "13px" }}>
                  <input type="checkbox" checked={form.hasPassword} onChange={(e) => setForm({ ...form, hasPassword: e.target.checked, password: e.target.checked ? (form.password || "") : "" })} style={{ width: "17px", height: "17px", accentColor: "#3a86ff", cursor: "pointer" }} /> 
                  <Lock size={15} style={{ color: "#9ecaff" }} /> Đặt mật khẩu bảo vệ khi mở liên kết
                </label>

                {form.hasPassword && (
                  <div style={{ marginTop: "0.8rem", display: "grid", gap: "0.8rem", borderTop: `1px dashed ${theme.inputBorder}`, paddingTop: "0.8rem" }}>
                    <input type="text" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder="Nhập mật khẩu" style={{ width: "100%", height: "38px", padding: "0 10px", borderRadius: "6px", background: theme.cardBg, border: `1px solid ${theme.inputBorder}`, color: theme.textMain }} />
                    <input value={form.passwordHint} onChange={(event) => setForm({ ...form, passwordHint: event.target.value })} placeholder="Gợi ý mật khẩu" style={{ width: "100%", height: "38px", padding: "0 10px", borderRadius: "6px", background: theme.cardBg, border: `1px solid ${theme.inputBorder}`, color: theme.textMain }} />
                  </div>
                )}
              </div>

              <div style={{ padding: "0.9rem 1rem", background: theme.inputBg, borderRadius: "10px", border: `1px solid ${theme.inputBorder}` }}>
                <label style={{ display: "block", marginBottom: "0.4rem", color: theme.textMuted, fontSize: "12px" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}><Tag size={14} /> Tags hồ sơ</span>
                  <input value={form.tags} onChange={(event) => setForm({ ...form, tags: event.target.value })} placeholder="ví dụ: mới ra lò, mềm, ấm áp" style={{ width: "100%", height: "40px", padding: "0 12px", borderRadius: "8px", marginTop: "6px", background: theme.cardBg, border: `1px solid ${theme.inputBorder}`, color: theme.textMain }} />
                </label>
              </div>

              <div style={{ padding: "0.9rem 1rem", background: theme.inputBg, borderRadius: "10px", border: `1px solid ${theme.inputBorder}` }}>
                <span style={{ color: theme.textMuted, fontSize: "12px", display: "block", marginBottom: "8px", fontWeight: 600 }}>Khu vực hiển thị</span>
                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                  {[["new", "Thỏ Múp Sữa"], ["featured", "Thỏ Kỳ Tích"], ["coming", "Thỏ Mặt Trăng"]].map(([value, label]) => {
                    const isChecked = form.sections.includes(value);
                    return (
                      <label key={value} style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "8px 14px", borderRadius: "8px", border: `1px solid ${isChecked ? "#9ecaff" : theme.inputBorder}`, background: isChecked ? (isDark ? "rgba(158,202,255,0.18)" : "rgba(158,202,255,0.25)") : theme.cardBg, color: isChecked ? (isDark ? "#ffffff" : "#082142") : theme.textMuted, cursor: "pointer", fontSize: "12.5px" }}>
                        <input type="checkbox" checked={isChecked} onChange={(event) => {
                          const next = event.target.checked ? Array.from(new Set([...form.sections, value])) : form.sections.filter((item) => item !== value);
                          setForm({ ...form, sections: next.length ? next : [value], section: next[0] || value });
                        }} style={{ width: "16px", height: "16px", accentColor: "#3a86ff" }} /> 
                        {label}
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="admin-two-col">
                <RichTextField label="Mô tả" value={form.description} onChange={(value) => setForm({ ...form, description: value })} />
                <RichTextField label="Backstory" value={form.backstory} onChange={(value) => setForm({ ...form, backstory: value })} />
              </div>
              <RichTextField label="Tin nhắn đầu tiên" value={form.firstMessage} onChange={(value) => setForm({ ...form, firstMessage: value })} />
              
              <div className="editor-actions" style={{ marginTop: "1.2rem", display: "flex", gap: "0.8rem" }}>
                <button type="button" className="secondary-button" onClick={() => setPreviewing(true)} style={{ borderColor: theme.cardBorder, color: theme.textMain, minHeight: "42px" }}>Xem trước</button>
                <button className="primary-button" type="submit" style={{ minHeight: "42px" }}>
                  {editing ? "Lưu thay đổi" : "Lưu vào đồng cỏ"} <ArrowUpRight size={15} />
                </button>
                {editing && <button type="button" className="secondary-button" onClick={reset} style={{ borderColor: theme.cardBorder, color: theme.textMain, minHeight: "42px" }}>Huỷ sửa</button>}
              </div>
            </form>
          </section>

          <div>
            {/* TAB FEEDBACKS */}
            {studioTab === "feedbacks" && (
              <section className="editor-card" style={{ background: theme.cardBg, borderColor: theme.cardBorder, borderRadius: "12px", padding: "1.4rem" }}>
                <span className="eyebrow" style={{ color: theme.textMuted }}>guestbook / public feedback</span>
                <h2 style={{ color: theme.textMain, margin: "0.2rem 0 1rem" }}>Hòm thư gửi thỏ ({feedbacks.length})</h2>
                <div style={{ display: "grid", gap: "0.6rem", maxHeight: "550px", overflowY: "auto" }}>
                  {feedbacks.length > 0 ? (
                    feedbacks.map((fb) => (
                      <div key={fb.id} style={{ padding: "10px 12px", borderRadius: "8px", background: theme.inputBg, border: `1px solid ${theme.inputBorder}` }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                          <strong style={{ fontSize: "13px", color: theme.textMain }}>{fb.authorName}</strong>
                          <small style={{ color: theme.textMuted, fontSize: "10.5px" }}>{new Date(fb.createdAt).toLocaleString("vi-VN")}</small>
                        </div>
                        <p style={{ margin: "4px 0 0", fontSize: "12px", color: theme.textMuted, lineHeight: 1.6 }}>{fb.content}</p>
                      </div>
                    ))
                  ) : (
                    <p style={{ color: theme.textMuted, fontSize: "12px", textAlign: "center", padding: "2rem 0" }}>Chưa có lời nhắn nào.</p>
                  )}
                </div>
              </section>
            )}

            {/* TAB THÔNG BÁO */}
            {studioTab === "settings" && (
              <section className="notification-card" style={{ background: theme.cardBg, borderColor: theme.cardBorder, borderRadius: "12px", padding: "1.4rem" }}>
                <span className="eyebrow" style={{ color: theme.textMuted }}>broadcast / all visitors</span>
                <h3 style={{ color: theme.textMain, margin: "0.3rem 0 1rem" }}>{editingNotifId ? "Sửa thông báo" : "Gửi thông báo mới"}</h3>
                
                <input value={noticeTitle} onChange={(event) => setNoticeTitle(event.target.value)} placeholder="Tiêu đề" style={{ width: "100%", height: "42px", padding: "0 12px", borderRadius: "8px", marginBottom: "10px", background: theme.inputBg, border: `1px solid ${theme.inputBorder}`, color: theme.textMain }} />
                <textarea rows={4} value={noticeBody} onChange={(event) => setNoticeBody(event.target.value)} placeholder="Nội dung thông báo…" style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", marginBottom: "10px", background: theme.inputBg, border: `1px solid ${theme.inputBorder}`, color: theme.textMain }} />
                
                <div style={{ display: "flex", gap: "10px" }}>
                  <button className="primary-button" style={{ flex: 1, minHeight: "42px" }} disabled={!noticeBody.trim()} onClick={handleSendNotification}>
                    {editingNotifId ? "Cập nhật" : "Gửi thông báo"} <Bell size={15} />
                  </button>
                  {editingNotifId && (
                    <button className="secondary-button" onClick={() => { setEditingNotifId(null); setNoticeTitle("Một lời nhắn từ đồng cỏ"); setNoticeBody(""); }} style={{ borderColor: theme.cardBorder, color: theme.textMain, minHeight: "42px" }}>Hủy</button>
                  )}
                </div>

                <div style={{ marginTop: "1.8rem", borderTop: `1px solid ${theme.cardBorder}`, paddingTop: "1rem" }}>
                  <span className="eyebrow" style={{ color: theme.textMuted }}>Lịch sử ({pastNotifications.length})</span>
                  <div style={{ display: "grid", gap: ".5rem", marginTop: ".6rem", maxHeight: "280px", overflowY: "auto" }}>
                    {pastNotifications.map((item) => (
                      <div key={item.id} style={{ padding: ".6rem .8rem", border: `1px solid ${editingNotifId === item.id ? '#9ecaff' : theme.cardBorder}`, borderRadius: "8px", background: editingNotifId === item.id ? "rgba(173,214,255,0.15)" : theme.inputBg }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                          <strong style={{ color: theme.textMain, fontSize: ".85rem" }}>{item.title}</strong>
                          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                            <button onClick={() => handleEditNotif(item)} style={{ background: "none", border: 0, color: theme.textMuted, cursor: "pointer", padding: "2px" }} title="Sửa"><Edit2 size={13} /></button>
                            <button onClick={() => handleDeleteNotif(item.id)} style={{ background: "none", border: 0, color: "#e29aab", cursor: "pointer", padding: "2px" }} title="Xóa"><Trash2 size={13} /></button>
                          </div>
                        </div>
                        <p style={{ margin: ".25rem 0", color: theme.textMuted, fontSize: ".75rem", lineHeight: 1.6 }}>{item.body}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            )}

            {/* TAB PLAYLIST */}
            {studioTab === "playlist" && (
              <section className="editor-card" style={{ background: theme.cardBg, borderColor: theme.cardBorder, borderRadius: "12px", padding: "1.4rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                  <h2 style={{ color: theme.textMain, margin: 0 }}>Playlist ({tracks.length})</h2>
                  <button type="button" onClick={handleResetDefaultTracks} className="secondary-button" style={{ fontSize: "11px", borderColor: theme.cardBorder, color: theme.textMuted }}>Khôi phục gốc</button>
                </div>
                
                {editingTrack ? (
                  <form onSubmit={handleUpdateTrack} style={{ padding: "1rem", background: theme.inputBg, borderRadius: "10px", border: `1px solid #9ecaff`, marginBottom: "1.4rem" }}>
                    <input required value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="Tên bài hát..." style={{ width: "100%", height: "38px", padding: "0 10px", borderRadius: "6px", background: theme.cardBg, border: `1px solid ${theme.inputBorder}`, color: theme.textMain, marginBottom: "8px" }} />
                    <input value={editArtist} onChange={(e) => setEditArtist(e.target.value)} placeholder="Nghệ sĩ..." style={{ width: "100%", height: "38px", padding: "0 10px", borderRadius: "6px", background: theme.cardBg, border: `1px solid ${theme.inputBorder}`, color: theme.textMain, marginBottom: "8px" }} />
                    <input required value={editUrl} onChange={(e) => setEditUrl(e.target.value)} placeholder="Đường dẫn file (/audio/...)" style={{ width: "100%", height: "38px", padding: "0 10px", borderRadius: "6px", background: theme.cardBg, border: `1px solid ${theme.inputBorder}`, color: theme.textMain, marginBottom: "8px" }} />
                    <button type="submit" className="primary-button" style={{ minHeight: "36px", padding: "0 1rem" }}>Lưu</button>
                    <button type="button" className="secondary-button" onClick={() => setEditingTrack(null)} style={{ minHeight: "36px", borderColor: theme.cardBorder, color: theme.textMain, marginLeft: "8px" }}>Hủy</button>
                  </form>
                ) : (
                  <form onSubmit={handleAddNewTrack} style={{ padding: "1rem", background: theme.inputBg, borderRadius: "10px", border: `1px solid ${theme.inputBorder}`, marginBottom: "1.4rem" }}>
                    <input required value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Tên bài hát mới..." style={{ width: "100%", height: "38px", padding: "0 10px", borderRadius: "6px", background: theme.cardBg, border: `1px solid ${theme.inputBorder}`, color: theme.textMain, marginBottom: "8px" }} />
                    <input value={newArtist} onChange={(e) => setNewArtist(e.target.value)} placeholder="Nghệ sĩ..." style={{ width: "100%", height: "38px", padding: "0 10px", borderRadius: "6px", background: theme.cardBg, border: `1px solid ${theme.inputBorder}`, color: theme.textMain, marginBottom: "8px" }} />
                    <input required value={newUrl} onChange={(e) => setNewUrl(e.target.value)} placeholder="Đường dẫn (/audio/file.mp3)..." style={{ width: "100%", height: "38px", padding: "0 10px", borderRadius: "6px", background: theme.cardBg, border: `1px solid ${theme.inputBorder}`, color: theme.textMain, marginBottom: "8px" }} />
                    <button type="submit" className="primary-button" style={{ width: "100%", minHeight: "38px" }}>Thêm bài hát</button>
                  </form>
                )}

                <div style={{ display: "grid", gap: "0.5rem", maxHeight: "320px", overflowY: "auto" }}>
                  {tracks.map((track, index) => (
                    <div key={track.id || index} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: editingTrack?.id === track.id ? "rgba(173,214,255,.18)" : theme.inputBg, border: `1px solid ${theme.inputBorder}`, borderRadius: "8px" }}>
                      <span style={{ color: theme.textMain, fontSize: "12.5px" }}>0{index + 1}. {track.title}</span>
                      <div style={{ display: "flex", gap: "6px" }}>
                        <button type="button" className="secondary-button" onClick={() => { setEditingTrack(track); setEditTitle(track.title); setEditArtist(track.artist || ""); setEditUrl(track.audioUrl); }} style={{ padding: "4px 8px", fontSize: "11px", borderColor: theme.cardBorder, color: theme.textMain }}>Sửa</button>
                        <button type="button" className="secondary-button danger-text" onClick={() => handleDeleteTrack(track)} style={{ padding: "4px 8px", fontSize: "11px" }}>Xóa</button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {studioTab === "tags" && (
              <section className="editor-card" style={{ background: theme.cardBg, borderColor: theme.cardBorder, borderRadius: "12px", padding: "1.4rem" }}>
                <span className="eyebrow" style={{ color: theme.textMuted }}>tags / đồng cỏ</span>
                <h2 style={{ color: theme.textMain, margin: "0.3rem 0 0.8rem" }}>Quản lý tags</h2>
              </section>
            )}

            {studioTab === "characters" && (
              <section className="inventory-card" style={{ background: theme.cardBg, borderColor: theme.cardBorder, borderRadius: "12px", padding: "1.4rem" }}>
                <div className="editor-heading" style={{ marginBottom: "1rem" }}>
                  <span className="eyebrow" style={{ color: theme.textMuted }}>catalog / {characters.length} hồ sơ</span>
                  <h2 style={{ color: theme.textMain, margin: "0.2rem 0" }}>Đang có trong cỏ</h2>
                </div>
                <div style={{ display: "grid", gap: "0.6rem", maxHeight: "650px", overflowY: "auto" }}>
                  {characters.map((character) => (
                    <div key={character.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", background: editing?.id === character.id ? "rgba(173,214,255,.18)" : theme.inputBg, border: `1px solid ${theme.inputBorder}`, borderRadius: "10px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <img src={character.imageUrl || rabbitLogo} alt="" style={{ width: "42px", height: "42px", objectFit: "cover", borderRadius: "8px", background: "#0c2650" }} />
                        <strong style={{ color: theme.textMain, fontSize: "13px" }}>{character.name}</strong>
                      </div>
                      <div style={{ display: "flex", gap: "6px" }}>
                        <button className="secondary-button" onClick={() => startEdit(character)} style={{ padding: "4px 10px", fontSize: "11px", borderColor: theme.cardBorder, color: theme.textMain }}>Sửa</button>
                        <button className="icon-button danger" onClick={() => setConfirmDelete(character)} style={{ width: "28px", height: "28px" }}>×</button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      </main>

      {previewing && <CharacterPreviewModal form={form} onClose={() => setPreviewing(false)} />}
      {confirmDelete && <ConfirmDeleteModal character={confirmDelete} onClose={() => setConfirmDelete(null)} onConfirm={() => handleDeleteCharacter(confirmDelete)} />}
    </div>
  );
}

function CharacterPreviewModal({ form, onClose }: { form: any; onClose: () => void }) {
  const [zone, setZone] = useState(form.sections?.[0] || "new");
  const { titleColor, bodyColor } = resolveColors(form);
  const zoneName = zone === "new" ? "Thỏ Múp Sữa" : zone === "featured" ? "Thỏ Kỳ Tích" : "Thỏ Mặt Trăng";
  return (
    <div className="modal-layer" onClick={onClose}>
      <div className="modal-panel preview-modal" style={{ "--title-color": titleColor, "--body-color": bodyColor } as React.CSSProperties} onClick={(event) => event.stopPropagation()}>
        <button className="icon-button modal-close" onClick={onClose} aria-label="Đóng"><X size={18} /></button>
        <div className="preview-zone-tabs" role="tablist">{[["new", "Thỏ Múp Sữa"], ["featured", "Thỏ Kỳ Tích"], ["coming", "Thỏ Mặt Trăng"]].map(([value, label]) => <button type="button" role="tab" className={zone === value ? "active" : ""} onClick={() => setZone(value)} key={value}>{label}</button>)}</div>
        <div className="preview-zone-heading"><span className="eyebrow">xem trước / {zoneName}</span></div>
        <PreviewZone form={form} zone={zone} />
        <button className="primary-button" type="button" style={{ marginTop: "1.2rem" }} onClick={onClose}>Đóng xem trước</button>
      </div>
    </div>
  );
}

function PreviewZone({ form, zone }: { form: any; zone: string }) {
  const image = form.imageUrl || rabbitLogo; 
  const { titleColor, bodyColor } = resolveColors(form);
  return (
    <article className="preview-character-card" style={{ "--title-color": titleColor, "--body-color": bodyColor, position: "relative", overflow: "hidden", borderRadius: "16px", border: "1px solid rgba(173,214,255,.2)" } as React.CSSProperties}>
      <div className="preview-character-art" style={{ aspectRatio: "1 / 1.15", position: "relative" }}>
        <img src={image} alt={form.name || "Ảnh"} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        <div style={{ position: "absolute", bottom: "0.65rem", left: "0.65rem", right: "0.65rem", padding: "0.8rem 0.95rem", background: "rgba(255, 255, 255, 0.18)", backdropFilter: "blur(12px)", borderRadius: "14px", border: "1px solid rgba(255, 255, 255, 0.3)" }}>
          <strong style={{ fontSize: "1.18rem", color: titleColor || "#ffffff", fontFamily: '"Playfair Display", serif', lineHeight: 1.15 }}>{form.name || "Tên nhân vật"}</strong>
          <small style={{ fontSize: "11px", color: bodyColor || "rgba(255,255,255,0.85)", display: "block" }}>{form.caption || "Caption của nhân vật"}</small>
        </div>
      </div>
    </article>
  );
}

function ConfirmDeleteModal({ character, onClose, onConfirm }: { character: Character; onClose: () => void; onConfirm: () => void }) {
  return <div className="modal-layer"><div className="modal-panel confirm-modal"><button className="icon-button modal-close" onClick={onClose} aria-label="Đóng"><X size={18} /></button><span className="eyebrow">studio / xác nhận</span><h2>Xóa {character?.name}?</h2><div className="editor-actions"><button className="secondary-button" onClick={onClose}>Giữ lại</button><button className="primary-button danger-button" onClick={onConfirm}>Xóa</button></div></div></div>;
}

// ==================== COMPONENT CHÍNH ====================
export default function Home() {
  const [studioGate, setStudioGate] = useState(false); 
  const [studio, setStudio] = useState(false); 
  const [hasEntered, setHasEntered] = useState(false);

  const [characters, setCharacters] = useState<Character[]>(() => {
    try {
      const saved = localStorage.getItem("lalapine-custom-characters");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length) return parsed.map(sanitizeCharacter);
      }
    } catch {}
    if (websiteData && Array.isArray(websiteData.characters) && websiteData.characters.length > 0) {
      return websiteData.characters.map(sanitizeCharacter);
    }
    return fallbackCharacters.map(sanitizeCharacter);
  });

  const [notifications, setNotifications] = useState<NotificationItem[]>(() => {
    try {
      const saved = localStorage.getItem("lalapine-custom-notifications");
      if (saved) return JSON.parse(saved);
    } catch {}
    if (websiteData && Array.isArray(websiteData.notifications) && websiteData.notifications.length > 0) {
      return websiteData.notifications;
    }
    return [];
  });

  const [tracks, setTracks] = useState<Track[]>(() => {
    try {
      const saved = localStorage.getItem("lalapine-custom-tracks");
      if (saved) return JSON.parse(saved);
    } catch {}
    if (websiteData && Array.isArray((websiteData as any).tracks) && (websiteData as any).tracks.length > 0) {
      return (websiteData as any).tracks;
    }
    return defaultTracks;
  });

  const [feedbacks, setFeedbacks] = useState<CharacterFeedback[]>(() => {
    try {
      const saved = localStorage.getItem("lalapine-custom-feedbacks");
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const [readNotificationIds, setReadNotificationIds] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("lalapine-read-notifications") || "[]"); } catch { return []; }
  });

  const markNotificationRead = (id: string) => {
    if (readNotificationIds.includes(id)) return;
    const next = [...readNotificationIds, id];
    setReadNotificationIds(next);
    localStorage.setItem("lalapine-read-notifications", JSON.stringify(next));
  };

  useEffect(() => {
    async function loadGitHubFeedbacks() {
      const gitFeedbacks = await fetchFeedbacksFromGitHub();
      if (gitFeedbacks.length > 0) {
        setFeedbacks(gitFeedbacks);
        localStorage.setItem("lalapine-custom-feedbacks", JSON.stringify(gitFeedbacks));
      }
    }
    loadGitHubFeedbacks();
  }, []);

  const handleCommitToGitHub = async () => {
    const payload = {
      characters: characters.map(sanitizeCharacter),
      notifications: notifications,
      tracks: tracks,
    };
    const success = await saveToGitHub(payload);
    if (success) {
      toast.success("Đã đẩy commit lên GitHub thành công! Vercel đang tự build lại web.", {
        icon: <CheckCircle2 size={16} style={{ color: "#4ade80" }} />,
        duration: 5000,
      });
    } else {
      toast.error("Chưa đẩy được lên GitHub. Hãy kiểm tra biến VITE_GITHUB_TOKEN trên Vercel.");
    }
  };

  const handleSaveCharacters = (newChars: Character[]) => {
    const sanitized = newChars.map(sanitizeCharacter);
    setCharacters(sanitized);
    localStorage.setItem("lalapine-custom-characters", JSON.stringify(sanitized));
  };

  const handleSaveNotifications = (newNotifs: NotificationItem[]) => {
    setNotifications(newNotifs);
    localStorage.setItem("lalapine-custom-notifications", JSON.stringify(newNotifs));
  };

  const handleSaveTracks = (newTracks: Track[]) => {
    setTracks(newTracks);
    localStorage.setItem("lalapine-custom-tracks", JSON.stringify(newTracks));
  };

  const handleAddFeedback = async (charId: number, charName: string, authorName: string, content: string) => {
    const newFb: CharacterFeedback = {
      id: `${Date.now()}`,
      characterId: charId,
      authorName,
      content,
      createdAt: new Date().toISOString()
    };
    const nextList = [newFb, ...feedbacks];
    setFeedbacks(nextList);
    localStorage.setItem("lalapine-custom-feedbacks", JSON.stringify(nextList));
    void postFeedbackToGitHub(charId, charName, authorName, content);
  };

  useEffect(() => { 
    const handler = (event: KeyboardEvent) => { 
      const key = String(event.key || "").toLowerCase(); 
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && (key === "l" || event.code === "KeyL")) { 
        event.preventDefault(); 
        setStudio(false); 
        setStudioGate(true); 
      } 
    }; 
    window.addEventListener("keydown", handler, true); 
    return () => window.removeEventListener("keydown", handler, true); 
  }, []);

  return (
    <>
      {!hasEntered && (
        <StartScreen onStart={() => setHasEntered(true)} />
      )}

      {studio ? (
        <OwnerWorkspace 
          characters={characters} 
          onClose={() => setStudio(false)} 
          onSaveCharacters={handleSaveCharacters} 
          tracks={tracks}
          onSaveTracks={handleSaveTracks}
          notifications={notifications}
          onSaveNotifications={handleSaveNotifications}
          feedbacks={feedbacks}
          onCommitToGitHub={handleCommitToGitHub}
        />
      ) : (
        <PublicPage 
          characters={characters} 
          onStudio={() => setStudioGate(true)} 
          tracks={tracks}
          notifications={notifications}
          readNotificationIds={readNotificationIds}
          onMarkNotificationRead={markNotificationRead}
          feedbacks={feedbacks}
          onAddFeedback={handleAddFeedback}
        />
      )}
      
      {studioGate && !studio && (
        <AdminGate 
          onClose={() => setStudioGate(false)} 
          onUnlock={() => { 
            setStudioGate(false); 
            setStudio(true); 
          }} 
        />
      )}
    </>
  );
}
