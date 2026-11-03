import { AlertCircle, LoaderCircle, Pause, Play, Radio, RefreshCw, Volume2, VolumeX } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { useRadioPlayer } from "@/hooks/use-radio-player";
import { getCasterFmConfig } from "@/lib/casterfm-config";

interface RadioPlayerProps {
  className?: string;
}

const statusCopy = {
  loading: { label: "پلے بیک کی تیاری", detail: "اسٹریم کی ترتیب دیکھی جا رہی ہے" },
  available: { label: "اسٹریم لنک موجود ہے", detail: "پلے دبانے سے اسی براؤزر میں پلے بیک آزمایا جا سکتا ہے" },
  offline: { label: "پلے بیک دستیاب نہیں", detail: "سامعین کے لیے قابلِ استعمال پبلک اسٹریم ترتیب نہیں دی گئی" },
  empty: { label: "پلے بیک دستیاب نہیں", detail: "سننے کے لیے کوئی قابلِ استعمال پبلک لنک موجود نہیں" },
  error: { label: "ترتیب لوڈ نہیں ہو سکی", detail: "اسٹریم کی تفصیل لوڈ نہیں ہو سکی؛ دوبارہ کوشش کریں" },
} as const;

export function RadioPlayer({ className }: RadioPlayerProps) {
  const {
    status,
    streamUrl,
    nowPlaying,
    message,
    retry,
    playback,
    volume,
    setVolume,
    togglePlayback,
  } = useRadioPlayer();
  const canPlay = status === "available" && Boolean(streamUrl);
  const isPlaying = playback === "playing";
  const isPlaybackActive = isPlaying || playback === "connecting";
  const copy = statusCopy[status];

  const playbackLabel =
    playback === "playing"
      ? "Pause radio"
      : playback === "connecting"
        ? "Connecting to radio"
        : playback === "paused"
          ? "Resume radio"
          : "Play radio";
  const badgeLabel =
    playback === "playing"
      ? "Playing"
      : playback === "connecting"
        ? "Connecting"
        : playback === "paused"
          ? "Paused"
          : playback === "error"
            ? "Playback unavailable"
            : status === "loading"
              ? "Preparing playback"
              : status === "available"
                ? "Stream configured"
                : status === "empty"
                  ? "Playback unavailable"
                  : "Stream unavailable";

  const controlDetail =
    playback === "error"
      ? "Your browser could not start playback. Try again, or check back later if the stream is unavailable."
      : isPlaying
        ? "Playing in this browser only."
        : playback === "connecting"
          ? "The browser is connecting to the configured stream."
          : playback === "paused"
            ? "Playback is paused in this browser."
            : canPlay
              ? "Press play to test the configured stream in this browser."
              : status === "error"
                ? "Use retry to request the stream configuration again."
                : "There is no usable public stream link to play yet.";

  return (
    <section className={cn("relative overflow-hidden rounded-[1.75rem] border border-accent/20 bg-[hsl(var(--radio-ink))] shadow-[0_18px_70px_hsl(340_25%_2%_/_0.6)]", className)} aria-labelledby="radio-player-title" aria-describedby="radio-player-description">
      <div className="radio-scanline pointer-events-none absolute inset-0 opacity-50" />
      <div className="radio-grid pointer-events-none absolute inset-0 opacity-70" />
      <div className="relative z-10 p-5 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-full border border-accent/30 bg-accent/10 text-accent">
              <Radio size={18} strokeWidth={1.5} aria-hidden="true" />
            </div>
            <div>
              <p id="radio-player-title" className="font-heading text-xs uppercase tracking-[0.28em] text-accent/80">Suruur FM</p>
              <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Web radio</p>
            </div>
          </div>
          <span className={cn(
            "rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.2em]",
            status === "available" ? "border-accent/40 text-accent" : "border-foreground/10 text-muted-foreground",
          )}>
            {badgeLabel}
          </span>
        </div>

        <div className="relative my-10 flex min-h-36 items-center justify-center">
          <div className="radio-orbit absolute h-40 w-40 rounded-full border border-dashed border-accent/20" />
          <div className="absolute h-28 w-28 rounded-full border border-accent/20" />
          <div className="absolute h-20 w-20 rounded-full bg-primary/15 ring-1 ring-accent/20" />
          <div className="relative grid h-14 w-14 place-items-center rounded-full bg-accent text-accent-foreground shadow-[0_0_35px_hsl(var(--accent)/.25)]">
            {playback === "connecting" ? <LoaderCircle className="animate-spin" size={22} aria-hidden="true" /> : <Volume2 size={21} strokeWidth={1.5} aria-hidden="true" />}
          </div>
        </div>

        <div className="mb-6 flex items-end justify-between gap-6">
          <div className="min-w-0 flex-1">
            <p className="font-urdu text-lg leading-[1.8] text-accent/80" dir="rtl">{copy.label}</p>
              {nowPlaying?.title && <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Configured program metadata</p>}
              <p className="mt-3 line-clamp-2 font-urdu text-3xl leading-[1.8] text-foreground/95" dir={nowPlaying?.title ? "auto" : "rtl"}>
              {nowPlaying?.title ?? "آواز فی الحال خاموش ہے"}
            </p>
            <p className="mt-2 truncate font-urdu text-lg leading-[1.8] text-muted-foreground" dir={nowPlaying?.artist || nowPlaying?.show || message ? "auto" : "rtl"}>{nowPlaying?.artist ?? nowPlaying?.show ?? message ?? copy.detail}</p>
          </div>
          <div className="hidden items-end gap-1.5 sm:flex" aria-hidden="true">
            {[22, 37, 15, 32, 47, 27, 40, 18, 34, 24, 43, 20].map((height, index) => (
              <span
                key={height + index}
                 className={cn("radio-wave-bar block w-1 rounded-full bg-accent/70", isPlaybackActive ? "" : "opacity-35")}
                style={{ height: `${height}px`, animationDelay: `${index * 90}ms` }}
              />
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-foreground/10 pt-4">
          <button
            type="button"
            onClick={togglePlayback}
            disabled={!canPlay}
            aria-label={playbackLabel}
            title={playbackLabel}
            className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--radio-ink))] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
          >
            {isPlaying ? <Pause size={19} fill="currentColor" aria-hidden="true" /> : <Play size={19} fill="currentColor" aria-hidden="true" />}
          </button>
          <div id="radio-player-description" className="min-w-0 flex-1" role="status" aria-live="polite" aria-atomic="true">
            <p className="font-urdu text-base leading-[1.8] text-foreground" dir="rtl">{playback === "error" ? "پلے بیک دستیاب نہیں" : isPlaying ? "آپ اس براؤزر میں ریڈیو سن رہے ہیں" : playback === "connecting" ? "ریڈیو سے رابطہ ہو رہا ہے" : playback === "paused" ? "پلے بیک موقوف ہے" : canPlay ? "ریڈیو چلانے کے لیے تیار" : "اسٹریم دستیاب نہیں"}</p>
            <p className="mt-1 truncate font-urdu text-sm leading-[1.8] text-muted-foreground" dir="rtl">{playback === "error" ? "براؤزر پلے بیک شروع نہیں کر سکا؛ دوبارہ کوشش کریں۔" : copy.detail}</p>
            <p className="sr-only">{controlDetail}</p>
          </div>
          {(status === "error" || playback === "error") && (
            <button
              type="button"
              onClick={retry}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-accent/25 text-accent transition-colors hover:border-accent hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              aria-label={playback === "error" ? "Retry playback" : "Retry Radio status request"}
              title={playback === "error" ? "Retry playback" : "Retry Radio status request"}
            >
              {status === "error" ? <RefreshCw size={15} aria-hidden="true" /> : <AlertCircle size={15} aria-hidden="true" />}
            </button>
          )}
          <label className="group hidden cursor-pointer items-center gap-2 sm:flex" aria-label="Radio volume">
            {volume === 0 ? <VolumeX size={15} className="text-muted-foreground transition-colors group-hover:text-foreground" aria-hidden="true" /> : <Volume2 size={15} className="text-muted-foreground transition-colors group-hover:text-foreground" aria-hidden="true" />}
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={volume}
              onChange={(event) => setVolume(Number(event.target.value))}
              className="w-20 cursor-pointer accent-accent"
              aria-label="Adjust volume"
            />
          </label>
        </div>
      </div>
    </section>
  );
}

export function RadioMiniPlayer() {
  const { status, streamUrl, nowPlaying, playback, togglePlayback } = useRadioPlayer();
  if (getCasterFmConfig().configured) return null;
  const isPlaying = playback === "playing";
  const isConnecting = playback === "connecting";
  const isPaused = playback === "paused";
  const hasPlaybackError = playback === "error";
  const canPlay = status === "available" && Boolean(streamUrl);
  const playbackButtonLabel = isPlaying
    ? "Pause Radio Suruur FM"
    : isConnecting
      ? "Connecting to Radio Suruur FM"
      : isPaused
        ? "Resume Radio Suruur FM"
        : hasPlaybackError
          ? "Retry Radio Suruur FM"
          : "Play Radio Suruur FM";
  const playbackStatusLabel = isConnecting
    ? "Connecting in this browser"
    : isPlaying
      ? "Playing in this browser"
      : isPaused
        ? "Paused in this browser"
        : hasPlaybackError
          ? "Playback unavailable"
          : nowPlaying?.title
            ? "Configured program metadata"
            : status === "available"
              ? "Stream link configured"
              : "Public playback unavailable";
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-accent/15 bg-background/90 shadow-[0_-12px_40px_hsl(340_25%_2%_/.8)] backdrop-blur-xl transition-all duration-500 ease-in-out" aria-label="Radio mini player">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2.5 sm:gap-4 sm:px-6 sm:py-3 lg:px-8">
        <button
          type="button"
          onClick={togglePlayback}
          disabled={!canPlay || isConnecting}
          aria-label={playbackButtonLabel}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100 sm:h-11 sm:w-11"
        >
          {isPlaying ? <Pause size={18} fill="currentColor" aria-hidden="true" /> : isConnecting ? <LoaderCircle size={18} className="animate-spin" aria-hidden="true" /> : <Play size={18} fill="currentColor" aria-hidden="true" />}
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium text-foreground sm:text-sm" dir={nowPlaying?.title ? "rtl" : "ltr"}>{nowPlaying?.title ?? "Radio Suruur FM"}</p>
          <p className="mt-0.5 truncate text-[10px] uppercase tracking-[0.18em] text-muted-foreground/80 sm:text-[11px]">
            {playbackStatusLabel}
          </p>
        </div>
        <Link href="/radio" className="hidden shrink-0 items-center gap-2 rounded-full border border-accent/20 px-4 py-2 text-[10px] uppercase tracking-[0.2em] text-accent transition-colors hover:border-accent hover:bg-accent/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:inline-flex">
          پلیئر کھولیں
        </Link>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/5 sm:h-11 sm:w-11">
          <Radio size={18} className="text-accent/80" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}