import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { ArrowUpRight, ChevronDown, Radio } from "lucide-react";
import { cn } from "@/lib/utils";
import { readLocalStorageValue, writeLocalStorageValue } from "@/lib/browser-storage";

const GOCAST_EMBED_URL = "https://gocast.fm/embed/suruur-fm-2?volume=1&mute=1";
const PLAYER_PREFERENCE_KEY = "suruur-radio-player-display";
const PLAYER_POSITION_KEY = "suruur-radio-player-position";
const PLAYER_WIDTH = 376;
const MINIMIZED_VISIBLE_WIDTH = 48;
const MINIMIZED_HEIGHT = 40;
const EXPANDED_HEIGHT = 136;
const EDGE_GUTTER = 8;
const DRAG_THRESHOLD = 5;

type PlayerPosition = { right: number; bottom: number };
type PlayerDrag = {
  pointerId: number;
  startX: number;
  startY: number;
  offsetX: number;
  offsetY: number;
  visibleWidth: number;
  visibleHeight: number;
  moved: boolean;
};

function getPlayerDimensions(expanded: boolean, viewportWidth: number) {
  const width = Math.min(PLAYER_WIDTH, Math.max(0, viewportWidth - 24));
  return {
    width: expanded ? width : Math.min(MINIMIZED_VISIBLE_WIDTH, width),
    height: expanded ? EXPANDED_HEIGHT : MINIMIZED_HEIGHT,
  };
}

function getViewportSize() {
  return {
    width: document.documentElement.clientWidth || window.innerWidth,
    height: document.documentElement.clientHeight || window.innerHeight,
  };
}

function clampPosition(position: PlayerPosition, expanded: boolean): PlayerPosition {
  if (typeof window === "undefined") return position;
  const viewport = getViewportSize();
  const { width, height } = getPlayerDimensions(expanded, viewport.width);
  const maxRight = Math.max(0, viewport.width - width - EDGE_GUTTER);
  const maxBottom = Math.max(0, viewport.height - height - EDGE_GUTTER);
  return {
    right: Math.min(maxRight, Math.max(EDGE_GUTTER, position.right)),
    bottom: Math.min(maxBottom, Math.max(EDGE_GUTTER, position.bottom)),
  };
}

function readInitialPosition(expanded: boolean): PlayerPosition {
  const fallback = {
    right: typeof window !== "undefined" && window.innerWidth < 640 ? 12 : 20,
    bottom: 12,
  };
  const stored = readLocalStorageValue(PLAYER_POSITION_KEY);
  if (!stored) return clampPosition(fallback, expanded);

  try {
    const parsed = JSON.parse(stored) as Partial<PlayerPosition>;
    if (typeof parsed.right === "number" && Number.isFinite(parsed.right)
      && typeof parsed.bottom === "number" && Number.isFinite(parsed.bottom)) {
      return clampPosition({ right: parsed.right, bottom: parsed.bottom }, expanded);
    }
  } catch {
    // Ignore malformed saved positions and use the default dock location.
  }
  return clampPosition(fallback, expanded);
}

export function PersistentRadioPlayer() {
  const [expanded, setExpanded] = useState(
    () => readLocalStorageValue(PLAYER_PREFERENCE_KEY) !== "minimized",
  );
  const [position, setPosition] = useState(() => readInitialPosition(expanded));
  const positionRef = useRef(position);
  const dragRef = useRef<PlayerDrag | null>(null);
  const suppressClickUntilRef = useRef(0);
  const playerRef = useRef<HTMLElement>(null);

  function updatePosition(next: PlayerPosition) {
    positionRef.current = next;
    setPosition(next);
  }

  function persistPosition(next: PlayerPosition) {
    writeLocalStorageValue(PLAYER_POSITION_KEY, JSON.stringify(next));
  }

  function setDisplayState(nextExpanded: boolean) {
    setExpanded(nextExpanded);
    writeLocalStorageValue(PLAYER_PREFERENCE_KEY, nextExpanded ? "expanded" : "minimized");
    const nextPosition = clampPosition(positionRef.current, nextExpanded);
    updatePosition(nextPosition);
    persistPosition(nextPosition);
  }

  useEffect(() => {
    function keepPlayerInBounds() {
      const nextPosition = clampPosition(positionRef.current, expanded);
      if (nextPosition.right !== positionRef.current.right
        || nextPosition.bottom !== positionRef.current.bottom) {
        updatePosition(nextPosition);
        persistPosition(nextPosition);
      }
    }

    window.addEventListener("resize", keepPlayerInBounds);
    window.addEventListener("orientationchange", keepPlayerInBounds);
    return () => {
      window.removeEventListener("resize", keepPlayerInBounds);
      window.removeEventListener("orientationchange", keepPlayerInBounds);
    };
  }, [expanded]);

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || !playerRef.current) return;
    const rect = playerRef.current.getBoundingClientRect();
    const visibleWidth = expanded ? rect.width : Math.min(MINIMIZED_VISIBLE_WIDTH, rect.width);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      visibleWidth,
      visibleHeight: rect.height,
      moved: false,
    };

    const target = event.target;
    const captureTarget = target instanceof Element
      ? target.closest<HTMLElement>("button, a") ?? event.currentTarget
      : event.currentTarget;
    if ("setPointerCapture" in captureTarget) {
      try {
        captureTarget.setPointerCapture(event.pointerId);
      } catch {
        // Pointer capture is optional in older browsers; events still bubble from the handle.
      }
    }
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    if (!drag.moved && Math.hypot(deltaX, deltaY) < DRAG_THRESHOLD) return;

    drag.moved = true;
    event.preventDefault();
    const left = event.clientX - drag.offsetX;
    const top = event.clientY - drag.offsetY;
    const viewport = getViewportSize();
    const maxRight = Math.max(0, viewport.width - drag.visibleWidth - EDGE_GUTTER);
    const maxBottom = Math.max(0, viewport.height - drag.visibleHeight - EDGE_GUTTER);
    updatePosition({
      right: Math.min(maxRight, Math.max(EDGE_GUTTER, viewport.width - left - drag.visibleWidth)),
      bottom: Math.min(maxBottom, Math.max(EDGE_GUTTER, viewport.height - top - drag.visibleHeight)),
    });
  }

  function finishPointerDrag(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (drag.moved) {
      persistPosition(positionRef.current);
      suppressClickUntilRef.current = Date.now() + 300;
      window.setTimeout(() => {
        suppressClickUntilRef.current = 0;
      }, 0);
    }
    dragRef.current = null;
  }

  function suppressDragClick(event: React.MouseEvent<HTMLDivElement>) {
    if (Date.now() < suppressClickUntilRef.current) {
      event.preventDefault();
      event.stopPropagation();
      suppressClickUntilRef.current = 0;
    }
  }

  return (
    <aside
      ref={playerRef}
      aria-label="Suruur FM floating radio player"
      className={cn(
        "fixed bottom-[calc(.75rem+env(safe-area-inset-bottom))] right-3 z-[55] h-10 w-[min(23.5rem,calc(100vw-1.5rem))] overflow-hidden rounded-xl border border-accent/20 bg-[linear-gradient(145deg,hsl(var(--radio-ink)/.98),hsl(340_25%_4%/.98))] shadow-[0_12px_38px_hsl(340_25%_2%_/.72)] backdrop-blur-xl transition-[transform,height] duration-300 ease-out sm:right-5 sm:w-[23.5rem]",
        expanded && "h-[8.5rem]",
      )}
      style={{
        right: `${position.right}px`,
        bottom: `calc(${position.bottom}px + env(safe-area-inset-bottom))`,
        transform: expanded ? "translateX(0)" : "translateX(calc(100% - 3rem))",
      }}
      data-testid="persistent-radio-player"
      data-expanded={expanded}
      data-display-state={expanded ? "expanded" : "minimized"}
    >
      <div
        className="flex h-10 touch-none select-none cursor-grab active:cursor-grabbing items-center gap-2 border-b border-accent/10 px-2.5"
        aria-label="Drag to move radio player"
        data-testid="radio-player-drag-handle"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishPointerDrag}
        onPointerCancel={finishPointerDrag}
        onClickCapture={suppressDragClick}
      >
        <img
          src={`${import.meta.env.BASE_URL}logo.jpg`}
          alt="Surrur E Man official logo"
          className="h-8 w-12 shrink-0 object-contain"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate font-heading text-[10px] font-semibold tracking-[0.14em] text-accent">SURUUR FM</p>
          <p className="truncate text-[8px] uppercase tracking-[0.13em] text-muted-foreground">GoCast Radio</p>
        </div>
        <Link
          href="/radio"
          aria-label="Open the full Radio page"
          title="Open the full Radio page"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-accent/75 transition-colors hover:bg-accent/10 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <ArrowUpRight size={15} aria-hidden="true" />
        </Link>
        <button
          type="button"
          onClick={() => setDisplayState(!expanded)}
          aria-expanded={expanded}
          aria-label={expanded ? "Minimize radio player" : "Restore radio player"}
          title={expanded ? "Minimize radio player" : "Restore radio player"}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-accent/70 transition-colors hover:bg-accent/10 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {expanded ? <ChevronDown size={17} aria-hidden="true" /> : <Radio size={17} aria-hidden="true" />}
        </button>
      </div>
      <div className="w-full overflow-hidden px-1.5 py-1" data-testid="gocast-player-wrapper">
        <iframe
          src={GOCAST_EMBED_URL}
          title="Suruur FM on GoCast"
          width="100%"
          height="88"
          style={{ border: 0, borderRadius: 12, overflow: "hidden", display: "block" }}
          allow="autoplay"
          loading="lazy"
        />
      </div>
    </aside>
  );
}
