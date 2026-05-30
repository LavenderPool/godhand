import { useEffect } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/store/app";

export function SkullOverlay() {
  const open = useAppStore((s) => s.skullOverlayOpen);
  const setOpen = useAppStore((s) => s.setSkullOverlayOpen);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  if (!open) return null;

  return (
    <div
      className="skull-overlay absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={() => setOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-label="Skull greeting"
    >
      <div
        className="skull-overlay-content relative flex flex-col items-center px-6"
        onClick={(e) => e.stopPropagation()}
      >
        <Button
          variant="ghost"
          size="sm"
          className="absolute -top-2 right-0 text-white/70 hover:bg-white/10 hover:text-white"
          onClick={() => setOpen(false)}
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </Button>

        <div className="skull-speech-bubble mb-6 rounded-2xl border border-white/20 bg-card px-6 py-3 text-lg font-semibold tracking-wide shadow-lg">
          привет сучара
        </div>

        <svg
          viewBox="0 0 200 240"
          className="skull-svg h-64 w-64 drop-shadow-2xl sm:h-80 sm:w-80"
          aria-hidden="true"
        >
          <defs>
            <radialGradient id="skullGlow" cx="50%" cy="40%" r="60%">
              <stop offset="0%" stopColor="#f4f4f5" />
              <stop offset="100%" stopColor="#a1a1aa" />
            </radialGradient>
            <filter id="skullShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="4" stdDeviation="6" floodOpacity="0.35" />
            </filter>
          </defs>

          <g filter="url(#skullShadow)">
            {/* Cranium */}
            <ellipse cx="100" cy="95" rx="72" ry="78" fill="url(#skullGlow)" stroke="#71717a" strokeWidth="2" />

            {/* Cheek bones */}
            <path
              d="M 38 120 Q 30 150 45 170 Q 60 185 75 175"
              fill="none"
              stroke="#71717a"
              strokeWidth="2"
            />
            <path
              d="M 162 120 Q 170 150 155 170 Q 140 185 125 175"
              fill="none"
              stroke="#71717a"
              strokeWidth="2"
            />

            {/* Eye sockets */}
            <ellipse cx="72" cy="88" rx="18" ry="22" fill="#18181b" />
            <ellipse cx="128" cy="88" rx="18" ry="22" fill="#18181b" />
            <ellipse cx="68" cy="82" rx="6" ry="4" fill="#27272a" opacity="0.5" />
            <ellipse cx="124" cy="82" rx="6" ry="4" fill="#27272a" opacity="0.5" />

            {/* Nose cavity */}
            <path d="M 100 108 L 92 128 L 108 128 Z" fill="#18181b" />

            {/* Upper teeth row (fixed to cranium) */}
            <g className="skull-upper-teeth">
              {Array.from({ length: 8 }).map((_, i) => (
                <rect
                  key={i}
                  x={78 + i * 5.5}
                  y={138}
                  width="4"
                  height="10"
                  rx="1"
                  fill="#e4e4e7"
                  stroke="#a1a1aa"
                  strokeWidth="0.5"
                />
              ))}
            </g>

            {/* Lower jaw — animated */}
            <g className="skull-jaw" style={{ transformOrigin: "100px 155px" }}>
              <path
                d="M 52 155 Q 55 195 100 205 Q 145 195 148 155 Q 130 165 100 168 Q 70 165 52 155"
                fill="url(#skullGlow)"
                stroke="#71717a"
                strokeWidth="2"
              />
              {Array.from({ length: 8 }).map((_, i) => (
                <rect
                  key={i}
                  x={78 + i * 5.5}
                  y={162}
                  width="4"
                  height="10"
                  rx="1"
                  fill="#e4e4e7"
                  stroke="#a1a1aa"
                  strokeWidth="0.5"
                />
              ))}
            </g>
          </g>
        </svg>
      </div>
    </div>
  );
}
