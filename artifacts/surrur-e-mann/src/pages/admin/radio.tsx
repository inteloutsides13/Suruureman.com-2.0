import { useCallback, useEffect, useRef, useState } from "react";
import { Archive, ArrowDown, ArrowUp, CheckCircle2, ChevronLeft, ChevronRight, Clock3, ExternalLink, Filter, Info, LoaderCircle, RefreshCw, Save, Search, ShieldAlert, XCircle } from "lucide-react";
import { AdminLayout } from "@/components/admin-layout";
import { MobileBroadcastGuide } from "@/components/mobile-broadcast-guide";
import { adminFetch, useAdminAuth } from "@/hooks/use-admin-auth";
import { getCasterFmConfig } from "@/lib/casterfm-config";

type AudioRecord = {
  id: number;
  title: string;
  titleUrdu: string;
  description: string;
  category: string | null;
  originalFilename: string;
  editorialStatus: string;
  processingStatus: string;
  rightsStatus: string;
  rightsNotes: string | null;
  rightsValidFrom: string | null;
  rightsValidUntil: string | null;
  rejectionReason: string | null;
  durationMs: number | null;
  broadcastEligible?: boolean;
  broadcastEligibilityReasons?: string[];
};
type AudioCounts = { total: number; eligible: number };
type AudioPagination = { page: number; pageSize: number; total: number; totalPages: number; hasNextPage: boolean; hasPreviousPage: boolean };
type RequestState = "idle" | "loading" | "success" | "error" | "refreshing";
type AudioFilters = {
  search: string;
  eligibility: "all" | "eligible" | "ineligible";
  editorialStatus: string;
  processingStatus: string;
  rightsStatus: string;
};

type Playlist = { id: number; name: string; description: string; status: string; mode: string; repeatWindow: number | null };
type PlaylistItem = { id: number; audioId: number; position: number; enabled: boolean; title: string; category: string | null; editorialStatus: string; processingStatus: string; rightsStatus: string; broadcastEligible?: boolean; broadcastEligibilityReasons?: string[] };
type Schedule = { id: number; name: string; playlistId: number; status: string; timezone: string; daysOfWeek: string; startLocalTime: string; endLocalTime: string; programName: string | null; priority: number; effectiveFrom: string | null; effectiveUntil: string | null };
type EmergencyState = { enabled: boolean; type: string | null; audioId: number | null; message: string | null; broadcastExecution: string };
type RadioSettings = Record<string, string>;

const categories = [
  ["poetry", "Poetry"],
  ["ghazal", "Ghazal"],
  ["music", "Music"],
  ["naat_special", "Naat / Special"],
  ["literary_program", "Literary program"],
  ["interview", "Interview"],
  ["recorded_program", "Recorded program"],
  ["live_program", "Live program"],
  ["station_promo", "Station / promo"],
] as const;

const settingFields = [
  ["station_name", "Station name"],
  ["enabled", "Stream configuration"],
  ["public_stream_url", "Public stream URL"],
  ["stream_hostname", "Stream hostname"],
  ["stream_path", "Stream path"],
  ["stream_protocol", "Protocol"],
  ["stream_format", "Format"],
  ["stream_bitrate_kbps", "Bitrate (kbps)"],
  ["schedule_timezone", "Schedule timezone"],
  ["status_message", "Listener-facing status message"],
] as const;

const emptyPlaylist = { name: "", description: "", mode: "sequential", status: "draft", repeatWindow: "" };
const emptySchedule = { name: "", playlistId: "", timezone: "Europe/Berlin", daysOfWeek: "1,2,3,4,5", startLocalTime: "18:00", endLocalTime: "19:00", programName: "", priority: "0", status: "draft", effectiveFrom: "", effectiveUntil: "" };
const emptyAudioFilters: AudioFilters = { search: "", eligibility: "all", editorialStatus: "", processingStatus: "", rightsStatus: "" };
const AUDIO_PAGE_SIZE = 50;
const eligibilityReasonLabels: Record<string, string> = {
  processing_not_ready: "Processing is not complete",
  editorial_approval_required: "Editorial approval is required",
  rights_not_cleared: "Rights are not cleared",
  rights_not_yet_valid: "Rights are not valid yet",
  rights_expired: "Rights have expired",
  missing_object_key: "A usable audio file is not available",
  missing_checksum: "File checksum is missing",
};
const statusLabels: Record<string, string> = {
  not_started: "Not started",
  uploading: "Uploading",
  uploaded: "Uploaded",
  quarantined: "Quarantined",
  processing: "Processing",
  ready: "Processing complete",
  failed: "Processing failed",
  draft: "Draft",
  ready_for_review: "Awaiting editorial review",
  approved: "Approved",
  rejected: "Rejected",
  inactive: "Inactive",
  archived: "Archived",
  unknown: "Unknown",
  cleared: "Cleared",
  restricted: "Restricted",
  expired: "Expired",
  takedown: "Takedown",
};

function formatDuration(durationMs: number | null) {
  if (!durationMs) return "—";
  return `${Math.floor(durationMs / 60_000)}:${Math.floor((durationMs % 60_000) / 1_000).toString().padStart(2, "0")}`;
}

function displayStatus(status: string) {
  return statusLabels[status] ?? status.replaceAll("_", " ");
}

function statusTone(status: string) {
  if (["approved", "ready", "active", "cleared"].includes(status)) return "text-emerald-400";
  if (["rejected", "failed", "archived", "expired", "takedown"].includes(status)) return "text-destructive";
  return "text-amber-400";
}

function eligibilityReasonLabel(reason: string) {
  return eligibilityReasonLabels[reason] ?? "Another broadcast eligibility requirement is not satisfied";
}

function hasAudioFilters(filters: AudioFilters) {
  return Boolean(filters.search || filters.eligibility !== "all" || filters.editorialStatus || filters.processingStatus || filters.rightsStatus);
}

function audioEmptyMessage(filters: AudioFilters) {
  if (filters.search) return "No audio matches your search.";
  if (filters.eligibility === "eligible") return "No broadcast-eligible audio is currently available.";
  if (filters.eligibility === "ineligible") return "No ineligible audio currently matches this view.";
  if (filters.editorialStatus || filters.processingStatus || filters.rightsStatus) return "No audio currently matches this filter.";
  return "No Radio audio records are currently available.";
}

function configurationStatus(status: string) {
  if (status === "active") return "Active configuration";
  if (status === "archived") return "Archived configuration";
  return "Draft configuration";
}

function daysToString(value: string) {
  const names = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) && parsed.length
      ? parsed.map((day) => typeof day === "number" && names[day] ? names[day] : String(day)).join(" · ")
      : "No days";
  } catch {
    return "No days";
  }
}

function RetryNotice({ message, onRetry, disabled = false }: { message: string; onRetry: () => void; disabled?: boolean }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-300" role="alert">
      <span>{message}</span>
      <button type="button" onClick={onRetry} disabled={disabled} aria-label="Retry Radio request" className="inline-flex items-center gap-2 rounded-lg border border-amber-300/30 px-3 py-2 text-amber-200 disabled:cursor-not-allowed disabled:opacity-50">
        {disabled ? <LoaderCircle className="animate-spin" size={14} /> : <RefreshCw size={14} />} Retry
      </button>
    </div>
  );
}

function EligibilityCell({ item }: { item: AudioRecord }) {
  const reasons = item.broadcastEligibilityReasons ?? [];
  if (item.broadcastEligible) {
    return (
      <div className="min-w-[210px]">
        <p className="flex items-center gap-1.5 font-medium text-emerald-300"><CheckCircle2 size={14} /> Broadcast eligible</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">Eligible to be added to a future playlist configuration. It is not currently playing.</p>
      </div>
    );
  }
  return (
    <div className="min-w-[210px]">
      <p className="flex items-center gap-1.5 font-medium text-amber-300"><Info size={14} /> Not currently broadcast eligible</p>
      {reasons.length > 0 ? (
        <ul className="mt-1 space-y-0.5 text-xs leading-5 text-muted-foreground" aria-label={`Why ${item.title} is not currently broadcast eligible`}>
          {reasons.map((reason) => <li key={reason}>• {eligibilityReasonLabel(reason)}</li>)}
        </ul>
      ) : (
        <p className="mt-1 text-xs leading-5 text-muted-foreground">Eligibility details were not returned by the server.</p>
      )}
    </div>
  );
}

function AudioTable({
  audio,
  pagination,
  pageLoading,
  actionLoading,
  onApprove,
  onReject,
  onArchive,
  onPage,
}: {
  audio: AudioRecord[];
  pagination: AudioPagination;
  pageLoading: boolean;
  actionLoading: boolean;
  onApprove: (id: number) => void;
  onReject: (id: number) => void;
  onArchive: (id: number) => void;
  onPage: (page: number) => void;
}) {
  return (
    <>
      {pageLoading && <div className="flex items-center gap-2 border-b border-accent/10 px-5 py-3 text-sm text-muted-foreground" role="status"><LoaderCircle className="animate-spin" size={15} /> Refreshing audio page…</div>}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1060px] text-left text-sm">
          <thead><tr className="border-b border-accent/10 text-xs uppercase tracking-wider text-muted-foreground"><th className="px-5 py-3">Title / category</th><th className="px-5 py-3">Editorial</th><th className="px-5 py-3">Processing</th><th className="px-5 py-3">Rights</th><th className="px-5 py-3">Broadcast eligibility</th><th className="px-5 py-3">Length</th><th className="px-5 py-3">Review</th></tr></thead>
          <tbody>{audio.map((item) => <tr key={item.id} className="border-b border-accent/5 align-top last:border-0">
            <td className="px-5 py-4"><p className="font-medium text-foreground">{item.title}</p><p className="text-xs text-muted-foreground">{item.titleUrdu || item.originalFilename}</p><span className="mt-2 inline-block rounded-full border border-accent/15 px-2 py-1 text-[10px] uppercase tracking-wider text-accent">{categories.find(([value]) => value === item.category)?.[1] ?? "Uncategorized"}</span></td>
             <td className={`px-5 py-4 ${statusTone(item.editorialStatus)}`}>{displayStatus(item.editorialStatus)}{item.rejectionReason && <p className="mt-1 max-w-[180px] text-xs text-destructive">{item.rejectionReason}</p>}</td>
             <td className={`px-5 py-4 ${statusTone(item.processingStatus)}`}>{displayStatus(item.processingStatus)}</td>
             <td className={`px-5 py-4 ${statusTone(item.rightsStatus)}`}><p>{displayStatus(item.rightsStatus)}</p><p className="mt-1 max-w-[180px] text-xs text-muted-foreground">{item.rightsNotes || "No rights notes"}</p>{item.rightsValidUntil && <p className="mt-1 text-xs text-muted-foreground">Until {new Date(item.rightsValidUntil).toLocaleDateString()}</p>}</td>
             <td className="px-5 py-4"><EligibilityCell item={item} /></td>
            <td className="px-5 py-4 text-muted-foreground">{formatDuration(item.durationMs)}</td>
            <td className="px-5 py-4"><div className="flex flex-wrap gap-2">
               <button type="button" title={!item.broadcastEligible ? "Approval is unavailable until all broadcast eligibility requirements are satisfied." : undefined} onClick={() => onApprove(item.id)} disabled={actionLoading || !item.broadcastEligible || item.editorialStatus === "approved"} className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 px-2.5 py-1.5 text-xs text-emerald-300 disabled:cursor-not-allowed disabled:opacity-40"><CheckCircle2 size={13} /> Approve</button>
              <button type="button" onClick={() => onReject(item.id)} disabled={actionLoading || item.editorialStatus === "archived"} className="inline-flex items-center gap-1 rounded-md border border-destructive/30 px-2.5 py-1.5 text-xs text-destructive disabled:opacity-40"><XCircle size={13} /> Reject</button>
              <button type="button" onClick={() => onArchive(item.id)} disabled={actionLoading || item.editorialStatus === "archived"} className="inline-flex items-center gap-1 rounded-md border border-accent/20 px-2.5 py-1.5 text-xs text-accent disabled:opacity-40"><Archive size={13} /> Archive</button>
            </div></td>
          </tr>)}</tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-accent/10 px-5 py-4 text-sm">
        <p className="text-muted-foreground">Showing {(pagination.page - 1) * pagination.pageSize + 1}–{Math.min(pagination.page * pagination.pageSize, pagination.total)} of {pagination.total} total records</p>
        <div className="flex items-center gap-2">
          <button type="button" disabled={pageLoading || !pagination.hasPreviousPage} onClick={() => onPage(pagination.page - 1)} className="inline-flex items-center gap-1 rounded-lg border border-accent/20 px-3 py-2 text-accent disabled:cursor-not-allowed disabled:opacity-40"><ChevronLeft size={15} /> Previous</button>
          <span className="text-xs text-muted-foreground">Page {pagination.page} of {pagination.totalPages}</span>
          <button type="button" disabled={pageLoading || !pagination.hasNextPage} onClick={() => onPage(pagination.page + 1)} className="inline-flex items-center gap-1 rounded-lg border border-accent/20 px-3 py-2 text-accent disabled:cursor-not-allowed disabled:opacity-40">Next <ChevronRight size={15} /></button>
        </div>
      </div>
    </>
  );
}

export default function AdminRadio() {
  const { role } = useAdminAuth();
  const [showAdvancedControls, setShowAdvancedControls] = useState(false);
  const casterFm = role === "developer" && showAdvancedControls
    ? getCasterFmConfig()
    : { publicToken: null, channelId: null, configured: false };
  const developerControlsVisible = () => role === "developer" && showAdvancedControls;
  const [audio, setAudio] = useState<AudioRecord[]>([]);
  const [eligibleAudio, setEligibleAudio] = useState<AudioRecord[]>([]);
  const [audioPage, setAudioPage] = useState(1);
  const [audioCounts, setAudioCounts] = useState<AudioCounts | null>(null);
  const [audioPagination, setAudioPagination] = useState<AudioPagination | null>(null);
  const [audioPageLoading, setAudioPageLoading] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [audioFilters, setAudioFilters] = useState<AudioFilters>(emptyAudioFilters);
  const [audioSearchInput, setAudioSearchInput] = useState("");
  const [eligibleAudioLoading, setEligibleAudioLoading] = useState(false);
  const [eligibleAudioError, setEligibleAudioError] = useState<string | null>(null);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [settings, setSettings] = useState<RadioSettings>({});
  const [settingsForm, setSettingsForm] = useState<RadioSettings>({});
  const [status, setStatus] = useState<{ available: boolean; message: string; streamUrl: string | null; station?: { hostname: string; bitrateKbps: number; timezone: string } } | null>(null);
  const [playlistForm, setPlaylistForm] = useState(emptyPlaylist);
  const [editingPlaylistId, setEditingPlaylistId] = useState<number | null>(null);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<number | null>(null);
  const [playlistItems, setPlaylistItems] = useState<PlaylistItem[]>([]);
  const [itemAudioId, setItemAudioId] = useState("");
  const [scheduleForm, setScheduleForm] = useState(emptySchedule);
  const [editingScheduleId, setEditingScheduleId] = useState<number | null>(null);
  const [emergency, setEmergency] = useState<EmergencyState | null>(null);
  const [emergencyForm, setEmergencyForm] = useState({ enabled: false, type: "message", audioId: "", message: "" });
  const [loading, setLoading] = useState(true);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [playlistError, setPlaylistError] = useState<string | null>(null);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [emergencyError, setEmergencyError] = useState<string | null>(null);
  const [playlistItemsLoading, setPlaylistItemsLoading] = useState(false);
  const [playlistItemsError, setPlaylistItemsError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const loadInFlight = useRef(false);
  const audioRequestInFlight = useRef(false);
  const eligibleAudioRequestInFlight = useRef(false);
  const playlistItemsRequestInFlight = useRef(false);
  const actionInFlight = useRef(false);

  const loadAudio = useCallback(async (page: number): Promise<boolean | null> => {
    if (audioRequestInFlight.current) return null;
    audioRequestInFlight.current = true;
    setAudioPage(page);
    setAudioPageLoading(true);
    setAudioError(null);
    try {
      const query = new URLSearchParams({ page: String(page), pageSize: String(AUDIO_PAGE_SIZE) });
      if (audioFilters.search) query.set("search", audioFilters.search);
      if (audioFilters.eligibility !== "all") query.set("eligibility", audioFilters.eligibility);
      if (audioFilters.editorialStatus) query.set("editorialStatus", audioFilters.editorialStatus);
      if (audioFilters.processingStatus) query.set("processingStatus", audioFilters.processingStatus);
      if (audioFilters.rightsStatus) query.set("rightsStatus", audioFilters.rightsStatus);
      const response = await adminFetch(`/api/admin/radio/audio?${query.toString()}`);
      const data = await response.json().catch(() => null) as {
        audio?: AudioRecord[];
        counts?: AudioCounts;
        pagination?: AudioPagination;
        message?: string;
      } | null;
      if (!response.ok) {
        throw new Error(response.status === 403 ? "You do not have permission to view Radio audio." : "Radio audio records could not be loaded.");
      }
      if (!Array.isArray(data?.audio) || !data.counts || !data.pagination) {
        throw new Error("Radio audio response was incomplete.");
      }
      setAudio(data.audio);
      setAudioCounts(data.counts);
      setAudioPagination(data.pagination);
      if (page === 1) setEligibleAudio(data.audio.filter((item) => item.broadcastEligible));
      return true;
    } catch (error) {
      setAudioError(error instanceof Error && error.message === "You do not have permission to view Radio audio."
        ? error.message
        : "Radio audio records could not be loaded.");
      return false;
    } finally {
      setAudioPageLoading(false);
      audioRequestInFlight.current = false;
    }
  }, [audioFilters]);

  const loadEligibleAudio = useCallback(async () => {
    if (eligibleAudioRequestInFlight.current) return;
    eligibleAudioRequestInFlight.current = true;
    setEligibleAudioLoading(true);
    setEligibleAudioError(null);
    try {
      const response = await adminFetch("/api/admin/radio/audio?eligibility=eligible&page=1&pageSize=100");
      const data = await response.json().catch(() => null) as { audio?: AudioRecord[] } | null;
      if (!response.ok || !Array.isArray(data?.audio)) {
        throw new Error(response.status === 403 ? "You do not have permission to view eligible Radio audio." : "Eligible Radio audio could not be loaded.");
      }
      setEligibleAudio(data.audio.filter((item) => item.broadcastEligible));
    } catch (error) {
      setEligibleAudioError(error instanceof Error ? error.message : "Eligible Radio audio could not be loaded.");
    } finally {
      setEligibleAudioLoading(false);
      eligibleAudioRequestInFlight.current = false;
    }
  }, []);

  const load = useCallback(async (page: number) => {
    if (loadInFlight.current) return;
    loadInFlight.current = true;
    setLoading(true);
    setLoadError(null);
    setFeedback(null);
    setPlaylistError(null);
    setScheduleError(null);
    setStatusError(null);
    setSettingsError(null);
    setEmergencyError(null);
    try {
      const audioRequest = loadAudio(page);
      const requests = [
        {
          name: "playlists",
          run: async () => {
            const response = await adminFetch("/api/admin/radio/playlists");
            if (!response.ok) throw new Error(response.status === 403 ? "You do not have permission to view Radio playlists." : "Radio playlists could not be loaded.");
            const data = await response.json() as { playlists?: Playlist[] };
            if (!Array.isArray(data.playlists)) throw new Error("Radio playlists could not be loaded.");
            setPlaylists(data.playlists);
          },
          fail: setPlaylistError,
        },
        {
          name: "schedules",
          run: async () => {
            const response = await adminFetch("/api/admin/radio/schedules");
            if (!response.ok) throw new Error(response.status === 403 ? "You do not have permission to view Radio schedules." : "Radio schedules could not be loaded.");
            const data = await response.json() as { schedules?: Schedule[] };
            if (!Array.isArray(data.schedules)) throw new Error("Radio schedules could not be loaded.");
            setSchedules(data.schedules);
          },
          fail: setScheduleError,
        },
        {
          name: "settings",
          run: async () => {
            const response = await adminFetch("/api/admin/radio/settings");
            if (!response.ok) throw new Error(response.status === 403 ? "Your account does not have Radio settings permission." : "Radio settings could not be loaded.");
            const data = await response.json() as { settings?: { key: string; value: string }[] };
            if (!Array.isArray(data.settings)) throw new Error("Radio settings could not be loaded.");
            const next = Object.fromEntries(data.settings.map((row) => [row.key, row.value]));
            setSettings(next);
            setSettingsForm(next);
          },
          fail: setSettingsError,
        },
        {
          name: "status",
          run: async () => {
            const response = await fetch("/api/radio/status");
            if (!response.ok) throw new Error("Public Radio status could not be loaded.");
            const data = await response.json();
            if (!data || typeof data !== "object") throw new Error("Public Radio status could not be loaded.");
            setStatus(data);
          },
          fail: setStatusError,
        },
        {
          name: "emergency",
          run: async () => {
            const response = await adminFetch("/api/admin/radio/emergency");
            if (!response.ok) throw new Error(response.status === 403 ? "Emergency controls require the explicit Radio emergency permission." : "Emergency state could not be loaded.");
            const next = await response.json();
            setEmergency(next);
            setEmergencyForm({ enabled: next.enabled, type: next.type ?? "message", audioId: next.audioId ? String(next.audioId) : "", message: next.message ?? "" });
          },
          fail: setEmergencyError,
        },
      ];
      const results = await Promise.allSettled(requests.map((request) => request.run()));
      const failedResources = results.flatMap((result, index) => {
        if (result.status === "fulfilled") return [];
        const error = result.reason instanceof Error ? result.reason.message : `Radio ${requests[index].name} could not be loaded.`;
        requests[index].fail(error);
        return [requests[index].name];
      });
      const audioResult = await audioRequest;
      if (audioResult === false) failedResources.push("audio");
      if (failedResources.length > 0) {
        setLoadError("Some Radio data could not be loaded. Existing data remains visible where available.");
      } else {
        setLoadError(null);
      }
    } finally {
      setInitialLoadComplete(true);
      setLoading(false);
      loadInFlight.current = false;
    }
  }, [loadAudio]);

  useEffect(() => {
    if (role === "developer" && showAdvancedControls) void load(1);
  }, [load, role, showAdvancedControls]);

  async function loadPlaylistItems(id: number) {
    if (playlistItemsRequestInFlight.current) return;
    playlistItemsRequestInFlight.current = true;
    setSelectedPlaylistId(id);
    setPlaylistItems([]);
    setPlaylistItemsError(null);
    setPlaylistItemsLoading(true);
    try {
      const responsePromise = adminFetch(`/api/admin/radio/playlists/${id}`);
      await loadEligibleAudio();
      const response = await responsePromise;
      if (!response.ok) throw new Error(response.status === 403 ? "You do not have permission to view playlist items." : "Playlist items could not be loaded.");
      const data = await response.json() as { items?: PlaylistItem[] };
      if (!Array.isArray(data.items)) throw new Error("Playlist items could not be loaded.");
      setPlaylistItems(data.items);
    } catch (error) {
      setPlaylistItemsError(error instanceof Error ? error.message : "Playlist items could not be loaded.");
    } finally {
      setPlaylistItemsLoading(false);
      playlistItemsRequestInFlight.current = false;
    }
  }

  function applyAudioFilters(event: React.FormEvent) {
    event.preventDefault();
    setAudioFilters({
      ...audioFilters,
      search: audioSearchInput.trim(),
    });
  }

  function clearAudioFilters() {
    setAudioSearchInput("");
    setAudioFilters(emptyAudioFilters);
  }

  async function runAction(path: string, options: RequestInit, success: string) {
    if (actionInFlight.current) return false;
    actionInFlight.current = true;
    setActionLoading(true);
    setFeedback(null);
    try {
      const response = await adminFetch(path, options);
      if (!response.ok) {
        setFeedback(response.status === 403 ? "You do not have permission to complete this Radio operation." : "Radio operation could not be completed. Try again.");
        return false;
      }
      await load(audioPage);
      setFeedback(success);
      return true;
    } catch {
      setFeedback("Radio operation could not be completed. Try again.");
      return false;
    } finally {
      setActionLoading(false);
      actionInFlight.current = false;
    }
  }

  async function approveAudio(id: number) {
    await runAction(`/api/admin/radio/audio/${id}/approve`, { method: "POST" }, "Audio approval recorded.");
  }

  async function rejectAudio(id: number) {
    const reason = window.prompt("Why is this Radio content being rejected?");
    if (!reason?.trim()) return;
    await runAction(`/api/admin/radio/audio/${id}/reject`, { method: "POST", body: JSON.stringify({ reason }) }, "Audio rejection recorded.");
  }

  async function archiveAudio(id: number) {
    if (!window.confirm("Archive this Radio content? It will no longer be available for new playlist selection.")) return;
    await runAction(`/api/admin/radio/audio/${id}/archive`, { method: "POST" }, "Audio archived.");
  }

  async function savePlaylist(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    await runAction(editingPlaylistId ? `/api/admin/radio/playlists/${editingPlaylistId}` : "/api/admin/radio/playlists", {
      method: editingPlaylistId ? "PUT" : "POST",
      body: JSON.stringify({ ...playlistForm, repeatWindow: playlistForm.repeatWindow ? Number(playlistForm.repeatWindow) : null }),
    }, editingPlaylistId ? "Playlist updated." : "Playlist created.");
    setPlaylistForm(emptyPlaylist);
    setEditingPlaylistId(null);
    setSaving(false);
  }

  function editPlaylist(item: Playlist) {
    setEditingPlaylistId(item.id);
    setPlaylistForm({ name: item.name, description: item.description, mode: item.mode, status: item.status, repeatWindow: item.repeatWindow ? String(item.repeatWindow) : "" });
  }

  async function addPlaylistItem(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedPlaylistId || !itemAudioId) return;
    const ok = await runAction(`/api/admin/radio/playlists/${selectedPlaylistId}/items`, { method: "POST", body: JSON.stringify({ audioId: Number(itemAudioId) }) }, "Approved audio added to playlist.");
    if (ok) {
      setItemAudioId("");
      await loadPlaylistItems(selectedPlaylistId);
    }
  }

  async function removePlaylistItem(itemId: number) {
    if (!selectedPlaylistId) return;
    const ok = await runAction(`/api/admin/radio/playlists/${selectedPlaylistId}/items/${itemId}`, { method: "DELETE" }, "Playlist item removed.");
    if (ok) await loadPlaylistItems(selectedPlaylistId);
  }

  async function moveItem(index: number, direction: -1 | 1) {
    if (!selectedPlaylistId || index + direction < 0 || index + direction >= playlistItems.length) return;
    const next = [...playlistItems];
    [next[index], next[index + direction]] = [next[index + direction], next[index]];
    const ok = await runAction(`/api/admin/radio/playlists/${selectedPlaylistId}/items/reorder`, { method: "PUT", body: JSON.stringify({ audioIds: next.map((item) => item.audioId) }) }, "Playlist order saved.");
    if (ok) await loadPlaylistItems(selectedPlaylistId);
  }

  async function saveSchedule(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    const daysOfWeek = scheduleForm.daysOfWeek.split(",").map((value) => Number(value.trim())).filter((value) => Number.isInteger(value) && value >= 0 && value <= 6);
    const payload = { ...scheduleForm, playlistId: Number(scheduleForm.playlistId), daysOfWeek, priority: Number(scheduleForm.priority), effectiveFrom: scheduleForm.effectiveFrom || null, effectiveUntil: scheduleForm.effectiveUntil || null };
    await runAction(editingScheduleId ? `/api/admin/radio/schedules/${editingScheduleId}` : "/api/admin/radio/schedules", { method: editingScheduleId ? "PUT" : "POST", body: JSON.stringify(payload) }, editingScheduleId ? "Schedule updated." : "Schedule created.");
    setScheduleForm(emptySchedule);
    setEditingScheduleId(null);
    setSaving(false);
  }

  function editSchedule(item: Schedule) {
    setEditingScheduleId(item.id);
    let days = "";
    try { days = (JSON.parse(item.daysOfWeek) as number[]).join(","); } catch { days = ""; }
    setScheduleForm({ name: item.name, playlistId: String(item.playlistId), timezone: item.timezone, daysOfWeek: days, startLocalTime: item.startLocalTime, endLocalTime: item.endLocalTime, programName: item.programName ?? "", priority: String(item.priority), status: item.status, effectiveFrom: item.effectiveFrom ? item.effectiveFrom.slice(0, 10) : "", effectiveUntil: item.effectiveUntil ? item.effectiveUntil.slice(0, 10) : "" });
  }

  async function saveSettings(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    await runAction("/api/admin/radio/settings", { method: "PUT", body: JSON.stringify(settingsForm) }, "Radio settings saved.");
    setSaving(false);
  }

  async function saveEmergency(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    await runAction("/api/admin/radio/emergency", { method: "PUT", body: JSON.stringify({ ...emergencyForm, audioId: emergencyForm.audioId ? Number(emergencyForm.audioId) : null }) }, emergencyForm.enabled
      ? "Emergency editorial settings saved. Broadcast execution is not connected; no live stream was changed."
      : "Emergency editorial settings saved. Editorial mode is off; broadcast execution is not connected and no live stream was changed.");
    setSaving(false);
  }

  return (
    <AdminLayout>
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="flex flex-col justify-between gap-4 border-b border-accent/10 pb-6 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-accent">Radio broadcasting</p>
            <h1 className="mt-2 font-heading text-3xl text-foreground">Radio Suruur FM</h1>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-muted-foreground">GoCast.fm broadcast instructions and the public website player.</p>
          </div>
        </header>

        <section className="rounded-xl border border-accent/15 bg-card/30 p-4 sm:p-6" aria-labelledby="radio-player-heading">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Station name</p>
              <h2 id="radio-player-heading" className="mt-1 font-heading text-2xl text-foreground">Radio Suruur FM</h2>
            </div>
            <div className="rounded-lg border border-accent/15 bg-background/30 px-4 py-3 sm:max-w-sm">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Current website player</p>
              <p className="mt-1 text-sm font-medium text-accent" role="status">GoCast.fm player embedded on /radio</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">Playback availability and on-air status are not verified by this website.</p>
            </div>
          </div>
          <a href="/radio" className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg border border-accent/20 px-4 py-2.5 text-sm text-accent transition-colors hover:border-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
            Open public Radio page <ExternalLink size={14} aria-hidden="true" />
          </a>
        </section>

        <MobileBroadcastGuide audience="admin" />

        {role === "developer" && (
          <button
            type="button"
            data-testid="developer-radio-tools-toggle"
            aria-expanded={showAdvancedControls}
            aria-controls="developer-radio-tools"
            onClick={() => setShowAdvancedControls((visible) => !visible)}
            className="inline-flex min-h-11 items-center rounded-lg border border-accent/20 px-4 py-2.5 text-sm text-muted-foreground transition-colors hover:border-accent/50 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {showAdvancedControls ? "Hide developer-only advanced radio controls" : "Show developer-only advanced radio controls"}
          </button>
        )}

        {developerControlsVisible() && (
          <section id="developer-radio-tools" className="space-y-4 rounded-xl border border-amber-300/20 bg-amber-300/[0.02] p-4 sm:p-6" aria-label="Developer-only legacy Radio controls">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs leading-5 text-amber-200/80">Legacy Radio controls are available to Developers only. They do not configure or control the public GoCast.fm player.</p>
              <button onClick={() => void load(audioPage)} disabled={loading || actionLoading} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-accent/20 px-4 py-2.5 text-sm text-accent transition-colors hover:border-accent disabled:cursor-not-allowed disabled:opacity-50" type="button">{loading ? <LoaderCircle className="animate-spin" size={15} /> : <RefreshCw size={15} />} {loading ? "Refreshing…" : "Refresh legacy data"}</button>
            </div>

            {feedback && <div className="rounded-lg border border-accent/20 bg-accent/5 px-4 py-3 text-sm text-accent" role="status">{feedback}</div>}
            {loadError && <RetryNotice message={loadError} onRetry={() => void load(audioPage)} disabled={loading} />}
            {loading && initialLoadComplete && <div className="flex items-center gap-2 rounded-lg border border-accent/15 bg-card/30 px-4 py-3 text-sm text-muted-foreground" role="status"><LoaderCircle className="animate-spin" size={16} /> Refreshing legacy Radio data…</div>}

            {!initialLoadComplete ? (
              <div className="flex items-center gap-2 rounded-xl border border-accent/15 bg-card/30 p-6 text-sm text-muted-foreground" role="status"><LoaderCircle className="animate-spin" size={18} /> Loading legacy Radio data…</div>
            ) : (

        <details data-testid="advanced-radio-settings" className="group overflow-hidden rounded-xl border border-accent/15 bg-card/20">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent">
            <span className="min-w-0">
              <span className="block font-heading text-lg text-foreground">Advanced Radio Settings</span>
              <span className="mt-1 block text-xs leading-5 text-muted-foreground">Legacy stream, schedule, playlist, audio, and editorial controls. These settings do not control the public GoCast player.</span>
            </span>
            <ChevronRight size={18} className="shrink-0 text-accent transition-transform group-open:rotate-90" aria-hidden="true" />
          </summary>
          <div className="space-y-8 border-t border-accent/10 p-4 sm:p-6">
            <section className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-accent/15 bg-card/40 p-5"><div className="flex items-center gap-3"><Clock3 size={18} className="text-accent" /><span className="text-xs uppercase tracking-widest text-muted-foreground">Schedule timezone</span></div>{scheduleError ? <p className="mt-4 text-sm text-amber-300">{scheduleError}</p> : <><p className="mt-4 text-2xl font-heading">{status?.station?.timezone ?? settings.schedule_timezone ?? "Europe/Berlin"}</p><p className="mt-1 text-sm text-muted-foreground">{schedules.length === 0 ? "No scheduled programs" : `${schedules.length} scheduled ${schedules.length === 1 ? "program" : "programs"}`}</p></>}</div>
              <div className="rounded-xl border border-accent/15 bg-card/40 p-5"><div className="flex items-center gap-3"><CheckCircle2 size={18} className="text-accent" /><span className="text-xs uppercase tracking-widest text-muted-foreground">Total audio records</span></div><p className="mt-4 text-2xl font-heading">{audioCounts?.total ?? "—"}</p><p className="mt-1 text-sm text-muted-foreground">{audioCounts ? `${audioCounts.eligible} broadcast-eligible across the library` : "Counts unavailable"}</p></div>
            </section>

         <section className="rounded-xl border border-accent/15 bg-card/30">
           <div className="border-b border-accent/10 px-5 py-4"><h2 className="font-heading text-xl">Audio library</h2><p className="mt-1 max-w-3xl text-xs leading-5 text-muted-foreground">Review the asset state and broadcast eligibility separately. Eligibility means an item can be added to a future playlist configuration; it does not mean the item is playing.</p></div>
           <form onSubmit={applyAudioFilters} className="grid gap-3 border-b border-accent/10 px-5 py-4 lg:grid-cols-[minmax(240px,1.5fr)_repeat(4,minmax(140px,1fr))_auto_auto]">
             <label className="relative block"><span className="sr-only">Search audio</span><Search size={15} className="pointer-events-none absolute left-3 top-3 text-muted-foreground" /><input value={audioSearchInput} onChange={(event) => setAudioSearchInput(event.target.value)} placeholder="Search title or filename" className="w-full rounded-lg border border-accent/15 bg-background/50 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-accent" /></label>
             <label><span className="sr-only">Broadcast eligibility filter</span><select aria-label="Broadcast eligibility filter" value={audioFilters.eligibility} onChange={(event) => setAudioFilters({ ...audioFilters, eligibility: event.target.value as AudioFilters["eligibility"] })} className="w-full rounded-lg border border-accent/15 bg-background/50 px-3 py-2.5 text-sm"><option value="all">All eligibility</option><option value="eligible">Broadcast eligible</option><option value="ineligible">Not eligible</option></select></label>
             <label><span className="sr-only">Editorial status filter</span><select aria-label="Editorial status filter" value={audioFilters.editorialStatus} onChange={(event) => setAudioFilters({ ...audioFilters, editorialStatus: event.target.value })} className="w-full rounded-lg border border-accent/15 bg-background/50 px-3 py-2.5 text-sm"><option value="">All editorial</option><option value="draft">Draft</option><option value="ready_for_review">Awaiting review</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="archived">Archived</option></select></label>
             <label><span className="sr-only">Processing status filter</span><select aria-label="Processing status filter" value={audioFilters.processingStatus} onChange={(event) => setAudioFilters({ ...audioFilters, processingStatus: event.target.value })} className="w-full rounded-lg border border-accent/15 bg-background/50 px-3 py-2.5 text-sm"><option value="">All processing</option><option value="not_started">Not started</option><option value="processing">Processing</option><option value="ready">Processing complete</option><option value="failed">Failed</option></select></label>
             <label><span className="sr-only">Rights status filter</span><select aria-label="Rights status filter" value={audioFilters.rightsStatus} onChange={(event) => setAudioFilters({ ...audioFilters, rightsStatus: event.target.value })} className="w-full rounded-lg border border-accent/15 bg-background/50 px-3 py-2.5 text-sm"><option value="">All rights</option><option value="cleared">Cleared</option><option value="unknown">Unknown</option><option value="restricted">Restricted</option><option value="expired">Expired</option><option value="takedown">Takedown</option></select></label>
             <button type="submit" className="inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-3 py-2.5 text-sm text-accent-foreground"><Filter size={15} /> Apply</button>
             <button type="button" onClick={clearAudioFilters} disabled={!hasAudioFilters(audioFilters) && !audioSearchInput} className="rounded-lg border border-accent/20 px-3 py-2.5 text-sm text-accent disabled:cursor-not-allowed disabled:opacity-40">Clear</button>
           </form>
          {audioError && <RetryNotice message={audioError} onRetry={() => void loadAudio(audioPage)} disabled={audioPageLoading} />}
           {audioPageLoading && !audioPagination ? <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground" role="status"><LoaderCircle className="animate-spin" size={16} /> Loading Radio records…</div> : !audioError && audio.length === 0 ? <p className="p-6 text-sm text-muted-foreground">{audioEmptyMessage(audioFilters)}</p> : audio.length > 0 && audioPagination ? <AudioTable audio={audio} pagination={audioPagination} pageLoading={audioPageLoading} actionLoading={actionLoading} onApprove={(id) => { void approveAudio(id); }} onReject={(id) => { void rejectAudio(id); }} onArchive={(id) => { void archiveAudio(id); }} onPage={(page) => { void loadAudio(page); }} /> : null}
        </section>

        <section className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
           <div className="rounded-xl border border-accent/15 bg-card/30 p-5"><div className="flex items-center justify-between gap-3"><div><h2 className="font-heading text-xl">{editingPlaylistId ? "Edit playlist" : "Create playlist"}</h2><span className="mt-2 inline-flex rounded-full border border-amber-400/25 bg-amber-400/5 px-2.5 py-1 text-xs text-amber-300">AutoDJ: Not connected</span></div></div><p className="mt-3 text-xs leading-5 text-muted-foreground">Playlists and their schedules are configuration for a future automation runtime. These settings do not control the live stream.</p><form onSubmit={savePlaylist} className="mt-5 space-y-3"><input required placeholder="Playlist name" value={playlistForm.name} onChange={(event) => setPlaylistForm({ ...playlistForm, name: event.target.value })} className="w-full rounded-lg border border-accent/15 bg-background/50 px-3 py-2.5 text-sm" /><textarea placeholder="Description" value={playlistForm.description} onChange={(event) => setPlaylistForm({ ...playlistForm, description: event.target.value })} rows={3} className="w-full rounded-lg border border-accent/15 bg-background/50 px-3 py-2.5 text-sm" /><div className="grid gap-3 sm:grid-cols-3"><select value={playlistForm.mode} onChange={(event) => setPlaylistForm({ ...playlistForm, mode: event.target.value })} className="rounded-lg border border-accent/15 bg-background/50 px-3 py-2.5 text-sm"><option value="sequential">Sequential</option><option value="random">Random / shuffle</option><option value="weighted">Weighted</option></select><select value={playlistForm.status} onChange={(event) => setPlaylistForm({ ...playlistForm, status: event.target.value })} className="rounded-lg border border-accent/15 bg-background/50 px-3 py-2.5 text-sm"><option value="draft">Draft</option><option value="active">Active</option><option value="archived">Archived</option></select><input type="number" min="1" placeholder="Repeat window" value={playlistForm.repeatWindow} onChange={(event) => setPlaylistForm({ ...playlistForm, repeatWindow: event.target.value })} className="rounded-lg border border-accent/15 bg-background/50 px-3 py-2.5 text-sm" /></div><div className="flex gap-2"><button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm text-accent-foreground disabled:opacity-50"><Save size={15} />{saving ? "Saving…" : editingPlaylistId ? "Save playlist" : "Create playlist"}</button>{editingPlaylistId && <button type="button" onClick={() => { setEditingPlaylistId(null); setPlaylistForm(emptyPlaylist); }} className="rounded-lg border border-accent/20 px-4 py-2.5 text-sm text-accent">Cancel</button>}</div></form><div className="mt-7 space-y-2">{playlistError ? <RetryNotice message={playlistError} onRetry={() => void load(audioPage)} disabled={loading} /> : playlists.length === 0 ? <p className="text-sm text-muted-foreground">No playlists are currently configured.</p> : playlists.map((item) => <div key={item.id} className={`rounded-lg border px-3 py-3 ${selectedPlaylistId === item.id ? "border-accent/50 bg-accent/5" : "border-accent/10"}`}><div className="flex items-center justify-between gap-3"><button type="button" onClick={() => void loadPlaylistItems(item.id)} className="text-left font-medium hover:text-accent">{item.name}</button><span className={`text-xs ${statusTone(item.status)}`}>{configurationStatus(item.status)} · {item.mode}</span></div><div className="mt-2 flex gap-3 text-xs text-muted-foreground"><button type="button" onClick={() => editPlaylist(item)} className="hover:text-accent">Edit</button><button type="button" onClick={() => void loadPlaylistItems(item.id)} className="hover:text-accent">Manage items</button></div></div>)}</div></div>
             <div className="rounded-xl border border-accent/15 bg-card/30 p-5"><h2 className="font-heading text-xl">Configured playlist items</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">Only broadcast-eligible audio can be selected. Adding an item records playlist configuration; it does not start playback.</p>{selectedPlaylistId ? <><form onSubmit={addPlaylistItem} className="mt-5 flex gap-2"><select required aria-label="Select eligible audio" value={itemAudioId} onChange={(event) => setItemAudioId(event.target.value)} className="min-w-0 flex-1 rounded-lg border border-accent/15 bg-background/50 px-3 py-2.5 text-sm"><option value="">Select eligible audio</option>{eligibleAudio.filter((item) => !playlistItems.some((existing) => existing.audioId === item.id)).map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select><button type="submit" disabled={actionLoading || playlistItemsLoading || eligibleAudioLoading || Boolean(eligibleAudioError)} title={eligibleAudioError ?? undefined} className="rounded-lg bg-accent px-3 py-2.5 text-sm text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50">Add</button></form>{eligibleAudioError && <p className="mt-2 text-xs text-amber-300" role="alert">{eligibleAudioError}</p>}<div className="mt-5 space-y-2">{playlistItemsLoading ? <div className="flex items-center gap-2 p-5 text-sm text-muted-foreground" role="status"><LoaderCircle className="animate-spin" size={16} /> Loading playlist items…</div> : playlistItemsError ? <RetryNotice message={playlistItemsError} onRetry={() => void loadPlaylistItems(selectedPlaylistId)} disabled={playlistItemsLoading} /> : playlistItems.length === 0 ? <p className="rounded-lg border border-dashed border-accent/20 p-5 text-sm text-muted-foreground">{eligibleAudioError ? "Eligible audio could not be loaded." : eligibleAudio.length === 0 ? "No broadcast-eligible audio is currently available to add." : "No audio items are configured in this playlist."}</p> : playlistItems.map((item, index) => <div key={item.id} className="flex items-start gap-2 rounded-lg border border-accent/10 px-3 py-3"><span className="w-6 pt-0.5 text-xs text-muted-foreground">{index + 1}</span><div className="min-w-0 flex-1"><p className="truncate text-sm">{item.title}</p><p className="text-xs text-muted-foreground">{item.category ?? "Uncategorized"} · {displayStatus(item.rightsStatus)} · {item.enabled ? "Included in configuration" : "Excluded from configuration"}</p>{item.broadcastEligible === false && <div className="mt-2"><p className="text-xs font-medium text-amber-300">Not currently broadcast eligible</p><ul className="mt-1 space-y-0.5 text-xs leading-5 text-muted-foreground">{(item.broadcastEligibilityReasons ?? []).map((reason) => <li key={reason}>• {eligibilityReasonLabel(reason)}</li>)}</ul></div>}</div><button type="button" title="Move up" disabled={index === 0 || actionLoading} onClick={() => void moveItem(index, -1)} className="rounded border border-accent/15 p-1.5 text-accent disabled:opacity-30"><ArrowUp size={14} /></button><button type="button" title="Move down" disabled={index === playlistItems.length - 1 || actionLoading} onClick={() => void moveItem(index, 1)} className="rounded border border-accent/15 p-1.5 text-accent disabled:opacity-30"><ArrowDown size={14} /></button><button type="button" disabled={actionLoading} onClick={() => void removePlaylistItem(item.id)} className="rounded border border-destructive/20 p-1.5 text-destructive disabled:opacity-30">Remove from configuration</button></div>)}</div></> : <p className="mt-5 rounded-lg border border-dashed border-accent/20 p-5 text-sm text-muted-foreground">Select a playlist to manage its configured items.</p>}</div>
        </section>

         <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
           <div className="rounded-xl border border-accent/15 bg-card/30 p-5">
             <h2 className="font-heading text-xl">{editingScheduleId ? "Edit schedule" : "Create schedule"}</h2>
             <p className="mt-1 text-xs text-muted-foreground">Schedule data only. Timezone is stored with each record; no real-time scheduler is running.</p>
             <form onSubmit={saveSchedule} className="mt-5 grid gap-3 sm:grid-cols-2">
               <label className="space-y-1.5"><span className="text-xs uppercase tracking-wider text-muted-foreground">Schedule name</span><input required placeholder="Schedule name" value={scheduleForm.name} onChange={(event) => setScheduleForm({ ...scheduleForm, name: event.target.value })} className="w-full rounded-lg border border-accent/15 bg-background/50 px-3 py-2.5 text-sm" /></label>
               <label className="space-y-1.5"><span className="text-xs uppercase tracking-wider text-muted-foreground">Program title</span><input placeholder="Program title" value={scheduleForm.programName} onChange={(event) => setScheduleForm({ ...scheduleForm, programName: event.target.value })} className="w-full rounded-lg border border-accent/15 bg-background/50 px-3 py-2.5 text-sm" /></label>
               <label className="space-y-1.5"><span className="text-xs uppercase tracking-wider text-muted-foreground">Playlist</span><select required value={scheduleForm.playlistId} onChange={(event) => setScheduleForm({ ...scheduleForm, playlistId: event.target.value })} className="w-full rounded-lg border border-accent/15 bg-background/50 px-3 py-2.5 text-sm"><option value="">Select playlist</option>{playlists.filter((item) => item.status !== "archived").map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
               <label className="space-y-1.5"><span className="text-xs uppercase tracking-wider text-muted-foreground">Status</span><select value={scheduleForm.status} onChange={(event) => setScheduleForm({ ...scheduleForm, status: event.target.value })} className="w-full rounded-lg border border-accent/15 bg-background/50 px-3 py-2.5 text-sm"><option value="draft">Draft</option><option value="active">Active</option><option value="archived">Archived</option></select></label>
               <label className="space-y-1.5"><span className="text-xs uppercase tracking-wider text-muted-foreground">Start time</span><input type="time" required value={scheduleForm.startLocalTime} onChange={(event) => setScheduleForm({ ...scheduleForm, startLocalTime: event.target.value })} className="w-full rounded-lg border border-accent/15 bg-background/50 px-3 py-2.5 text-sm" /></label>
               <label className="space-y-1.5"><span className="text-xs uppercase tracking-wider text-muted-foreground">End time</span><input type="time" required value={scheduleForm.endLocalTime} onChange={(event) => setScheduleForm({ ...scheduleForm, endLocalTime: event.target.value })} className="w-full rounded-lg border border-accent/15 bg-background/50 px-3 py-2.5 text-sm" /></label>
               <label className="space-y-1.5"><span className="text-xs uppercase tracking-wider text-muted-foreground">Timezone</span><input value={scheduleForm.timezone} onChange={(event) => setScheduleForm({ ...scheduleForm, timezone: event.target.value })} className="w-full rounded-lg border border-accent/15 bg-background/50 px-3 py-2.5 text-sm" /></label>
               <label className="space-y-1.5"><span className="text-xs uppercase tracking-wider text-muted-foreground">Days</span><input placeholder="0–6, comma separated (0 = Sunday)" value={scheduleForm.daysOfWeek} onChange={(event) => setScheduleForm({ ...scheduleForm, daysOfWeek: event.target.value })} className="w-full rounded-lg border border-accent/15 bg-background/50 px-3 py-2.5 text-sm" /><span className="block text-xs text-muted-foreground">Sunday = 0 · Saturday = 6</span></label>
               <label className="space-y-1.5"><span className="text-xs uppercase tracking-wider text-muted-foreground">Priority</span><input type="number" min="0" placeholder="Priority" value={scheduleForm.priority} onChange={(event) => setScheduleForm({ ...scheduleForm, priority: event.target.value })} className="w-full rounded-lg border border-accent/15 bg-background/50 px-3 py-2.5 text-sm" /></label>
               <label className="space-y-1.5"><span className="text-xs uppercase tracking-wider text-muted-foreground">Effective from</span><input type="date" value={scheduleForm.effectiveFrom} onChange={(event) => setScheduleForm({ ...scheduleForm, effectiveFrom: event.target.value })} className="w-full rounded-lg border border-accent/15 bg-background/50 px-3 py-2.5 text-sm" /></label>
               <label className="space-y-1.5"><span className="text-xs uppercase tracking-wider text-muted-foreground">Effective until</span><input type="date" value={scheduleForm.effectiveUntil} onChange={(event) => setScheduleForm({ ...scheduleForm, effectiveUntil: event.target.value })} className="w-full rounded-lg border border-accent/15 bg-background/50 px-3 py-2.5 text-sm" /></label>
               <div className="sm:col-span-2 flex flex-wrap gap-2"><button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm text-accent-foreground disabled:opacity-50"><Save size={15} />{editingScheduleId ? "Save schedule" : "Create schedule"}</button>{editingScheduleId && <button type="button" onClick={() => { setEditingScheduleId(null); setScheduleForm(emptySchedule); }} className="rounded-lg border border-accent/20 px-4 py-2.5 text-sm text-accent">Cancel</button>}</div>
             </form>
           </div>
             <div className="rounded-xl border border-accent/15 bg-card/30 p-5"><h2 className="font-heading text-xl">Configured schedules</h2><p className="mt-1 text-xs text-muted-foreground">Schedules define editorial windows only; no real-time scheduler is running.</p><div className="mt-4 space-y-2">{scheduleError ? <RetryNotice message={scheduleError} onRetry={() => void load(audioPage)} disabled={loading} /> : schedules.length === 0 ? <p className="text-sm text-muted-foreground">No programs are currently scheduled.</p> : schedules.map((item) => <div key={item.id} className="rounded-lg border border-accent/10 px-3 py-3"><div className="flex items-center justify-between gap-3"><span>{item.programName || item.name}</span><span className={`text-xs ${statusTone(item.status)}`}>{configurationStatus(item.status)}</span></div><p className="mt-1 text-xs text-muted-foreground"><span className="font-medium text-foreground/80">Start</span> {item.startLocalTime} <span className="mx-1">·</span> <span className="font-medium text-foreground/80">End</span> {item.endLocalTime} <span className="mx-1">·</span> {daysToString(item.daysOfWeek)} <span className="mx-1">·</span> {item.timezone}</p>{(item.effectiveFrom || item.effectiveUntil) && <p className="mt-1 text-xs text-muted-foreground">Effective {item.effectiveFrom?.slice(0, 10) ?? "now"} → {item.effectiveUntil?.slice(0, 10) ?? "open-ended"}</p>}<button type="button" onClick={() => editSchedule(item)} className="mt-2 text-xs text-accent hover:underline">Edit schedule</button></div>)}</div></div>
        </section>

          <section className="rounded-xl border border-accent/15 bg-card/30 p-5">
            <div className="flex items-start gap-3">
              <ShieldAlert size={19} className="mt-0.5 text-accent" />
              <div>
                <h2 className="font-heading text-xl">Emergency editorial mode</h2>
                <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">This controls emergency editorial configuration only. <strong className="font-medium text-foreground">Broadcast execution: Not connected.</strong> Saving these settings will not change the live stream.</p>
              </div>
            </div>
            {emergencyError ? <p className="mt-5 rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-300" role="alert">{emergencyError}</p> : <form onSubmit={saveEmergency} className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-accent/15 px-3 py-3 text-sm sm:col-span-2">
                <label className="flex items-center gap-3">
                  <input type="checkbox" aria-label="Enable emergency editorial mode" checked={emergencyForm.enabled} onChange={(event) => setEmergencyForm({ ...emergencyForm, enabled: event.target.checked })} />
                  <span>Enable emergency editorial mode</span>
                </label>
                <span className={`text-xs font-medium uppercase tracking-wider ${emergencyForm.enabled ? "text-amber-300" : "text-muted-foreground"}`}>Emergency editorial mode: {emergencyForm.enabled ? "On" : "Off"}</span>
              </div>
              <div className="grid gap-3 rounded-lg border border-accent/15 p-3 sm:col-span-2 sm:grid-cols-2">
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Editorial state</p>
                  <p className={`mt-1 text-sm font-medium ${emergencyForm.enabled ? "text-amber-300" : "text-muted-foreground"}`}>Emergency editorial mode: {emergencyForm.enabled ? "On" : "Off"}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Execution state</p>
                  <p className="mt-1 text-sm font-medium text-muted-foreground">Broadcast execution: Not connected</p>
                </div>
              </div>
              <label className="space-y-1.5"><span className="text-xs uppercase tracking-wider text-muted-foreground">Emergency content type</span><select value={emergencyForm.type} onChange={(event) => setEmergencyForm({ ...emergencyForm, type: event.target.value })} className="w-full rounded-lg border border-accent/15 bg-background/50 px-3 py-2.5 text-sm"><option value="poetry">Poetry / content</option><option value="message">Message</option><option value="playlist">Playlist audio</option></select></label>
               {emergencyForm.type === "playlist" ? <label className="space-y-1.5"><span className="text-xs uppercase tracking-wider text-muted-foreground">Approved emergency audio</span><select aria-label="Approved emergency audio" value={emergencyForm.audioId} onChange={(event) => { setEmergencyForm({ ...emergencyForm, audioId: event.target.value }); void loadEligibleAudio(); }} className="w-full rounded-lg border border-accent/15 bg-background/50 px-3 py-2.5 text-sm"><option value="">Select eligible audio</option>{eligibleAudio.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select>{eligibleAudioError ? <span className="block text-xs text-amber-300">{eligibleAudioError}</span> : <><span className="block text-xs text-muted-foreground">Only approved, processed, rights-cleared audio can be selected.</span><span className="block text-xs text-muted-foreground">Selection records editorial configuration; it does not start playback.</span></>}</label> : <label className="space-y-1.5 sm:col-span-1"><span className="text-xs uppercase tracking-wider text-muted-foreground">Emergency message (editorial content)</span><textarea placeholder="Emergency editorial message" value={emergencyForm.message} onChange={(event) => setEmergencyForm({ ...emergencyForm, message: event.target.value })} rows={2} className="w-full rounded-lg border border-accent/15 bg-background/50 px-3 py-2.5 text-sm" /></label>}
              <div className="sm:col-span-2 flex flex-wrap items-center gap-3"><button type="submit" disabled={saving} className="rounded-lg bg-accent px-4 py-2.5 text-sm text-accent-foreground disabled:opacity-50">{saving ? "Saving…" : "Save editorial settings"}</button><span className="text-xs text-muted-foreground">Broadcast execution: Not connected</span></div>
            </form>}
          </section>

          <section className="rounded-xl border border-accent/15 bg-card/30 p-5"><div className="flex items-start gap-3"><ShieldAlert size={19} className="mt-0.5 text-accent" /><div><h2 className="font-heading text-xl">Stream configuration</h2><p className="mt-1 text-sm text-muted-foreground">Only approved non-secret settings are shown. No stream is assumed to be live.</p>{casterFm.configured && <p className="mt-2 text-xs leading-5 text-muted-foreground">Legacy Caster.fm options are not used by the current GoCast.fm player and must not be treated as current broadcast settings.</p>}</div></div>{settingsError ? <p className="mt-5 rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-300">{settingsError}</p> : <form onSubmit={saveSettings} className="mt-6 grid gap-4 sm:grid-cols-2">{settingFields.map(([key, label]) => <label key={key} className="space-y-2"><span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>{key === "enabled" ? <select value={settingsForm[key] ?? "false"} onChange={(event) => setSettingsForm((current) => ({ ...current, [key]: event.target.value }))} className="w-full rounded-lg border border-accent/15 bg-background/50 px-3 py-2.5 text-sm text-foreground outline-none focus:border-accent"><option value="true">Enabled</option><option value="false">Disabled</option></select> : <input value={settingsForm[key] ?? (key === "station_name" ? "Radio Suruur FM" : key === "stream_hostname" ? "radio.suruureman.com" : key === "stream_protocol" ? "https" : key === "stream_format" ? "MP3" : key === "stream_bitrate_kbps" ? "96" : key === "schedule_timezone" ? "Europe/Berlin" : "")} onChange={(event) => setSettingsForm((current) => ({ ...current, [key]: event.target.value }))} className="w-full rounded-lg border border-accent/15 bg-background/50 px-3 py-2.5 text-sm text-foreground outline-none focus:border-accent" />}</label>)}<div className="sm:col-span-2 flex flex-wrap items-center gap-3"><button type="submit" disabled={saving || role === "contributor"} className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50"><Save size={15} />{saving ? "Saving…" : "Save settings"}</button>{status?.streamUrl && !casterFm.configured && <a href={status.streamUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-xs text-accent hover:underline"><ExternalLink size={13} /> Open configured stream</a>}</div></form>}</section>
          </div>
        </details>
            )}
          </section>
        )}
       </div>
    </AdminLayout>
  );
}