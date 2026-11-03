import { useCallback, useEffect, useRef, useState } from "react";

export type RadioStatus = "loading" | "available" | "offline" | "empty" | "error";

export interface RadioNowPlaying {
  title: string;
  artist?: string;
  show?: string;
  contentType?: string;
  artworkUrl?: string;
  updatedAt?: string;
}

export interface RadioSchedule {
  id: number;
  name: string;
  timezone: string;
  daysOfWeek: string;
  startLocalTime: string;
  endLocalTime: string;
  effectiveFrom: string | null;
  effectiveUntil: string | null;
  programName: string | null;
  attribution: string | null;
  priority?: number;
  scheduleState?: "current" | "upcoming";
  occurrenceStart?: string;
  occurrenceEnd?: string;
  occurrenceLocalDate?: string;
}

export interface RadioStation {
  name: string;
  hostname: string;
  path: string | null;
  protocol: string;
  format: string;
  bitrateKbps: number;
  timezone: string;
}

export interface RadioState {
  status: RadioStatus;
  streamUrl: string | null;
  isLive: boolean | null;
  nowPlaying: RadioNowPlaying | null;
  message: string | null;
  checkedAt: string | null;
  station: RadioStation | null;
  schedules: RadioSchedule[];
}

interface RadioResponse {
  status?: string;
  state?: string;
  available?: boolean;
  isLive?: boolean;
  streamUrl?: string | null;
  stream_url?: string | null;
  nowPlaying?: unknown;
  now_playing?: unknown;
  message?: string | null;
  station?: RadioStation;
  schedules?: RadioSchedule[];
}

const initialState: RadioState = {
  status: "loading",
  streamUrl: null,
  isLive: null,
  nowPlaying: null,
  message: null,
  checkedAt: null,
  station: null,
  schedules: [],
};

function normalizeNowPlaying(value: unknown): RadioNowPlaying | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  const title = typeof item.title === "string" ? item.title.trim() : "";
  if (!title) return null;
  return {
    title,
    artist: typeof item.artist === "string" ? item.artist.trim() || undefined : undefined,
    show: typeof item.show === "string"
      ? item.show.trim() || undefined
      : typeof item.program === "string" ? item.program.trim() || undefined : undefined,
    contentType: typeof item.contentType === "string" ? item.contentType.trim() || undefined : undefined,
    artworkUrl: typeof item.artworkUrl === "string" ? item.artworkUrl : undefined,
    updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : undefined,
  };
}

function normalizeResponse(data: RadioResponse): RadioState {
  const streamUrl =
    typeof data.streamUrl === "string"
      ? data.streamUrl.trim() || null
      : typeof data.stream_url === "string"
        ? data.stream_url.trim() || null
        : null;
  const explicitStatus = String(data.status ?? data.state ?? "").toLowerCase();
  const isOffline = data.isLive === false || ["offline", "unavailable", "stopped"].includes(explicitStatus);
  const isAvailable =
    !isOffline &&
    (data.available === true ||
      data.isLive === true ||
      Boolean(streamUrl) ||
      ["live", "available", "online"].includes(explicitStatus));
  const nowPlaying = normalizeNowPlaying(data.nowPlaying ?? data.now_playing);
  const isLive: boolean | null = !isAvailable || !streamUrl
    ? false
    : data.isLive === true || ["live", "broadcasting", "on_air"].includes(explicitStatus)
      ? true
      : data.isLive === false || ["offline", "unavailable", "stopped"].includes(explicitStatus)
        ? false
        : null;

  return {
    status: isAvailable && streamUrl ? "available" : isOffline ? "offline" : "empty",
    streamUrl: isAvailable ? streamUrl : null,
    isLive,
    nowPlaying: isAvailable ? nowPlaying : null,
    message: typeof data.message === "string" ? data.message.trim() || null : null,
    checkedAt: new Date().toISOString(),
    station: data.station ?? null,
    schedules: Array.isArray(data.schedules) ? data.schedules : [],
  };
}

/**
 * The endpoint is deliberately isolated here so the radio contract can be
 * connected without changing the public page or player. An absent endpoint
 * remains unavailable; the UI never invents a provider or broadcast state.
 */
export function useRadioStatus() {
  const [state, setState] = useState<RadioState>(initialState);
  const [requestKey, setRequestKey] = useState(0);
  const mounted = useRef(true);

  const retry = useCallback(() => {
    setRequestKey((value) => value + 1);
  }, []);

  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();

    setState((previous) => ({ ...previous, status: "loading", message: null }));
    fetch("/api/radio/status", {
      signal: controller.signal,
      credentials: "include",
      headers: { Accept: "application/json" },
    })
      .then(async (response) => {
        if (response.status === 404) {
          return { unavailableEndpoint: true };
        }
        if (!response.ok) throw new Error(`Radio status request failed: ${response.status}`);
        return (await response.json()) as RadioResponse;
      })
      .then((data) => {
        if (!mounted.current) return;
        if ("unavailableEndpoint" in data) {
          setState({
            status: "offline",
            streamUrl: null,
            isLive: false,
            nowPlaying: null,
            message: "The Radio stream service is not connected yet.",
            checkedAt: new Date().toISOString(),
            station: null,
            schedules: [],
          });
          return;
        }
        setState(normalizeResponse(data as RadioResponse));
      })
      .catch((error: unknown) => {
        if (!mounted.current || (error instanceof DOMException && error.name === "AbortError")) return;
        setState({
          status: "error",
          streamUrl: null,
          isLive: null,
          nowPlaying: null,
          message: "We could not load Radio stream configuration.",
          checkedAt: null,
          station: null,
          schedules: [],
        });
      });

    return () => {
      mounted.current = false;
      controller.abort();
    };
  }, [requestKey]);

  useEffect(() => {
    if (state.status !== "available") return;
    const interval = window.setInterval(retry, 60_000);
    return () => window.clearInterval(interval);
  }, [retry, state.status]);

  return { ...state, retry };
}