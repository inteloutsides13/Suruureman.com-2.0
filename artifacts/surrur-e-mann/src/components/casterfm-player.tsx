import { useEffect, useRef, useState } from "react";
import { Radio } from "lucide-react";
import type { RadioNowPlaying } from "@/hooks/use-radio-status";

declare global {
  interface Window {
    casterfmWidgetsRescan?: () => void;
  }
}

const CASTERFM_SCRIPT_ID = "casterfm-cloud-widget-script";
const CASTERFM_SCRIPT_URL = "https://cdn.cloud.caster.fm/widgets/embed.js";

type WidgetState = "loading" | "ready" | "error";

let casterFmScriptPromise: Promise<void> | null = null;

function loadCasterFmScript(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Caster.fm widgets are only available in a browser."));
  }

  if (typeof window.casterfmWidgetsRescan === "function") {
    return Promise.resolve();
  }

  if (casterFmScriptPromise) return casterFmScriptPromise;

  let script = document.getElementById(CASTERFM_SCRIPT_ID) as HTMLScriptElement | null;
  if (script?.dataset.casterfmLoaded === "true") {
    script.remove();
    script = null;
  }

  const shouldAppend = script === null;
  if (!script) {
    script = document.createElement("script");
    script.id = CASTERFM_SCRIPT_ID;
    script.src = CASTERFM_SCRIPT_URL;
    script.async = true;
  }

  const activeScript = script;
  const pending = new Promise<void>((resolve, reject) => {
    activeScript.addEventListener("load", () => {
      activeScript.dataset.casterfmLoaded = "true";
      if (typeof window.casterfmWidgetsRescan === "function") {
        resolve();
      } else {
        reject(new Error("Caster.fm's widget renderer did not initialize."));
      }
    }, { once: true });
    activeScript.addEventListener("error", () => {
      reject(new Error("Caster.fm's widget script could not be loaded."));
    }, { once: true });

    if (shouldAppend) document.head.appendChild(activeScript);
  });

  casterFmScriptPromise = pending.catch((error: unknown) => {
    document.getElementById(CASTERFM_SCRIPT_ID)?.remove();
    casterFmScriptPromise = null;
    throw error;
  });

  return casterFmScriptPromise;
}

interface CasterFmPlayerProps {
  publicToken: string;
  channelId?: string | null;
  nowPlaying?: RadioNowPlaying | null;
}

export function CasterFmPlayer({ publicToken, channelId, nowPlaying }: CasterFmPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<WidgetState>("loading");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let mounted = true;
    let frame: HTMLIFrameElement | null = null;
    const handleFrameLoad = () => {
      if (mounted) setState("ready");
    };
    const handleFrameError = () => {
      if (mounted) setState("error");
    };

    setState("loading");
    void loadCasterFmScript()
      .then(() => {
        if (!mounted) return;
        const rescan = window.casterfmWidgetsRescan;
        const container = containerRef.current;
        if (!rescan || !container?.isConnected) {
          throw new Error("Caster.fm's player is not available.");
        }

        // The official embed script exposes this rescan function for new .cstrEmbed nodes.
        rescan();
        frame = container.querySelector("iframe");
        if (!frame) throw new Error("Caster.fm did not create its player frame.");

        frame.title = "Caster.fm Free Plan live stream player";
        frame.addEventListener("load", handleFrameLoad, { once: true });
        frame.addEventListener("error", handleFrameError, { once: true });
      })
      .catch(() => {
        if (mounted) setState("error");
      });

    return () => {
      mounted = false;
      frame?.removeEventListener("load", handleFrameLoad);
      frame?.removeEventListener("error", handleFrameError);
    };
  }, [publicToken, channelId, attempt]);

  return (
    <section
      className="relative overflow-hidden rounded-[1.75rem] border border-accent/20 bg-[hsl(var(--radio-ink))] shadow-[0_18px_70px_hsl(340_25%_2%_/_0.6)]"
      aria-labelledby="casterfm-player-title"
    >
      <div className="relative z-10 p-5 sm:p-7">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-full border border-accent/30 bg-accent/10 text-accent">
            <Radio size={18} strokeWidth={1.5} aria-hidden="true" />
          </div>
          <div>
            <p id="casterfm-player-title" className="font-heading text-xs uppercase tracking-[0.24em] text-accent/80">
              Suruur FM
            </p>
            <p className="mt-1 text-sm text-muted-foreground">Caster.fm Free Plan · Official Live Stream Player</p>
          </div>
        </div>

        <div className="mt-6 min-h-40 w-full overflow-hidden rounded-xl border border-accent/10 bg-background/40 p-2 sm:p-3">
          <div
            key={attempt}
            ref={containerRef}
            data-type="streamPlayer"
            data-publictoken={publicToken}
            data-theme="dark"
            data-color="e83e8c"
            data-channelid={channelId || undefined}
            data-rendered="false"
            className="cstrEmbed min-h-36 w-full overflow-hidden"
          >
            <a href="https://www.caster.fm">Shoutcast Hosting</a>
            <a href="https://www.caster.fm">Stream Hosting</a>
            <a href="https://www.caster.fm">Radio Server Hosting</a>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p role="status" aria-live="polite" className="text-xs leading-5 text-muted-foreground">
            {state === "loading"
              ? "Loading the official Caster.fm player…"
              : state === "ready"
                ? "Caster.fm frame loaded. Use its controls if available; this page cannot verify playback or live status."
                : "The Caster.fm player could not be loaded."}
          </p>
          {state === "error" && (
            <button
              type="button"
              onClick={() => setAttempt((value) => value + 1)}
              className="min-h-9 rounded-lg border border-accent/20 px-3 text-xs text-accent hover:border-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              Retry player
            </button>
          )}
        </div>

        {nowPlaying?.title && (
          <div className="mt-4 border-t border-foreground/10 pt-4">
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Configured program metadata</p>
            <p className="mt-1 font-urdu text-xl leading-8 text-foreground" dir="auto">{nowPlaying.title}</p>
            {(nowPlaying.artist || nowPlaying.show) && (
              <p className="mt-1 text-sm text-muted-foreground" dir="auto">{nowPlaying.artist ?? nowPlaying.show}</p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
