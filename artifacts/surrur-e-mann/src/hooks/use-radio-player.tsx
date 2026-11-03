import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRadioStatus, type RadioState } from "@/hooks/use-radio-status";
import { readLocalStorageValue, writeLocalStorageValue } from "@/lib/browser-storage";
import { getCasterFmConfig } from "@/lib/casterfm-config";

type PlaybackState = "idle" | "connecting" | "playing" | "paused" | "error";

export interface RadioPlayerContextValue extends RadioState {
  retry: () => void;
  playback: PlaybackState;
  volume: number;
  setVolume: (value: number) => void;
  togglePlayback: () => void;
}

const RadioPlayerContext = createContext<RadioPlayerContextValue | null>(null);

export function RadioPlayerProvider({ children }: { children: ReactNode }) {
  const radio = useRadioStatus();
  const casterFmConfigured = getCasterFmConfig().configured;
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playback, setPlayback] = useState<PlaybackState>("idle");
  const [volume, setVolumeState] = useState(() => {
    const storedValue = readLocalStorageValue("suruur-radio-volume");
    const stored = storedValue === null ? Number.NaN : Number(storedValue);
    return Number.isFinite(stored) && stored >= 0 && stored <= 1 ? stored : 0.8;
  });

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = volume;
  }, [volume]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    setPlayback("idle");
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
    if (!casterFmConfigured && radio.streamUrl) {
      audio.src = radio.streamUrl;
      audio.volume = volume;
    }
  }, [radio.streamUrl, casterFmConfigured]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onPlaying = () => setPlayback("playing");
    const onPause = () => setPlayback((state) => state === "error" ? state : "paused");
    const onWaiting = () => setPlayback("connecting");
    const onError = () => setPlayback("error");
    audio.addEventListener("playing", onPlaying);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("waiting", onWaiting);
    audio.addEventListener("error", onError);
    return () => {
      audio.removeEventListener("playing", onPlaying);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("waiting", onWaiting);
      audio.removeEventListener("error", onError);
    };
  }, []);

  const setVolume = (value: number) => {
    const next = Math.min(Math.max(value, 0), 1);
    setVolumeState(next);
    writeLocalStorageValue("suruur-radio-volume", String(next));
  };

  const togglePlayback = () => {
    const audio = audioRef.current;
    if (casterFmConfigured || !audio || radio.status !== "available" || !radio.streamUrl) return;
    if (!audio.paused) {
      audio.pause();
      return;
    }
    setPlayback("connecting");
    void audio.play().catch(() => setPlayback("error"));
  };

  const value = useMemo<RadioPlayerContextValue>(() => ({
    ...radio,
    playback,
    volume,
    setVolume,
    togglePlayback,
  }), [radio, playback, volume]);

  return (
    <RadioPlayerContext.Provider value={value}>
      {children}
      <audio ref={audioRef} preload="none" aria-label="Radio Suruur FM playback" className="sr-only" />
    </RadioPlayerContext.Provider>
  );
}

export function useRadioPlayer() {
  const context = useContext(RadioPlayerContext);
  if (!context) throw new Error("useRadioPlayer must be used within RadioPlayerProvider");
  return context;
}