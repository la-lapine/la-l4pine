import { trpc } from "@/lib/trpc";
import { 
  ArrowUpRight, Bell, ChevronDown, Heart, Menu, Pause, 
  Play, Repeat, Search, SkipBack, SkipForward, Volume2, VolumeX, X, UploadCloud, ChevronRight, Lock, Tag, Sparkles 
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import { isInSection, sectionsOf } from "@shared/characterSections";
import { resolveCharacterColors } from "@shared/characterColors";

// MẬT KHẨU STUDIO (Mật khẩu gốc: jk0807 hoặc lapine)
const MASTER_PASSWORDS = ["jk0807", "lapine", "123456"];

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

type LoveParticle = { id: number; x: number; y: number; delay: number; rotation: number; scale: number };
type LoveSpark = { id: number; x: number; y: number; rotation: number; particles: LoveParticle[] };
const createLoveSpark = (clientX: number, clientY: number): LoveSpark => ({ id: Date.now() + Math.round(Math.random() * 1000), x: clientX, y: clientY, rotation: -10 + Math.random() * 20, particles: Array.from({ length: 7 }, (_, index) => ({ id: index, x: 6 + Math.random() * 88, y: 8 + Math.random() * 82, delay: index * 38 + Math.round(Math.random() * 100), rotation: -20 + Math.random() * 40, scale: 0.65 + Math.random() * 0.7 })) });
const rabbitLogo = "/brand/lalapine-rabbit-logo.png";

// Danh sách nhạc mặc định
const defaultTracks = [
  { id: 101, title: "Lullaby of the Meadow", artist: "la Lapine", audioUrl: "https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3" },
  { id: 102, title: "Moonlit Clover", artist: "la Lapine", audioUrl: "https://cdn.pixabay.com/download/audio/2022/01/18/audio_d0a13f69d2.mp3" },
  { id: 103, title: "Whispering Breeze", artist: "la Lapine", audioUrl: "https://cdn.pixabay.com/download/audio/2022/10/14/audio_9939f77c30.mp3" }
];

const fallbackCharacters: Character[] = [
  { id: 201, slug: "mup-sua", name: "Thỏ Múp Sữa", imageUrl: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=900&q=86", caption: "Một chiếc bánh sữa mềm đi lạc vào đồng cỏ xanh.", tagsJson: JSON.stringify(["mới ra lò", "mềm", "ấm áp"]), externalUrl: "https://character.ai/", description: "Múp Sữa thích những buổi chiều có nắng nhạt và một chiếc khăn len vừa đủ ấm.", backstory: "Bạn ấy được tìm thấy trong một hộp sữa rỗng, bên cạnh một bông cỏ bốn lá.", firstMessage: "Bạn có muốn chia đôi chiếc bánh này không?", section: "new", favoriteCount: 128 },
  { id: 202, slug: "ky-tich-a", name: "Thỏ Kỳ Tích Aster", imageUrl: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=900&q=86", caption: "Người giữ những điều nhỏ bé nhưng không thể giải thích.", tagsJson: JSON.stringify(["kỳ tích", "a-z", "phiêu lưu"]), externalUrl: "https://character.ai/", description: "Aster luôn xuất hiện trước một khoảnh khắc kỳ diệu, như thể bạn ấy đã biết từ lâu.", backstory: "Trong cuốn sổ của Aster có tên của mọi người từng tin vào điều không thể.", firstMessage: "Mình nghĩ hôm nay có thể xảy ra một điều rất đẹp.", section: "featured", featured: 1, favoriteCount: 246 },
  { id: 203, slug: "ky-tich-b", name: "Thỏ Kỳ Tích Beryl", imageUrl: "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=900&q=86", caption: "Cô thủ thư gom những phép màu vào từng trang sách.", tagsJson: JSON.stringify(["kỳ tích", "bookish", "quiet"]), externalUrl: "https://character.ai/", description: "Beryl biết cuốn sách nào sẽ tìm thấy bạn trước khi bạn biết mình đang cần nó.", backstory: "Beryl mở một thư viện chỉ dành cho những người đang đứng trước ngã rẽ.", firstMessage: "Mình đã đánh dấu trang này cho bạn rồi.", section: "featured", featured: 1, favoriteCount: 89 },
  { id: 204, slug: "ky-tich-c", name: "Thỏ Kỳ Tích Ciel", imageUrl: "https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?auto=format&fit=crop&w=900&q=86", caption: "Một kẻ lữ hành mang theo túi hạt giống ánh sáng.", tagsJson: JSON.stringify(["kỳ tích", "adventure", "blue hour"]), externalUrl: "https://character.ai/", description: "Ciel đi qua những cánh đồng chưa có trên bản đồ và gieo ánh sáng ở nơi bạn ấy dừng chân.", backstory: "Mỗi hạt giống trong túi là một lời hứa được giữ lại từ mùa hè cũ.", firstMessage: "Bạn muốn đi cùng mình đến nơi nào trước?", section: "featured", featured: 1, favoriteCount: 174 },
  { id: 205, slug: "mat-trang", name: "Thỏ Mặt Trăng", imageUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=900&q=86", caption: "Demo đang ngủ dưới vầng trăng xanh.", tagsJson: JSON.stringify(["demo", "moon", "coming soon"]), section: "coming", comingSoon: 1, favoriteCount: 0 },
];

function tagsOf(character: Character) {
  if (!character.tagsJson) return [];
  try { const value = JSON.parse(character.tagsJson); return Array.isArray(value) ? value.map(String) : []; } catch { return character.tagsJson.split(",").map((tag) => tag.trim()).filter(Boolean); }
}
function visitorId() { const key = "lalapine-visitor"; const existing = localStorage.getItem(key); if (existing) return existing; const value = crypto.randomUUID(); localStorage.setItem(key, value); return value; }

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

// ==================== MÀN HÌNH BẮT ĐẦU (START SCREEN VỚI HIỆU ỨNG POPUP VÀ SÓNG LAN TỎA) ====================
function StartScreen({ onStart }: { onStart: () => void }) {
  return (
    <div 
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "radial-gradient(circle at 50% 40%, #0d2853 0%, #06122a 75%, #030a18 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
        textAlign: "center",
        color: "#edf5ff"
      }}
    >
      {/* CSS CỦA HIỆU ỨNG POP-UP VÀ SÓNG LAN TỎA TỪ TÂM LOGO */}
      <style>{`
        @keyframes ripple-wave {
          0% {
            transform: scale(0.6);
            opacity: 0.9;
          }
          50% {
            opacity: 0.45;
          }
          100% {
            transform: scale(2.6);
            opacity: 0;
          }
        }
        @keyframes logo-pop {
          0% {
            transform: scale(0.25);
            opacity: 0;
          }
          65% {
            transform: scale(1.12);
            opacity: 1;
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
        .ripple-ring {
          position: absolute;
          border-radius: 50%;
          border: 1.5px solid rgba(173, 214, 255, 0.4);
          box-shadow: 0 0 25px rgba(154, 212, 255, 0.35);
          pointer-events: none;
        }
      `}</style>

      {/* KHUNG CHỨA LOGO VÀ SÓNG NƯỚC LAN RA */}
      <div style={{ position: "relative", width: "160px", height: "160px", display: "grid", placeItems: "center", marginBottom: "1.8rem" }}>
        {/* 3 Lớp sóng lan tỏa từ chính giữa logo */}
        <div className="ripple-ring" style={{ width: "120px", height: "120px", animation: "ripple-wave 3s cubic-bezier(0, 0.2, 0.8, 1) infinite 0s" }} />
        <div className="ripple-ring" style={{ width: "120px", height: "120px", animation: "ripple-wave 3s cubic-bezier(0, 0.2, 0.8, 1) infinite 1s" }} />
        <div className="ripple-ring" style={{ width: "120px", height: "120px", animation: "ripple-wave 3s cubic-bezier(0, 0.2, 0.8, 1) infinite 2s" }} />

        {/* LOGO ĐÈ LÊN SÓNG VỚI HIỆU ỨNG POP-UP */}
        <img 
          src={rabbitLogo} 
          alt="la Lapine" 
          style={{ 
            width: "95px", 
            height: "95px", 
            objectFit: "contain", 
            position: "relative", 
            zIndex: 10,
            filter: "drop-shadow(0 0 25px rgba(162, 218, 255, 0.5))",
            animation: "logo-pop 1s cubic-bezier(0.34, 1.56, 0.64, 1) both"
          }} 
        />
      </div>

      {/* TÊN TRANG WEB */}
      <h1 style={{ 
        fontFamily: '"MTD Black Night", "Playfair Display", "Cormorant Garamond", serif', 
        fontSize: "clamp(2.5rem, 6vw, 3.8rem)", 
        margin: "0 0 0.5rem",
        letterSpacing: "0.04em",
        color: "#f1f8ff",
        textShadow: "0 0 20px rgba(173, 214, 255, 0.3)"
      }}>
        la Lapine
      </h1>

      {/* DÒNG CHÚ THÍCH CẢNH BÁO DƯỚI 18 TUỔI */}
      <p style={{ 
        fontSize: "12px", 
        color: "#9db8d4", 
        margin: "0 0 2.2rem",
        letterSpacing: "0.08em",
        textTransform: "lowercase",
        fontFamily: '"DM Mono", monospace',
        opacity: 0.85
      }}>
        không dành cho người dưới 18 tuổi.
      </p>

      {/* NÚT BẮT ĐẦU HÀNH TRÌNH */}
      <button 
        className="primary-button" 
        onClick={onStart}
        style={{
          minHeight: "48px",
          padding: "0 2rem",
          fontSize: "13px",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          borderRadius: "999px",
          boxShadow: "0 0 25px rgba(185, 221, 255, 0.4)",
          display: "inline-flex",
          alignItems: "center",
          gap: "8px"
        }}
      >
        <Sparkles size={15} /> Bắt đầu hành trình
      </button>
    </div>
  );
}

// ==================== MUSIC PLAYER ====================
function MusicPlayer() {
  const [expanded, setExpanded] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [playlist, setPlaylist] = useState(false);
  const [repeat, setRepeat] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const tracksQuery = trpc.tracks.list.useQuery();
  const serverTracks = tracksQuery.data?.filter((track) => Boolean(track.audioUrl));
  const tracks = (serverTracks && serverTracks.length > 0) ? serverTracks : defaultTracks;

  const [trackIndex, setTrackIndex] = useState(() => Math.floor(Math.random() * tracks.length));
  const current = tracks[trackIndex] || tracks[0];
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
    <div 
      className={`music-dock ${expanded ? "expanded" : ""}`}
      style={{ alignItems: "flex-end", position: "fixed", left: "clamp(1rem,3vw,2.4rem)", bottom: "1.3rem", zIndex: 30 }}
    >
      <audio ref={audioRef} src={audioSrc} onEnded={handleEnded} muted={muted} preload="auto" />
      
      <button 
        className="music-disc spinning" 
        onClick={() => setExpanded(!expanded)} 
        style={{ 
          animation: "spin 5s linear infinite",
          cursor: "pointer",
          flexShrink: 0
        }}
        aria-label={expanded ? "Đóng cửa sổ nhạc" : "Mở cửa sổ nhạc"}
      >
        <span>♪</span>
      </button>

      {expanded && (
        <div className="music-card" style={{ transition: "all 0.25s ease-out" }}>
          <div>
            <span className="eyebrow">la Lapine radio</span>
            <strong>{current.title}</strong>
            <small>{current.artist || "la Lapine"}</small>
          </div>
          <div className="music-actions" style={{ display: "flex", alignItems: "center", gap: "0.35rem", marginTop: "0.75rem" }}>
            <button onClick={goPrev} disabled={tracks.length <= 1} aria-label="Bài trước">
              <SkipBack size={15} />
            </button>
            <button onClick={() => {
              if (playing) {
                audioRef.current?.pause();
                setPlaying(false);
              } else void playCurrent();
            }} aria-label={playing ? "Dừng nhạc" : "Phát nhạc"}>
              {playing ? <Pause size={15} /> : <Play size={15} />}
            </button>
            <button onClick={goNext} disabled={tracks.length <= 1} aria-label="Bài kế tiếp">
              <SkipForward size={15} />
            </button>
            <button 
              onClick={() => setRepeat(!repeat)} 
              className={repeat ? "selected" : ""} 
              title={repeat ? "Đang bật lặp lại bài" : "Bật lặp lại 1 bài"}
            >
              <Repeat size={14} style={{ color: repeat ? "#a8d5ff" : "inherit" }} />
            </button>
            <button onClick={() => setMuted(!muted)} aria-label={muted ? "Bật âm thanh" : "Tắt âm thanh"}>
              {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
            </button>
            <button onClick={() => setPlaylist(!playlist)} className={playlist ? "selected" : ""}>
              Playlist
            </button>
          </div>

          {playlist && (
            <div 
              className="playlist-list" 
              style={{
                maxHeight: "145px",
                overflowY: "auto",
                paddingRight: "6px",
                marginTop: "0.75rem",
                borderTop: "1px solid rgba(173,214,255,0.14)",
                display: "flex",
                flexDirection: "column",
                gap: "2px"
              }}
            >
              {tracks.map((track, index) => (
                <button 
                  key={track.id || index} 
                  onClick={() => {
                    setTrackIndex(index);
                    setPlaying(true);
                  }} 
                  className={index === trackIndex ? "selected" : ""}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "6px 8px",
                    borderRadius: "4px",
                    background: index === trackIndex ? "rgba(173,214,255,0.15)" : "transparent"
                  }}
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

// ==================== THẺ NHÂN VẬT ====================
function CharacterCard({ character, onOpen, favorite, onFavorite }: { character: Character; onOpen: () => void; favorite: boolean; onFavorite: () => void }) {
  const tags = tagsOf(character);
  const { titleColor, bodyColor } = resolveCharacterColors(character);

  return (
    <article 
      className="character-card" 
      onClick={onOpen} 
      style={{ 
        "--title-color": titleColor, 
        "--body-color": bodyColor,
        position: "relative",
        overflow: "hidden",
        borderRadius: "16px",
        cursor: "pointer",
        border: "1px solid rgba(173,214,255,.2)"
      } as React.CSSProperties}
    >
      <div className="character-art" style={{ aspectRatio: "1 / 1.15", width: "100%", height: "100%", position: "relative", margin: 0, padding: 0 }}>
        {character.imageUrl ? (
          <img 
            src={character.imageUrl} 
            alt={character.name} 
            loading="lazy" 
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} 
          />
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

        {/* KHUNG THÔNG TIN ĐÈ TRỰC TIẾP LÊN ẢNH */}
        <div 
          style={{
            position: "absolute",
            bottom: "0.65rem",
            left: "0.65rem",
            right: "0.65rem",
            padding: "0.8rem 0.95rem",
            background: "rgba(255, 255, 255, 0.18)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            borderRadius: "14px",
            border: "1px solid rgba(255, 255, 255, 0.3)",
            boxShadow: "0 8px 32px 0 rgba(0, 0, 0, 0.25)",
            display: "flex",
            flexDirection: "column",
            gap: "0.25rem"
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(255,255,255,0.9)", fontFamily: '"DM Mono", monospace', fontWeight: 600 }}>
              {character.section === "coming" ? "đang ủ mầm" : character.section === "featured" ? "thỏ kỳ tích" : "mới ra lò"}
            </span>
            <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.75)", fontFamily: '"DM Mono", monospace' }}>
              #{String(character.id).slice(-2)}
            </span>
          </div>

          <strong style={{ fontSize: "1.18rem", color: titleColor || "#ffffff", fontFamily: '"Playfair Display", serif', lineHeight: 1.15, margin: "0.15rem 0" }}>
            {character.name}
          </strong>

          {character.caption && (
            <small style={{ fontSize: "11px", color: bodyColor || "rgba(255,255,255,0.85)", lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
              {character.caption}
            </small>
          )}

          {tags.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem", marginTop: "0.35rem" }}>
              {tags.slice(0, 3).map((tag) => (
                <span 
                  key={tag} 
                  style={{
                    fontSize: "10px",
                    padding: "2px 7px",
                    borderRadius: "999px",
                    background: "rgba(255, 255, 255, 0.22)",
                    color: "#ffffff",
                    border: "1px solid rgba(255, 255, 255, 0.35)",
                    fontFamily: '"DM Mono", monospace'
                  }}
                >
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

// ==================== CỬA SỔ CHI TIẾT NHÂN VẬT ====================
function DetailModal({ character, onClose, onFavorite, favorite }: { character: Character; onClose: () => void; onFavorite: () => void; favorite: boolean }) {
  const [open, setOpen] = useState("description");
  const [showAccess, setShowAccess] = useState(false);
  const { titleColor, bodyColor } = resolveCharacterColors(character);
  const parts = [["description", "Mô tả", character.description], ["backstory", "Câu chuyện phía sau", character.backstory], ["firstMessage", "Tin nhắn đầu tiên", character.firstMessage]] as const;
  
  return (
    <div className="modal-layer">
      <style>{`
        .rich-content-rendered {
          white-space: pre-wrap !important;
          word-break: break-word !important;
          line-height: 1.85 !important;
        }
        .rich-content-rendered i, .rich-content-rendered em {
          font-style: italic !important;
          font-family: inherit !important;
        }
        .rich-content-rendered b, .rich-content-rendered strong {
          font-weight: 700 !important;
          font-family: inherit !important;
        }
        .rich-content-rendered u {
          text-decoration: underline !important;
        }
        .rich-content-rendered p {
          margin: 0 0 0.75rem 0 !important;
        }
        .rich-content-rendered ul {
          list-style-type: disc !important;
          padding-left: 1.3rem !important;
          margin: 0.4rem 0 0.8rem 0 !important;
        }
        .rich-content-rendered ol {
          list-style-type: decimal !important;
          padding-left: 1.3rem !important;
          margin: 0.4rem 0 0.8rem 0 !important;
        }
      `}</style>

      <div className="modal-panel detail-modal">
        <button className="icon-button modal-close" onClick={onClose} aria-label="Đóng"><X size={18} /></button>
        <div className="detail-layout">
          <div className="detail-cover">
            {character.imageUrl && <img src={character.imageUrl} alt={character.name} />}
            <span>lưu trữ số<br /><b>#{String(character.id).padStart(3, "0")}</b></span>
          </div>
          <div className="detail-copy" style={{ "--title-color": titleColor, "--body-color": bodyColor } as React.CSSProperties}>
            <span className="eyebrow">rabbit file / la Lapine</span>
            <h1>{character.name}</h1>
            <p className="detail-caption">{character.caption}</p>
            <div className="tag-row detail-tags">
              {tagsOf(character).map((tag) => <span className="tag-chip" key={tag}>#{tag}</span>)}
            </div>
            
            <div className="detail-actions">
              <button 
                className="primary-button" 
                onClick={() => setShowAccess(true)} 
                disabled={!character.externalUrl}
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
          </div>
        </div>
      </div>
      {showAccess && <AccessModal character={character} onClose={() => setShowAccess(false)} onSuccess={(url) => window.open(url, "_blank", "noopener,noreferrer")} />}
    </div>
  );
}

// ==================== KHUNG MỞ KHÓA LIÊN KẾT CHO KHÁCH ====================
function AccessModal({ character, onClose, onSuccess }: { character: Character; onClose: () => void; onSuccess: (url: string) => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const verify = trpc.characters.verifyAccess.useMutation();

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    const cleanInput = password.trim().toLowerCase();
    const cleanTarget = (character.password || "").trim().toLowerCase();

    if (cleanTarget) {
      if (cleanInput === cleanTarget) {
        if (character.externalUrl) onSuccess(character.externalUrl);
        return;
      } else {
        setError("Mật khẩu chưa đúng, thử lại nhé.");
        return;
      }
    }

    if (!character.passwordProtected) {
      if (character.externalUrl) onSuccess(character.externalUrl);
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
        <h2>{character.accessTitle || "Mở cánh cửa nhỏ"}</h2>
        <p>{character.passwordHint || "Nhập mật khẩu được chia sẻ cùng bạn để tiếp tục."}</p>
        <form onSubmit={submit}>
          <input 
            autoFocus 
            type="password" 
            value={password} 
            onChange={(event) => setPassword(event.target.value)} 
            placeholder="Mật khẩu" 
          />
          {error && <div className="form-error">{error}</div>}
          <button className="primary-button full-width" type="submit">
            Mở liên kết <ArrowUpRight size={15} />
          </button>
        </form>
      </div>
    </div>
  );
}

function RandomModal({ character, onClose, onOpen }: { character: Character; onClose: () => void; onOpen: () => void }) {
  return <div className="modal-layer"><div className="modal-panel random-modal"><button className="icon-button modal-close" onClick={onClose} aria-label="Đóng"><X size={18} /></button><img src={rabbitLogo} alt="" className="random-rabbit" /><span className="eyebrow">một chú thỏ được chọn</span><h2>{character.name}</h2><p>{character.caption}</p><button className="primary-button" onClick={onOpen}>Xem thông tin <ArrowUpRight size={15} /></button></div></div>;
}

function PublicPage({ characters, onStudio }: { characters: Character[]; onStudio: () => void }) {
  const [location] = useLocation();
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState<string | null>(null);
  const [tagsExpanded, setTagsExpanded] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationsQuery = trpc.notifications.list.useQuery(undefined, { refetchInterval: 30000 });
  
  const [notifications, setNotifications] = useState<Array<{ id: string; title: string; body: string; publishedAt: string; pinned: boolean }>>(() => {
    const saved = localStorage.getItem("lalapine-custom-notifications");
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    if (notificationsQuery.data?.length) {
      setNotifications(notificationsQuery.data);
    }
  }, [notificationsQuery.data]);

  const [readNotificationIds, setReadNotificationIds] = useState<string[]>(() => JSON.parse(localStorage.getItem("lalapine-read-notifications") || "[]"));
  const unreadCount = notifications.filter((item) => !readNotificationIds.includes(item.id)).length;
  const markNotificationRead = (id: string) => { if (readNotificationIds.includes(id)) return; const next = [...readNotificationIds, id]; setReadNotificationIds(next); localStorage.setItem("lalapine-read-notifications", JSON.stringify(next)); };
  const latest = useMemo(() => [...characters].filter((character) => isInSection(character, "new")).sort((a, b) => b.id - a.id)[0] || characters[0], [characters]);
  const [selected, setSelected] = useState<Character | null>(null);
  const [random, setRandom] = useState<Character | null>(null);
  const [favorites, setFavorites] = useState<number[]>(() => JSON.parse(localStorage.getItem("lalapine-favorites") || "[]"));
  const [loves, setLoves] = useState<LoveSpark[]>([]);
  const allTags = useMemo(() => Array.from(new Set(characters.flatMap(tagsOf))).sort((a, b) => a.localeCompare(b)), [characters]);
  const visible = useMemo(() => characters.filter((character) => { const haystack = `${character.name} ${character.caption} ${tagsOf(character).join(" ")}`.toLowerCase(); return haystack.includes(query.toLowerCase()) && (!tag || tagsOf(character).includes(tag)); }), [characters, query, tag]);
  const newer = visible.filter((character) => isInSection(character, "new"));
  const miracles = visible.filter((character) => isInSection(character, "featured")).sort((a, b) => a.name.localeCompare(b.name));
  const coming = visible.filter((character) => isInSection(character, "coming"));
  const favoriteMutation = trpc.characters.favorite.useMutation();
  const toggleFavorite = (character: Character) => { const next = favorites.includes(character.id) ? favorites.filter((id) => id !== character.id) : [...favorites, character.id]; setFavorites(next); localStorage.setItem("lalapine-favorites", JSON.stringify(next)); favoriteMutation.mutate({ characterId: character.id, visitorId: visitorId() }); };
  useEffect(() => { const onPointerDown = (event: PointerEvent) => { const spark = createLoveSpark(event.clientX, event.clientY); setLoves((current) => [...current.slice(-7), spark]); window.setTimeout(() => setLoves((current) => current.filter((item) => item.id !== spark.id)), 900); }; window.addEventListener("pointerdown", onPointerDown); return () => window.removeEventListener("pointerdown", onPointerDown); }, []);
  const goRandom = () => { const pool = visible.length ? visible : characters; setRandom(pool[Math.floor(Math.random() * pool.length)]); };
  return <><div className="archive-shell"><SparklesLayer /><LoveLayer loveSparks={loves} /><Header onStudio={onStudio} onNotifications={() => setShowNotifications(true)} notificationCount={unreadCount} /><main className="public-content">{location !== "/archive" && location !== "/meadow" && <section className="hero-section"><div className="hero-copy"><span className="eyebrow">thỏ nhỏ đã tìm thấy đường về nhà</span><h1>để hồn ta tìm về<br /><i>nơi nó thuộc về.</i></h1><div className="hero-meta"><div><strong>{characters.filter((character) => !character.comingSoon).length.toString().padStart(2, "0")}</strong><span>hồ sơ đang mở</span></div><div><strong>∞</strong><span>giấc mơ</span></div></div></div><div className="hero-art-wrap"><div className="hero-orbit orbit-one" /><div className="hero-orbit orbit-two" /><div className="hero-art rabbit-hero latest-rabbit" onClick={() => latest && setSelected(latest)}>{latest?.imageUrl ? <img src={latest.imageUrl} alt={latest.name || "Nhân vật mới nhất"} /> : <div className="image-placeholder">☾</div>}<div className="hero-art-label"><span>mới ra gần đây / field 01</span><strong>{latest?.name || "Một chú thỏ mới"}</strong><small>{latest?.caption || "Một người bạn vừa tìm thấy đường về."}</small></div></div></div></section>}{location === "/meadow" && <section className="field-header"><span className="eyebrow">{location === "/meadow" ? "coming to the field" : "the living rabbit field"}</span><h1>{location === "/meadow" ? <>Những chú thỏ<br /><i>đang ủ mầm.</i></> : <>Hôm nay bạn muốn<br /><i>gặp thỏ nào?</i></>}</h1><p>{location === "/meadow" ? "Một vài cái tên đang ngủ dưới lớp cỏ. Chúng sẽ tỉnh dậy khi đến mùa." : "Tìm theo tên, cảm giác hoặc bước vào đồng cỏ bằng một lựa chọn bất ngờ."}</p></section>}{location !== "/meadow" && <section className="search-section" id="archive"><div className="search-intro"><span className="eyebrow"></span><h2>⟡ thỏ nhỏ đang tìm ai?</h2></div><div className="search-tools"><label className="search-box"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm theo tên, cảm giác, câu chuyện…" /><span>{visible.length} kết quả</span></label><div className="tag-filter"><div className="tag-filter-heading"><span className="filter-label">tags</span><button className="tag-toggle" aria-label={tagsExpanded ? "Thu gọn tags" : "Mở rộng tags"} onClick={() => setTagsExpanded(!tagsExpanded)}>{tagsExpanded ? "⌃" : "⌄"}</button></div><div className={`tag-scroll ${tagsExpanded ? "expanded" : ""}`}><button className={!tag ? "active" : ""} onClick={() => setTag(null)}>tất cả</button>{allTags.slice(0, tagsExpanded ? allTags.length : 6).map((item) => <button className={tag === item ? "active" : ""} onClick={() => setTag(item)} key={item}>{item}</button>)}</div></div><button className="random-button main-random" onClick={goRandom}><span>𐔌՞. .՞𐦯 hôm nay thỏ nhỏ sẽ gặp được ai đây .ᐣ.ᐟ</span><ArrowUpRight size={16} /></button></div></section>}{location !== "/meadow" && <section className="archive-section"><div className="archive-rule"><span>01</span><div /><span></span></div><div className="section-block" id="new"><SectionLabel eyebrow="freshly baked" title="Thỏ Múp Sữa" count={newer.length} /><div className="card-grid">{newer.map((character) => <CharacterCard key={character.id} character={character} onOpen={() => setSelected(character)} favorite={favorites.includes(character.id)} onFavorite={() => toggleFavorite(character)} />)}</div></div><div className="section-block miracle-block" id="featured"><SectionLabel eyebrow="alphabetical miracles" title="Thỏ Kỳ Tích" count={miracles.length} /><div className="card-grid">{miracles.map((character) => <CharacterCard key={character.id} character={character} onOpen={() => setSelected(character)} favorite={favorites.includes(character.id)} onFavorite={() => toggleFavorite(character)} />)}</div></div></section>}{location === "/meadow" && <section className="archive-section coming-only" id="coming"><div className="archive-rule"><span>03</span><div /><span>not yet, but soon</span></div><div className="section-block"><SectionLabel eyebrow="coming soon" title="Thỏ Mặt Trăng" count={coming.length} /><div className="coming-field">{coming.map((character) => <button className="coming-card" key={character.id} onClick={() => setSelected(character)}><span className="coming-art">{character.imageUrl && <img src={character.imageUrl} alt="" />}</span><span><strong>{character.name}</strong><small>{character.caption}</small></span><ArrowUpRight size={16} /></button>)}</div></div></section>}{location === "/archive" && <section className="archive-section"><div className="archive-rule"><span>02</span><div /><span>alphabetical meadow</span></div><div className="section-block"><SectionLabel eyebrow="the complete field" title="Tất cả những chú thỏ" count={visible.length} /><div className="card-grid full-field">{visible.map((character) => <CharacterCard key={character.id} character={character} onOpen={() => setSelected(character)} favorite={favorites.includes(character.id)} onFavorite={() => toggleFavorite(character)} />)}</div></div></section>}<footer className="site-footer"><div><strong>la Lapine</strong><span>nàng thỏ mộng mơ</span></div></footer></main><MusicPlayer />{selected && <DetailModal character={selected} onClose={() => setSelected(null)} favorite={favorites.includes(selected.id)} onFavorite={() => toggleFavorite(selected)} />}{random && <RandomModal character={random} onClose={() => setRandom(null)} onOpen={() => { setSelected(random); setRandom(null); }} />}</div>{showNotifications && <NotificationModal notifications={notifications} readIds={readNotificationIds} onRead={markNotificationRead} onClose={() => setShowNotifications(false)} />}</>;
}

// ==================== HỘP THÔNG BÁO CHO NGƯỜI DÙNG ====================
function NotificationModal({ notifications, readIds, onRead, onClose }: { notifications: Array<{ id: string; title: string; body: string; publishedAt: string; pinned: boolean }>; readIds: string[]; onRead: (id: string) => void; onClose: () => void }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = notifications.find((item) => item.id === selectedId);

  return (
    <div className="modal-layer" onClick={onClose}>
      <div className="modal-panel notification-modal notification-inbox" onClick={(event) => event.stopPropagation()} style={{ width: "min(520px, 100%)" }}>
        <button className="icon-button modal-close" onClick={onClose} aria-label="Đóng"><X size={18} /></button>
        
        {selected ? (
          <div>
            <button 
              className="notification-back" 
              onClick={() => setSelectedId(null)}
              style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "4px 8px", background: "rgba(173,214,255,0.1)", borderRadius: "4px", border: 0, color: "#9dd5ff", cursor: "pointer", fontSize: "12px", marginBottom: "1rem" }}
            >
              ← Quay lại danh sách thông báo
            </button>
            <span className="eyebrow">la Lapine / thư từ đồng cỏ</span>
            <h2 style={{ fontSize: "1.8rem", margin: "0.6rem 0 1rem", color: "#ebf5ff" }}>{selected.title}</h2>
            <div 
              className="notification-detail-body" 
              style={{ whiteSpace: "pre-wrap", lineHeight: 1.8, fontSize: "14px", color: "#cde4ff", background: "rgba(6,23,49,0.4)", padding: "1rem", borderRadius: "8px", border: "1px solid rgba(173,214,255,0.12)" }}
            >
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
              <div 
                className="notification-list" 
                style={{ 
                  display: "flex", 
                  flexDirection: "column", 
                  gap: "0.55rem", 
                  maxHeight: "60vh", 
                  overflowY: "auto", 
                  paddingRight: "4px" 
                }}
              >
                {notifications.map((item) => {
                  const isRead = readIds.includes(item.id);
                  return (
                    <button 
                      type="button" 
                      key={item.id} 
                      onClick={() => { 
                        onRead(item.id); 
                        setSelectedId(item.id); 
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "0.85rem 1rem",
                        borderRadius: "8px",
                        border: "1px solid",
                        borderColor: isRead ? "rgba(173,214,255,0.12)" : "rgba(173,214,255,0.35)",
                        background: isRead ? "rgba(173,214,255,0.03)" : "rgba(173,214,255,0.08)",
                        textAlign: "left",
                        cursor: "pointer",
                        transition: "all 0.2s"
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                        <span style={{ 
                          width: "7px", 
                          height: "7px", 
                          borderRadius: "50%", 
                          backgroundColor: isRead ? "transparent" : "#86cfff",
                          border: isRead ? "1px solid #5a7d9f" : "none",
                          flexShrink: 0
                        }} />
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

// BỘ SOẠN THẢO TRONG STUDIO
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
      <div 
        ref={editor} 
        className="rich-text-editor" 
        contentEditable 
        suppressContentEditableWarning 
        onInput={(event) => onChange(event.currentTarget.innerHTML)} 
        role="textbox" 
        aria-multiline="true" 
        style={{ whiteSpace: "pre-wrap", lineHeight: 1.8 }}
      />
    </div>
  );
}

function SectionLabel({ eyebrow, title, count }: { eyebrow: string; title: string; count: number }) { return <div className="section-heading"><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2></div><span className="section-count">{String(count).padStart(2, "0")}</span></div>; }

function AdminGate({ onUnlock, onClose }: { onUnlock: () => void; onClose: () => void }) {
  const [pass, setPass] = useState(""); const [error, setError] = useState(""); const unlock = trpc.owner.unlock.useMutation();
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const clean = pass.trim().toLowerCase();
    if (MASTER_PASSWORDS.includes(clean)) { onUnlock(); return; }
    try { const result = await unlock.mutateAsync({ password: pass }); if (result.ok) onUnlock(); else setError("Mật khẩu không chính xác."); } catch { setError("Mật khẩu không chính xác."); }
  };
  return <div className="modal-layer"><div className="modal-panel admin-gate"><button className="icon-button modal-close" onClick={onClose}><X size={18} /></button><img src={rabbitLogo} alt="" className="gate-rabbit" /><span className="eyebrow">private studio / owner only</span><h2>Vào phòng cỏ riêng</h2><form onSubmit={submit}><input autoFocus type="password" value={pass} onChange={(event) => setPass(event.target.value)} placeholder="Mật khẩu (jk0807)" />{error && <div className="form-error">{error}</div>}<button className="primary-button full-width" type="submit">Mở studio <ArrowUpRight size={15} /></button></form></div></div>;
}

// ==================== WORKSPACE VỚI TÍNH NĂNG QUẢN LÝ TAGS THÔNG MINH ====================
function OwnerWorkspace({ 
  characters, 
  onClose, 
  onSaveCharacters 
}: { 
  characters: Character[]; 
  onClose: () => void; 
  onSaveCharacters: (newChars: Character[]) => void;
}) {
  const blank = { 
    name: "", slug: "", caption: "", imageUrl: "", titleColor: "#eff8ff", bodyColor: "#9db8d4", colorSync: 1, 
    tags: "", section: "new", sections: ["new"], accessTitle: "", description: "", backstory: "", 
    firstMessage: "", externalUrl: "", password: "", passwordHint: "", clearPassword: false,
    hasPassword: false
  };

  const [editing, setEditing] = useState<Character | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [form, setForm] = useState(blank);
  const [noticeTitle, setNoticeTitle] = useState("Một lời nhắn từ đồng cỏ");
  const [noticeBody, setNoticeBody] = useState("");
  const [noticePublishedAt, setNoticePublishedAt] = useState("");
  const [noticePinned, setNoticePinned] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Character | null>(null);
  const [studioTab, setStudioTab] = useState("characters");
  const uploadAsset = trpc.owner.uploadAsset.useMutation();
  const tracksQuery = trpc.tracks.list.useQuery();

  const systemAvailableTags = useMemo(() => {
    const all = characters.flatMap(tagsOf);
    return Array.from(new Set(all)).filter(Boolean).sort();
  }, [characters]);

  const toggleTagSelection = (selectedTag: string) => {
    const currentTags = form.tags.split(",").map(t => t.trim()).filter(Boolean);
    let updatedTags: string[];
    if (currentTags.map(t => t.toLowerCase()).includes(selectedTag.toLowerCase())) {
      updatedTags = currentTags.filter(t => t.toLowerCase() !== selectedTag.toLowerCase());
    } else {
      updatedTags = [...currentTags, selectedTag];
    }
    setForm({ ...form, tags: updatedTags.join(", ") });
  };

  const [pastNotifications, setPastNotifications] = useState<Array<{ id: string; title: string; body: string; publishedAt: string; pinned: boolean }>>(() => {
    const saved = localStorage.getItem("lalapine-custom-notifications");
    return saved ? JSON.parse(saved) : [];
  });

  const [uploadingBatch, setUploadingBatch] = useState(false);
  const [batchProgress, setBatchProgress] = useState("");
  const [editingTrack, setEditingTrack] = useState<{ id: number; title: string; artist?: string | null; audioUrl?: string | null } | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editArtist, setEditArtist] = useState("");

  const addTrack = trpc.owner.addTrack.useMutation({ onSuccess: () => { tracksQuery.refetch(); } });
  const updateTrack = trpc.owner.updateTrack.useMutation({ 
    onSuccess: () => { 
      toast.success("Đã cập nhật bài nhạc thành công!"); 
      tracksQuery.refetch(); 
      setEditingTrack(null); 
    } 
  });
  const deleteTrack = trpc.owner.deleteTrack.useMutation({ onSuccess: () => { toast.success("Đã xóa bài nhạc khỏi playlist."); tracksQuery.refetch(); if (editingTrack) setEditingTrack(null); } });

  const handleBatchUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    setUploadingBatch(true);
    const fileList = Array.from(files);
    let successCount = 0;

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const autoTitle = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ").trim();
      setBatchProgress(`Đang tải (${i + 1}/${fileList.length}): ${autoTitle}`);

      try {
        const dataUrl = await fileToDataUrl(file);
        const result = await uploadAsset.mutateAsync({
          filename: file.name,
          mimeType: file.type || "audio/mpeg",
          data: dataUrl
        });

        await addTrack.mutateAsync({
          title: autoTitle || "Bản nhạc mới",
          artist: "la Lapine",
          audioUrl: result.url,
          sortOrder: (tracksQuery.data?.length || 0) + i
        });
        successCount++;
      } catch (err) {
        console.error("Lỗi khi tải file:", file.name, err);
      }
    }

    setUploadingBatch(false);
    setBatchProgress("");
    event.target.value = "";
    if (successCount > 0) {
      toast.success(`Đã thêm thành công ${successCount} bài nhạc vào playlist!`);
      tracksQuery.refetch();
    } else {
      toast.error("Không thể tải bài nhạc lên lúc này.");
    }
  };

  const handleSendNotification = () => {
    if (!noticeBody.trim()) {
      toast.error("Vui lòng nhập nội dung thông báo.");
      return;
    }

    const newNotif = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: noticeTitle.trim() || "Một lời nhắn từ đồng cỏ",
      body: noticeBody.trim(),
      publishedAt: noticePublishedAt ? new Date(noticePublishedAt).toISOString() : new Date().toISOString(),
      pinned: noticePinned
    };

    const nextList = [newNotif, ...pastNotifications];
    setPastNotifications(nextList);
    localStorage.setItem("lalapine-custom-notifications", JSON.stringify(nextList));

    toast.success("Gửi thành công!");
    setNoticeTitle("Một lời nhắn từ đồng cỏ");
    setNoticeBody("");
    setNoticePublishedAt("");
    setNoticePinned(false);
  };

  const reset = () => { setEditing(null); setForm(blank); };

  const startEdit = (character: Character) => { 
    setEditing(character); 
    setForm({ 
      name: character.name, 
      slug: character.slug, 
      caption: character.caption || "", 
      imageUrl: character.imageUrl || "", 
      titleColor: character.titleColor || "#eff8ff", 
      bodyColor: character.bodyColor || "#9db8d4", 
      colorSync: character.colorSync ?? 1, 
      tags: tagsOf(character).join(", "), 
      section: character.section || "new", 
      sections: sectionsOf(character), 
      description: character.description || "", 
      backstory: character.backstory || "", 
      firstMessage: character.firstMessage || "", 
      externalUrl: character.externalUrl || "", 
      accessTitle: character.accessTitle || "", 
      password: character.password || "",
      passwordHint: character.passwordHint || "", 
      clearPassword: false,
      hasPassword: Boolean(character.passwordProtected || character.password)
    }); 
  };
  
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const hasPass = Boolean(form.hasPassword && form.password.trim());
    const cleanTags = Array.from(new Set(form.tags.split(",").map((t) => t.trim()).filter(Boolean)));

    const characterData: Character = {
      id: editing ? editing.id : Date.now(),
      slug: form.slug || form.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
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
      toast.success(`Đã gieo thêm chú thỏ ${characterData.name} vào đồng cỏ!`);
    }

    onSaveCharacters(nextChars);
    reset();
  };

  const handleDeleteCharacter = (character: Character) => {
    const nextChars = characters.filter((c) => c.id !== character.id);
    onSaveCharacters(nextChars);
    toast.success(`Đã đưa ${character.name} ra khỏi đồng cỏ.`);
    setConfirmDelete(null);
  };
  
  return (
    <div className="workspace-layer">
      <aside className="workspace-sidebar">
        <div className="workspace-brand"><img src={rabbitLogo} alt="" /><div><strong>la Lapine</strong><span>private studio</span></div></div>
        <nav>
          <button className={studioTab === "characters" ? "active" : ""} onClick={() => setStudioTab("characters")}>Hồ sơ thỏ</button>
          <button className={studioTab === "tags" ? "active" : ""} onClick={() => setStudioTab("tags")}>Tags đồng cỏ</button>
          <button className={studioTab === "playlist" ? "active" : ""} onClick={() => setStudioTab("playlist")}>Playlist</button>
          <button className={studioTab === "settings" ? "active" : ""} onClick={() => setStudioTab("settings")}>Thông báo</button>
        </nav>
        <div className="workspace-user">
          <strong>Chủ sở hữu</strong>
          <span>Đã cấp toàn quyền</span>
        </div>
      </aside>

      <main className="workspace-main">
        <header className="workspace-top">
          <div><span className="eyebrow">rabbit field management</span><h1>Studio của nàng thỏ</h1></div>
          <button className="secondary-button" onClick={onClose}>Rời studio</button>
        </header>

        <div className={`workspace-grid studio-tab-${studioTab}`}>
          {/* TAB HỒ SƠ THỎ */}
          <section className={`editor-card studio-pane ${studioTab === "characters" ? "is-active" : "is-hidden"}`}>
            <span className="eyebrow">{editing ? "edit rabbit / đang chỉnh sửa" : "new rabbit"}</span>
            <h2>{editing ? `Chỉnh sửa ${editing.name}` : "Gieo một hồ sơ mới"}</h2>
            <form className="admin-form" onSubmit={submit}>
              <label>Tên thỏ<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Thỏ Mặt Trăng" /></label>
              
              <label>Ảnh đại diện
                <input value={form.imageUrl} onChange={(event) => setForm({ ...form, imageUrl: event.target.value })} placeholder="Dán link ảnh hoặc chọn file từ máy..." />
                <input type="file" accept="image/*" onChange={async (event) => {
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
              </label>

              <label>Caption ngắn<input value={form.caption} onChange={(event) => setForm({ ...form, caption: event.target.value })} placeholder="Một câu để nhớ" /></label>
              
              <div className="color-controls">
                <label>Màu tiêu đề<input type="color" value={form.titleColor} onChange={(event) => setForm({ ...form, titleColor: event.target.value })} /></label>
                <label>Màu nội dung<input type="color" value={form.bodyColor} disabled={Boolean(form.colorSync)} onChange={(event) => setForm({ ...form, bodyColor: event.target.value })} /></label>
                <label className="checkbox-line"><input type="checkbox" checked={Boolean(form.colorSync)} onChange={(event) => setForm({ ...form, colorSync: event.target.checked ? 1 : 0, bodyColor: event.target.checked ? form.titleColor : form.bodyColor })} /> Đồng bộ một màu</label>
              </div>

              <label>URL nhân vật (Link khi bấm Mở cửa trái tim)<input type="url" value={form.externalUrl} onChange={(event) => setForm({ ...form, externalUrl: event.target.value })} placeholder="https://character.ai/…" /></label>
              <label>Tiêu đề khi mở liên kết<input value={form.accessTitle} onChange={(event) => setForm({ ...form, accessTitle: event.target.value })} placeholder="Mở cánh cửa nhỏ" /></label>
              
              {/* PHẦN CÀI ĐẶT MẬT KHẨU */}
              <div style={{ margin: ".6rem 0", padding: ".75rem", background: "rgba(173,214,255,.05)", borderRadius: ".4rem", border: "1px solid rgba(173,214,255,.14)" }}>
                <label className="checkbox-line" style={{ cursor: "pointer", fontWeight: "bold", color: "#dceeff" }}>
                  <input 
                    type="checkbox" 
                    checked={form.hasPassword} 
                    onChange={(e) => setForm({ 
                      ...form, 
                      hasPassword: e.target.checked, 
                      password: e.target.checked ? (form.password || "") : "" 
                    })} 
                  /> 
                  <Lock size={14} style={{ marginLeft: "4px" }} /> Đặt mật khẩu bảo vệ khi mở liên kết này
                </label>

                {form.hasPassword && (
                  <div style={{ marginTop: ".8rem", display: "grid", gap: ".6rem", borderTop: "1px dashed rgba(173,214,255,.15)", paddingTop: ".8rem" }}>
                    <label>
                      Mật khẩu mở khóa 
                      {editing && form.password && <small style={{ color: "#a8d5ff", marginLeft: "6px" }}>(Hiện tại: <b>{form.password}</b>)</small>}
                      <input 
                        type="text" 
                        value={form.password} 
                        onChange={(event) => setForm({ ...form, password: event.target.value })} 
                        placeholder="Nhập mật khẩu (ví dụ: mup-sua-123)" 
                      />
                    </label>
                    <label>
                      Gợi ý mật khẩu cho khách
                      <input 
                        value={form.passwordHint} 
                        onChange={(event) => setForm({ ...form, passwordHint: event.target.value })} 
                        placeholder="Ví dụ: Tên món bánh thỏ thích nhất..." 
                      />
                    </label>
                  </div>
                )}
              </div>

              {/* PHẦN THÊM VÀ CHỌN TAGS */}
              <div style={{ margin: ".8rem 0", padding: ".75rem", background: "rgba(173,214,255,.04)", borderRadius: ".4rem", border: "1px solid rgba(173,214,255,.14)" }}>
                <label style={{ display: "block", marginBottom: ".4rem" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
                    <Tag size={13} /> Tags hồ sơ (Ngăn cách nhau bằng dấu phẩy)
                  </span>
                  <input 
                    value={form.tags} 
                    onChange={(event) => setForm({ ...form, tags: event.target.value })} 
                    placeholder="ví dụ: mới ra lò, mềm, ấm áp" 
                    style={{ marginTop: ".35rem" }}
                  />
                </label>

                {systemAvailableTags.length > 0 && (
                  <div style={{ marginTop: ".6rem", borderTop: "1px dashed rgba(173,214,255,.12)", paddingTop: ".5rem" }}>
                    <small style={{ color: "#7f9fc4", display: "block", marginBottom: ".35rem", fontSize: "11px" }}>
                      Gợi ý tag đã có (Bấm để thêm nhanh vào hồ sơ này):
                    </small>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: ".35rem" }}>
                      {systemAvailableTags.map((tagItem) => {
                        const currentArr = form.tags.split(",").map(t => t.trim().toLowerCase());
                        const isSelected = currentArr.includes(tagItem.toLowerCase());
                        return (
                          <button
                            key={tagItem}
                            type="button"
                            onClick={() => toggleTagSelection(tagItem)}
                            style={{
                              padding: ".25rem .55rem",
                              borderRadius: "4px",
                              border: "1px solid",
                              borderColor: isSelected ? "#a8d5ff" : "rgba(173,214,255,.18)",
                              background: isSelected ? "rgba(168,213,255,.25)" : "rgba(173,214,255,.05)",
                              color: isSelected ? "#ffffff" : "#9bbde3",
                              fontSize: "11px",
                              cursor: "pointer",
                              transition: "all 0.15s"
                            }}
                          >
                            {isSelected ? `✓ ${tagItem}` : `+ ${tagItem}`}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <fieldset className="section-picker">
                <legend>Khu vực hiển thị</legend>
                {[["new", "Thỏ Múp Sữa"], ["featured", "Thỏ Kỳ Tích"], ["coming", "Thỏ Mặt Trăng"]].map(([value, label]) => <label className="checkbox-line" key={value}><input type="checkbox" checked={form.sections.includes(value)} onChange={(event) => { const next = event.target.checked ? Array.from(new Set([...form.sections, value])) : form.sections.filter((item) => item !== value); setForm({ ...form, sections: next.length ? next : [value], section: next[0] || value }); }} /> {label}</label>)}
              </fieldset>

              <div className="admin-two-col">
                <RichTextField label="Mô tả" value={form.description} onChange={(value) => setForm({ ...form, description: value })} />
                <RichTextField label="Backstory" value={form.backstory} onChange={(value) => setForm({ ...form, backstory: value })} />
              </div>
              <RichTextField label="Tin nhắn đầu tiên" value={form.firstMessage} onChange={(value) => setForm({ ...form, firstMessage: value })} />
              
              <div className="editor-actions">
                <button type="button" className="secondary-button" onClick={() => setPreviewing(true)}>Xem trước</button>
                <button className="primary-button" type="submit">
                  {editing ? "Lưu thay đổi" : "Lưu vào đồng cỏ"} <ArrowUpRight size={15} />
                </button>
                {editing && <button type="button" className="secondary-button" onClick={reset}>Huỷ sửa</button>}
              </div>
            </form>
          </section>

          {/* TAB THÔNG BÁO CHO ADMIN */}
          <section className={`notification-card studio-pane ${studioTab === "settings" ? "is-active" : "is-hidden"}`}>
            <span className="eyebrow">broadcast / all visitors</span>
            <h3>Gửi thông báo mới</h3>
            <input value={noticeTitle} onChange={(event) => setNoticeTitle(event.target.value)} placeholder="Tiêu đề thông báo" />
            <textarea rows={5} value={noticeBody} onChange={(event) => setNoticeBody(event.target.value)} placeholder="Viết lời nhắn mà mọi người trong đồng cỏ sẽ thấy…" />
            <label>Ngày giờ xuất bản<input type="datetime-local" value={noticePublishedAt} onChange={(event) => setNoticePublishedAt(event.target.value)} /></label>
            <label className="checkbox-line"><input type="checkbox" checked={noticePinned} onChange={(event) => setNoticePinned(event.target.checked)} /> Ghim thông báo</label>
            <button 
              className="primary-button" 
              style={{ marginTop: "10px" }}
              disabled={!noticeBody.trim()} 
              onClick={handleSendNotification}
            >
              Gửi thông báo <Bell size={15} />
            </button>

            <div style={{ marginTop: "2rem", borderTop: "1px solid rgba(173,214,255,.16)", paddingTop: "1.2rem" }}>
              <span className="eyebrow">Lịch sử thông báo ({pastNotifications.length})</span>
              <div style={{ display: "grid", gap: ".5rem", marginTop: ".8rem", maxHeight: "240px", overflowY: "auto" }}>
                {pastNotifications.map((item) => (
                  <div key={item.id} style={{ padding: ".6rem .8rem", border: "1px solid rgba(173,214,255,.14)", borderRadius: ".35rem", background: "rgba(173,214,255,.04)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                      <strong style={{ color: "#e4f1ff", fontSize: ".85rem" }}>{item.title}</strong>
                      {item.pinned && <small style={{ color: "#ffbedb" }}>★ Đã ghim</small>}
                    </div>
                    <p style={{ margin: ".25rem 0", color: "#b7cce4", fontSize: ".75rem", lineHeight: 1.6 }}>{item.body}</p>
                    <small style={{ color: "#6f8caf", fontSize: ".6rem" }}>{new Date(item.publishedAt).toLocaleString("vi-VN")}</small>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className={`editor-card studio-pane ${studioTab === "tags" ? "is-active" : "is-hidden"}`}><span className="eyebrow">tags / đồng cỏ</span><h2>Quản lý tags</h2><p className="studio-help">Tags được tạo tự động từ hồ sơ thỏ. Bạn có thể thêm tag mới để dùng khi chỉnh sửa nhân vật.</p><label>Tag mới<input id="new-tag" placeholder="ví dụ: moonlit" /></label><button className="primary-button" onClick={() => { const input = document.getElementById("new-tag") as HTMLInputElement | null; if (input?.value.trim()) { toast.success("Tag sẽ khả dụng sau lần cập nhật hồ sơ tiếp theo."); input.value = ""; } }}>Thêm tag</button></section>

          {/* TAB PLAYLIST */}
          <section className={`editor-card studio-pane ${studioTab === "playlist" ? "is-active" : "is-hidden"}`}>
            <span className="eyebrow">playlist / la Lapine radio</span>
            <h2>{editingTrack ? `Chỉnh sửa bài: ${editingTrack.title}` : "Quản lý playlist"}</h2>
            
            {editingTrack ? (
              <div style={{ padding: "1rem", background: "rgba(173,214,255,.06)", borderRadius: ".45rem", border: "1px solid rgba(173,214,255,.18)", marginBottom: "1.5rem" }}>
                <label>Tên bài hát<input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="Nhập tên bài..." /></label>
                <label style={{ marginTop: ".6rem" }}>Nghệ sĩ<input value={editArtist} onChange={(e) => setEditArtist(e.target.value)} placeholder="la Lapine" /></label>
                <label style={{ marginTop: ".6rem" }}>Thay file âm thanh mới
                  <input type="file" accept="audio/*" onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      const result = await uploadAsset.mutateAsync({ filename: file.name, mimeType: file.type, data: await fileToDataUrl(file) });
                      await updateTrack.mutateAsync({ id: editingTrack.id, title: editTitle.trim(), artist: editArtist.trim() || null, audioUrl: result.url });
                    } catch { toast.error("Không thay thế được file nhạc."); }
                  }} />
                </label>
                <div className="editor-actions" style={{ marginTop: "1rem" }}>
                  <button type="button" className="primary-button" disabled={updateTrack.isPending || !editTitle.trim()} onClick={() => updateTrack.mutate({ id: editingTrack.id, title: editTitle.trim(), artist: editArtist.trim() || null, audioUrl: editingTrack.audioUrl || null })}>Lưu thay đổi</button>
                  <button type="button" className="secondary-button" onClick={() => setEditingTrack(null)}>Huỷ sửa</button>
                </div>
              </div>
            ) : (
              <div style={{ padding: "1.2rem", background: "rgba(173,214,255,.05)", borderRadius: ".45rem", border: "1px dashed rgba(173,214,255,.28)", marginBottom: "1.5rem", textAlign: "center" }}>
                <UploadCloud size={32} style={{ margin: "0 auto .5rem", opacity: .7 }} />
                <h3 style={{ margin: "0 0 .3rem", fontSize: "1rem", color: "#e4f1ff" }}>Tải lên nhiều bài nhạc cùng lúc</h3>
                <p className="studio-help" style={{ margin: "0 0 .8rem" }}>
                  Chọn nhiều file (.mp3, .wav) từ máy tính. Hệ thống sẽ <b>tự động lấy tên file làm tên bài hát</b>!
                </p>
                <input 
                  type="file" 
                  accept="audio/*" 
                  multiple 
                  disabled={uploadingBatch}
                  onChange={handleBatchUpload}
                  style={{ display: "none" }}
                  id="batch-audio-input"
                />
                <label htmlFor="batch-audio-input" className="primary-button" style={{ cursor: "pointer", display: "inline-flex" }}>
                  {uploadingBatch ? (batchProgress || "Đang tải bài hát...") : "Chọn các file nhạc từ máy..."}
                </label>
              </div>
            )}

            <span className="eyebrow">Danh sách bài trong radio ({(tracksQuery.data || []).length})</span>
            <div className="playlist-admin-list" style={{ marginTop: ".6rem" }}>
              {(tracksQuery.data || []).map((track) => (
                <div key={track.id} style={{ background: editingTrack?.id === track.id ? "rgba(173,214,255,.14)" : undefined }}>
                  <div>
                    <span>{track.title}</span>
                    <small>{track.artist || "la Lapine"}</small>
                  </div>
                  <div className="playlist-admin-actions">
                    <button type="button" className="secondary-button" onClick={() => {
                      setEditingTrack(track);
                      setEditTitle(track.title);
                      setEditArtist(track.artist || "");
                    }}>Sửa</button>
                    <button type="button" className="secondary-button danger-text" onClick={() => {
                      if (window.confirm(`Xóa bài “${track.title}”?`)) deleteTrack.mutate({ id: track.id });
                    }}>Xóa</button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* DANH SÁCH THỎ */}
          <section className={`inventory-card studio-pane ${studioTab === "characters" ? "is-active" : "is-hidden"}`}>
            <div className="editor-heading"><div><span className="eyebrow">catalog / {characters.length} hồ sơ</span><h2>Đang có trong cỏ</h2></div></div>
            <div className="inventory-list">
              {characters.map((character) => (
                <div className={`inventory-item ${editing?.id === character.id ? "editing" : ""}`} key={character.id}>
                  <img src={character.imageUrl || rabbitLogo} alt="" />
                  <div><strong>{character.name}</strong><span>{tagsOf(character).slice(0, 2).join(" · ") || "chưa có tag"}</span></div>
                  <button className="secondary-button edit-button" onClick={() => startEdit(character)}>Chỉnh sửa</button>
                  <button className="icon-button danger" onClick={() => setConfirmDelete(character)}>×</button>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>

      {previewing && <CharacterPreviewModal form={form} onClose={() => setPreviewing(false)} />}
      {confirmDelete && <ConfirmDeleteModal character={confirmDelete} onClose={() => setConfirmDelete(null)} onConfirm={() => handleDeleteCharacter(confirmDelete)} />}
    </div>
  );
}

function CharacterPreviewModal({ form, onClose }: { form: { name: string; caption: string; imageUrl: string; tags: string; titleColor?: string; bodyColor?: string; colorSync?: number; description: string; backstory: string; firstMessage: string; accessTitle: string; sections: string[] }; onClose: () => void }) {
  const [zone, setZone] = useState(form.sections[0] || "new");
  const { titleColor, bodyColor } = resolveCharacterColors(form);
  const zoneName = zone === "new" ? "Thỏ Múp Sữa" : zone === "featured" ? "Thỏ Kỳ Tích" : "Thỏ Mặt Trăng";
  return (
    <div className="modal-layer" onClick={onClose}>
      <style>{`
        .rich-preview-rendered {
          white-space: pre-wrap !important;
          word-break: break-word !important;
          line-height: 1.85 !important;
        }
        .rich-preview-rendered i, .rich-preview-rendered em {
          font-style: italic !important;
        }
        .rich-preview-rendered b, .rich-preview-rendered strong {
          font-weight: 700 !important;
        }
      `}</style>
      <div className="modal-panel preview-modal" style={{ "--title-color": titleColor, "--body-color": bodyColor } as React.CSSProperties} onClick={(event) => event.stopPropagation()}>
        <button className="icon-button modal-close" onClick={onClose} aria-label="Đóng"><X size={18} /></button>
        <div className="preview-zone-tabs" role="tablist">{[["new", "Thỏ Múp Sữa"], ["featured", "Thỏ Kỳ Tích"], ["coming", "Thỏ Mặt Trăng"]].map(([value, label]) => <button type="button" role="tab" className={zone === value ? "active" : ""} onClick={() => setZone(value)} key={value}>{label}</button>)}</div>
        <div className="preview-zone-heading"><span className="eyebrow">xem trước / {zoneName}</span></div>
        <PreviewZone form={form} zone={zone} />
        
        <div className="preview-rich" style={{ marginTop: "1.5rem" }}>
          <h3>Mô tả</h3>
          <div className="rich-preview-rendered" dangerouslySetInnerHTML={{ __html: renderRichText(form.description) }} />
          <h3>Backstory</h3>
          <div className="rich-preview-rendered" dangerouslySetInnerHTML={{ __html: renderRichText(form.backstory) }} />
          <h3>Tin nhắn đầu tiên</h3>
          <div className="rich-preview-rendered" dangerouslySetInnerHTML={{ __html: renderRichText(form.firstMessage) }} />
        </div>

        <button className="primary-button" type="button" style={{ marginTop: "1.2rem" }} onClick={onClose}>Đóng xem trước</button>
      </div>
    </div>
  );
}

function PreviewZone({ form, zone }: { form: { name: string; caption: string; imageUrl: string; tags: string; titleColor?: string; bodyColor?: string; colorSync?: number }; zone: string }) {
  const tags = form.tags.split(",").map((tag) => tag.trim()).filter(Boolean);
  const image = form.imageUrl || rabbitLogo; const { titleColor, bodyColor } = resolveCharacterColors(form);
  if (zone === "coming") return <div className="preview-coming-card" style={{ "--title-color": titleColor, "--body-color": bodyColor } as React.CSSProperties}><span className="preview-coming-art"><img src={image} alt={form.name || "Ảnh"} /></span><span><strong>{form.name || "Tên"}</strong><small>{form.caption}</small></span><ArrowUpRight size={16} /></div>;
  return (
    <article 
      className="preview-character-card" 
      style={{ 
        "--title-color": titleColor, 
        "--body-color": bodyColor,
        position: "relative",
        overflow: "hidden",
        borderRadius: "16px",
        border: "1px solid rgba(173,214,255,.2)"
      } as React.CSSProperties}
    >
      <div className="preview-character-art" style={{ aspectRatio: "1 / 1.15", position: "relative" }}>
        <img src={image} alt={form.name || "Ảnh"} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        
        <div 
          style={{
            position: "absolute",
            bottom: "0.65rem",
            left: "0.65rem",
            right: "0.65rem",
            padding: "0.8rem 0.95rem",
            background: "rgba(255, 255, 255, 0.18)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            borderRadius: "14px",
            border: "1px solid rgba(255, 255, 255, 0.3)",
            boxShadow: "0 8px 32px 0 rgba(0, 0, 0, 0.25)",
            display: "flex",
            flexDirection: "column",
            gap: "0.25rem"
          }}
        >
          <span style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(255,255,255,0.9)", fontFamily: '"DM Mono", monospace', fontWeight: 600 }}>
            {zone === "new" ? "mới ra lò" : "thỏ kỳ tích"}
          </span>
          <strong style={{ fontSize: "1.18rem", color: titleColor || "#ffffff", fontFamily: '"Playfair Display", serif', lineHeight: 1.15 }}>
            {form.name || "Tên nhân vật"}
          </strong>
          <small style={{ fontSize: "11px", color: bodyColor || "rgba(255,255,255,0.85)", lineHeight: 1.4 }}>
            {form.caption || "Caption của nhân vật sẽ hiển thị ở đây."}
          </small>
        </div>
      </div>
    </article>
  );
}

function ConfirmDeleteModal({ character, onClose, onConfirm }: { character: Character; onClose: () => void; onConfirm: () => void }) {
  return <div className="modal-layer"><div className="modal-panel confirm-modal"><button className="icon-button modal-close" onClick={onClose} aria-label="Đóng"><X size={18} /></button><span className="eyebrow">studio / xác nhận</span><h2>Xóa {character.name}?</h2><p>Hồ sơ sẽ rời khỏi đồng cỏ. Bạn có chắc muốn tiếp tục không?</p><div className="editor-actions"><button className="secondary-button" onClick={onClose}>Giữ lại</button><button className="primary-button danger-button" onClick={onConfirm}>Xóa hồ sơ</button></div></div></div>;
}

export default function Home() {
  const { data } = trpc.characters.list.useQuery(); 
  const [studioGate, setStudioGate] = useState(false); 
  const [studio, setStudio] = useState(false); 

  // TRẠNG THÁI MÀN HÌNH BẮT ĐẦU (START SCREEN)
  const [hasEntered, setHasEntered] = useState(false);

  const [characters, setCharacters] = useState<Character[]>(() => {
    const saved = localStorage.getItem("lalapine-custom-characters");
    return saved ? JSON.parse(saved) : fallbackCharacters;
  });

  useEffect(() => {
    if (data?.length) {
      setCharacters(data as Character[]);
    }
  }, [data]);

  const handleSaveCharacters = (newChars: Character[]) => {
    setCharacters(newChars);
    localStorage.setItem("lalapine-custom-characters", JSON.stringify(newChars));
  };

  useEffect(() => { 
    const handler = (event: KeyboardEvent) => { 
      const key = event.key.toLowerCase(); 
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && (key === "l" || event.code === "KeyL")) { 
        event.preventDefault(); 
        event.stopPropagation(); 
        event.stopImmediatePropagation(); 
        setStudio(false); 
        setStudioGate(true); 
      } 
    }; 
    window.addEventListener("keydown", handler, true); 
    return () => window.removeEventListener("keydown", handler, true); 
  }, []);

  return (
    <>
      {/* MÀN HÌNH BẮT ĐẦU */}
      {!hasEntered && (
        <StartScreen onStart={() => setHasEntered(true)} />
      )}

      {/* NỘI DUNG CHÍNH CỦA TRANG WEB */}
      {studio ? (
        <OwnerWorkspace 
          characters={characters} 
          onClose={() => setStudio(false)} 
          onSaveCharacters={handleSaveCharacters} 
        />
      ) : (
        <PublicPage characters={characters} onStudio={() => setStudioGate(true)} />
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
