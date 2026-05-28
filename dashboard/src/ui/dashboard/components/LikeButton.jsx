import React, { useState, useEffect, useRef } from "react";
import { Heart } from "lucide-react";
import { copy } from "../../../lib/copy";
import { getProfileLikes, bumpProfileLike } from "../../../lib/api";

const STORAGE_KEY = "tokentracker_likes";

function readLocalLiked(userId) {
  if (!userId) return false;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return Boolean(parsed?.[userId]);
  } catch {
    return false;
  }
}

function writeLocalLiked(userId, liked) {
  if (!userId) return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    if (liked) parsed[userId] = true;
    else delete parsed[userId];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
  } catch {
    // ignore
  }
}

export function LikeButton({ userId }) {
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState(false);
  const [isPopping, setIsPopping] = useState(false);
  const [particles, setParticles] = useState([]);
  const [triggerNumAnim, setTriggerNumAnim] = useState(false);

  const particleIdRef = useRef(0);

  useEffect(() => {
    // Effect-local cancellation: a fresh `cancelled` per mount avoids the
    // shared-ref race where a new effect resets the flag to false before an
    // in-flight previous fetch resolves into the new user's state.
    let cancelled = false;
    if (!userId) {
      setReady(false);
      return () => {
        cancelled = true;
      };
    }
    setReady(false);
    setIsLiked(readLocalLiked(userId));
    getProfileLikes({ userId })
      .then((res) => {
        if (cancelled) return;
        setLikesCount(Number(res?.count) || 0);
        setReady(true);
      })
      .catch(() => {
        if (cancelled) return;
        setLikesCount(0);
        setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const triggerExplosion = () => {
    setIsPopping(true);
    setTimeout(() => setIsPopping(false), 450);
    setTriggerNumAnim(true);
    setTimeout(() => setTriggerNumAnim(false), 500);

    const colors = ["#ff4757", "#ff6b81", "#ffa502", "#70a1ff", "#2ed573", "#a29bfe"];
    const shapes = ["circle", "heart"];
    const newParticles = [];
    for (let i = 0; i < 12; i++) {
      const angle = (i * 30 + Math.random() * 20 - 10) * (Math.PI / 180);
      const distance = 45 + Math.random() * 45;
      const tx = Math.cos(angle) * distance;
      const ty = Math.sin(angle) * distance - (10 + Math.random() * 15);
      const rot = Math.random() * 360 - 180;
      const size = 6 + Math.random() * 8;
      const color = colors[Math.floor(Math.random() * colors.length)];
      const shape = shapes[Math.floor(Math.random() * shapes.length)];
      const id = ++particleIdRef.current;
      newParticles.push({ id, tx, ty, rot, size, color, shape });
    }
    setParticles((prev) => [...prev, ...newParticles]);
    setTimeout(() => {
      setParticles((prev) => prev.filter((p) => !newParticles.find((np) => np.id === p.id)));
    }, 850);
  };

  const sendBump = async (delta) => {
    setPending(true);
    try {
      const res = await bumpProfileLike({ userId, delta });
      const next = Number(res?.count);
      if (Number.isFinite(next)) setLikesCount(next);
    } catch {
      // Rollback optimistic state so retry isn't blocked by a stuck local view.
      setIsLiked((prev) => !prev);
      setLikesCount((prev) => Math.max(0, prev - delta));
      writeLocalLiked(userId, !readLocalLiked(userId));
    } finally {
      setPending(false);
    }
  };

  const handleLikeClick = (e) => {
    e.stopPropagation();
    if (!userId || !ready || pending) return;

    if (isLiked) {
      setIsLiked(false);
      setLikesCount((prev) => Math.max(0, prev - 1));
      writeLocalLiked(userId, false);
      sendBump(-1);
    } else {
      setIsLiked(true);
      setLikesCount((prev) => prev + 1);
      writeLocalLiked(userId, true);
      triggerExplosion();
      sendBump(1);
    }
  };



  return (
    <div className="relative inline-flex items-center select-none z-10">
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes tt-like-pop {
          0% { transform: scale(1); }
          25% { transform: scale(0.75); }
          50% { transform: scale(1.35); }
          75% { transform: scale(0.9); }
          100% { transform: scale(1); }
        }
        @keyframes tt-particle-fly {
          0% {
            transform: translate(0, 0) scale(1) rotate(0deg);
            opacity: 1;
          }
          70% {
            opacity: 0.8;
          }
          100% {
            transform: translate(var(--tx), var(--ty)) scale(0.2) rotate(var(--rot));
            opacity: 0;
          }
        }
        @keyframes tt-num-scroll {
          0% { transform: translateY(8px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
        .tt-animate-pop {
          animation: tt-like-pop 0.45s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
        }
        .tt-particle {
          position: absolute;
          top: 50%;
          left: 50%;
          margin-top: -6px;
          margin-left: -6px;
          pointer-events: none;
          z-index: 50;
        }
        .tt-num-anim {
          animation: tt-num-scroll 0.25s ease-out forwards;
        }
      `}} />

      {particles.map((p) => (
        <span
          key={p.id}
          className="tt-particle"
          style={{
            "--tx": `${p.tx}px`,
            "--ty": `${p.ty}px`,
            "--rot": `${p.rot}deg`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            backgroundColor: p.shape === "circle" ? p.color : "transparent",
            borderRadius: p.shape === "circle" ? "50%" : "0",
            animation: "tt-particle-fly 0.8s cubic-bezier(0.1, 0.8, 0.3, 1) forwards",
          }}
        >
          {p.shape === "heart" && (
            <svg
              viewBox="0 0 24 24"
              width="100%"
              height="100%"
              fill={p.color}
              className="w-full h-full"
            >
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
          )}
        </span>
      ))}

      <button
        type="button"
        onClick={handleLikeClick}
        disabled={!ready || pending}
        aria-label={isLiked ? copy("leaderboard.profile.like.aria_unlike") : copy("leaderboard.profile.like.aria_like")}
        className={`group flex items-center justify-center gap-1.5 h-8 min-w-[48px] px-2.5 rounded-full border transition-all duration-300 outline-none focus-visible:ring-2 focus-visible:ring-rose-500/50 disabled:opacity-60 disabled:cursor-default ${
          isLiked
            ? "bg-rose-50/60 border-rose-200/80 text-rose-500 dark:bg-rose-950/20 dark:border-rose-900/40 dark:text-rose-400 shadow-sm"
            : "bg-white/80 border-oai-gray-200 text-oai-gray-500 hover:border-rose-200 hover:text-rose-500 hover:bg-rose-50/30 dark:bg-oai-gray-950/50 dark:border-white/10 dark:text-oai-gray-400 dark:hover:border-rose-900/50 dark:hover:text-rose-400 dark:hover:bg-rose-950/5"
        }`}


      >
        <span className={isPopping ? "tt-animate-pop" : "group-active:scale-90 transition-transform duration-100"}>
          <Heart
            size={14}
            className={`transition-all duration-300 ${
              isLiked
                ? "fill-rose-500 text-rose-500 dark:fill-rose-400 dark:text-rose-400"
                : "fill-transparent"
            }`}
          />
        </span>

        <span
          className={`text-[12px] font-bold font-mono tabular-nums tracking-tight ${
            isLiked ? "text-rose-600 dark:text-rose-400" : "text-oai-gray-600 dark:text-oai-gray-400"
          } ${triggerNumAnim ? "tt-num-anim" : ""}`}
        >
          {ready ? likesCount : "·"}
        </span>
      </button>

    </div>
  );
}
