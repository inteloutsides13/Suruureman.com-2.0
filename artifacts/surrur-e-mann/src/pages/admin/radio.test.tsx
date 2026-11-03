import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminRadio from "./radio";

const mocks = vi.hoisted(() => ({
  adminFetch: vi.fn(),
  useAdminAuth: vi.fn(),
  useRadioPlayer: vi.fn(),
  getCasterFmConfig: vi.fn(),
}));

vi.mock("@/hooks/use-admin-auth", () => ({
  adminFetch: mocks.adminFetch,
  useAdminAuth: mocks.useAdminAuth,
}));

vi.mock("@/hooks/use-radio-player", () => ({
  RadioPlayerProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  useRadioPlayer: mocks.useRadioPlayer,
}));

vi.mock("@/lib/casterfm-config", () => ({
  getCasterFmConfig: mocks.getCasterFmConfig,
}));

vi.mock("@/components/admin-layout", () => ({
  AdminLayout: ({ children }: { children: ReactNode }) => <div data-testid="admin-layout">{children}</div>,
}));

type AudioFixture = {
  id: number;
  title: string;
  titleUrdu: string;
  description: string;
  category: string;
  originalFilename: string;
  editorialStatus: string;
  processingStatus: string;
  rightsStatus: string;
  rightsNotes: string | null;
  rightsValidFrom: string | null;
  rightsValidUntil: string | null;
  rejectionReason: string | null;
  durationMs: number;
  broadcastEligible: boolean;
  broadcastEligibilityReasons?: string[];
};

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function audioFixture(id: number, title: string): AudioFixture {
  return {
    id,
    title,
    titleUrdu: "",
    description: "",
    category: "poetry",
    originalFilename: `${title.toLowerCase().replaceAll(" ", "-")}.mp3`,
    editorialStatus: "pending",
    processingStatus: "ready",
    rightsStatus: "cleared",
    rightsNotes: null,
    rightsValidFrom: null,
    rightsValidUntil: null,
    rejectionReason: null,
    durationMs: 120_000,
    broadcastEligible: true,
  };
}

const firstAudio = audioFixture(1, "First audio");
const secondAudio = audioFixture(2, "Second audio");
const playlistFixture = {
  id: 1,
  name: "Evening poetry",
  description: "Configured poetry selections",
  status: "active",
  mode: "sequential",
  repeatWindow: null,
};
const playlistItemFixture = {
  id: 1,
  playlistId: 1,
  audioId: firstAudio.id,
  position: 1,
  enabled: true,
  title: firstAudio.title,
  category: firstAudio.category,
  editorialStatus: "approved",
  processingStatus: "ready",
  rightsStatus: "cleared",
};
const scheduleFixture = {
  id: 1,
  name: "Evening schedule",
  playlistId: playlistFixture.id,
  status: "active",
  timezone: "Europe/Berlin",
  daysOfWeek: "[1,2,3,4,5]",
  startLocalTime: "18:00",
  endLocalTime: "19:00",
  programName: "Evening poetry",
  priority: 0,
  effectiveFrom: null,
  effectiveUntil: null,
};

function audioPayload(audio: AudioFixture[], page = 1, total = audio.length, eligible = audio.length) {
  const pageSize = 50;
  const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);
  return {
    audio,
    limit: pageSize,
    offset: (page - 1) * pageSize,
    counts: { total, eligible },
    pagination: {
      page,
      pageSize,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    },
  };
}

function adminResponse(path: string) {
  if (path.includes("/audio/")) return response({});
  if (path.startsWith("/api/admin/radio/audio")) return response(audioPayload([firstAudio], 1, 2, 1));
  if (path === "/api/admin/radio/playlists") return response({ playlists: [] });
  if (path.startsWith("/api/admin/radio/playlists/")) return response({ items: [] });
  if (path === "/api/admin/radio/schedules") return response({ schedules: [] });
  if (path === "/api/admin/radio/settings") return response({ settings: [{ key: "schedule_timezone", value: "Europe/Berlin" }] });
  if (path === "/api/admin/radio/emergency") return response({ enabled: false, type: "message", audioId: null, message: null, broadcastExecution: "not_available" });
  return response({});
}

function statusResponse() {
  return response({ available: false, message: "Radio stream is not configured.", streamUrl: null });
}

function configureSuccessfulApi() {
  mocks.adminFetch.mockImplementation(async (path: string) => adminResponse(path));
  vi.stubGlobal("fetch", vi.fn(async () => statusResponse()));
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function renderRadio({ openAdvanced = true }: { openAdvanced?: boolean } = {}) {
  const rendered = render(<AdminRadio />);
  if (openAdvanced) {
    let requested = false;
    const openWhenAvailable = () => {
      if (!requested) {
        const toggle = rendered.container.querySelector<HTMLButtonElement>("[data-testid='developer-radio-tools-toggle']");
        if (!toggle) return false;
        fireEvent.click(toggle);
        requested = true;
      }
      const panel = rendered.container.querySelector<HTMLDetailsElement>("[data-testid='advanced-radio-settings']");
      if (!panel) return false;
      panel.open = true;
      return true;
    };

    if (!openWhenAvailable()) {
      const observer = new MutationObserver(() => {
        if (openWhenAvailable()) observer.disconnect();
      });
      observer.observe(rendered.container, { childList: true, subtree: true });
    }
  }
  return rendered;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  mocks.useAdminAuth.mockReturnValue({ role: "developer" });
  mocks.useRadioPlayer.mockReturnValue({
    status: "offline",
    streamUrl: null,
    isLive: false,
    playback: "idle",
    message: "Radio stream is not configured.",
    station: null,
    schedules: [],
    retry: vi.fn(),
    togglePlayback: vi.fn(),
  });
  mocks.getCasterFmConfig.mockReturnValue({ publicToken: null, channelId: null, configured: false });
  configureSuccessfulApi();
});

describe("initial loading and empty states", () => {
  it("shows the GoCast player and broadcasting guide to normal admins without legacy controls", () => {
    mocks.useAdminAuth.mockReturnValue({ role: "admin" });
    renderRadio({ openAdvanced: false });

    expect(screen.getByRole("heading", { name: "Radio Suruur FM", level: 1 })).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent("GoCast.fm player embedded on /radio");
    expect(screen.getByRole("link", { name: /Open public Radio page/ })).toHaveAttribute("href", "/radio");
    expect(screen.getByRole("heading", { name: "Broadcasting instructions" })).toBeVisible();
    expect(screen.getByText("Open the GoCast.fm station dashboard.")).toBeVisible();
    expect(screen.getByText("Start the station/AutoDJ or connect an approved broadcaster.")).toBeVisible();
    expect(screen.getByText("Open the public /radio page and test playback in the player.")).toBeVisible();
    expect(screen.getByText("Stop broadcasting when finished.")).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Troubleshooting" })).not.toBeInTheDocument();
    expect(screen.queryByText(/To be supplied by the Radio administrator/)).not.toBeInTheDocument();
    expect(screen.queryByTestId("advanced-radio-settings")).not.toBeInTheDocument();
    expect(screen.queryByTestId("developer-radio-tools-toggle")).not.toBeInTheDocument();
    expect(screen.queryByText(/Caster\.fm|Cool Mic/i)).not.toBeInTheDocument();
    expect(mocks.adminFetch).not.toHaveBeenCalled();
    expect(mocks.getCasterFmConfig).not.toHaveBeenCalled();
  });

  it("keeps advanced Radio controls behind a Developer-only reveal", async () => {
    const user = userEvent.setup();
    renderRadio({ openAdvanced: false });

    expect(screen.queryByTestId("advanced-radio-settings")).not.toBeInTheDocument();
    expect(mocks.adminFetch).not.toHaveBeenCalled();
    await user.click(screen.getByTestId("developer-radio-tools-toggle"));

    const advancedSettings = await screen.findByTestId("advanced-radio-settings") as HTMLDetailsElement;
    expect(advancedSettings.open).toBe(false);
    await user.click(screen.getByText("Advanced Radio Settings"));
    expect(await screen.findByRole("heading", { name: "Audio library" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Emergency editorial mode" })).toBeInTheDocument();
  });

  it("announces initial loading and then renders successful data", async () => {
    const gate = deferred<void>();
    mocks.adminFetch.mockImplementation(async (path: string) => {
      await gate.promise;
      return adminResponse(path);
    });
    vi.stubGlobal("fetch", vi.fn(async () => {
      await gate.promise;
      return statusResponse();
    }));

    renderRadio();
    expect(screen.getByText("Loading legacy Radio data…")).toBeInTheDocument();

    gate.resolve();
    expect(await screen.findByText("First audio")).toBeInTheDocument();
    expect(screen.queryByText("Loading legacy Radio data…")).not.toBeInTheDocument();
    expect(screen.getByText("1 broadcast-eligible across the library")).toBeInTheDocument();
  });

  it("shows successful empty audio, playlist, and schedule results without an error", async () => {
    mocks.adminFetch.mockImplementation(async (path: string) => {
      if (path.startsWith("/api/admin/radio/audio")) return response(audioPayload([], 1, 0, 0));
      return adminResponse(path);
    });

    renderRadio();

    expect(await screen.findByText("No Radio audio records are currently available.")).toBeInTheDocument();
    expect(screen.getByText("No playlists are currently configured.")).toBeInTheDocument();
    expect(screen.getByText("No programs are currently scheduled.")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByText(/could not be loaded/i)).not.toBeInTheDocument();
  });
});

describe("AutoDJ configuration messaging", () => {
  it("distinguishes playlist and schedule configuration from an unconnected runtime", async () => {
    mocks.adminFetch.mockImplementation(async (path: string) => {
      if (path === "/api/admin/radio/playlists") return response({ playlists: [playlistFixture] });
      if (path === "/api/admin/radio/playlists/1") return response({ playlist: playlistFixture, items: [playlistItemFixture] });
      if (path === "/api/admin/radio/schedules") return response({ schedules: [scheduleFixture] });
      return adminResponse(path);
    });

    const user = userEvent.setup();
    renderRadio();

    expect(await screen.findByRole("button", { name: "Evening poetry" })).toBeInTheDocument();
    expect(screen.getByText("AutoDJ: Not connected")).toBeInTheDocument();
    expect(screen.getByText(/Playlists and their schedules are configuration for a future automation runtime/)).toBeInTheDocument();
    expect(screen.getAllByText("Active configuration · sequential").length).toBeGreaterThan(0);
    expect(screen.getByText("Configured schedules")).toBeInTheDocument();
    expect(screen.queryByText(/AutoDJ.*(playing|live|on air)/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /start autodj|stop autodj|start broadcast|stop broadcast/i })).not.toBeInTheDocument();

    await user.click(await screen.findByRole("button", { name: "Evening poetry" }));

    expect(await screen.findByText("Configured playlist items")).toBeInTheDocument();
    expect(screen.getByText(/Included in configuration/)).toBeInTheDocument();
    expect(screen.queryByText(/now playing|playing now|live playlist|current track/i)).not.toBeInTheDocument();
  });

  it("explains when no eligible audio is available instead of calling the playlist ready", async () => {
    mocks.adminFetch.mockImplementation(async (path: string) => {
      if (path.startsWith("/api/admin/radio/audio")) return response(audioPayload([], 1, 0, 0));
      if (path === "/api/admin/radio/playlists") return response({ playlists: [playlistFixture] });
      if (path === "/api/admin/radio/playlists/1") return response({ playlist: playlistFixture, items: [] });
      return adminResponse(path);
    });

    const user = userEvent.setup();
    renderRadio();

    await user.click(await screen.findByRole("button", { name: "Evening poetry" }));

    expect(await screen.findByText("No broadcast-eligible audio is currently available to add.")).toBeInTheDocument();
    expect(screen.queryByText(/AutoDJ.*(ready|playing|live|on air)/i)).not.toBeInTheDocument();
  });
});

describe("initial request failures and retry", () => {
  it("treats a non-OK audio response as an error rather than empty data", async () => {
    let audioCalls = 0;
    mocks.adminFetch.mockImplementation(async (path: string) => {
      if (path.startsWith("/api/admin/radio/audio")) {
        audioCalls += 1;
        return audioCalls === 1 ? response({ detail: "internal database error" }, 500) : adminResponse(path);
      }
      return adminResponse(path);
    });

    renderRadio();

    expect(await screen.findByText("Radio audio records could not be loaded.")).toBeInTheDocument();
    expect(screen.queryByText("No Radio audio records are currently available.")).not.toBeInTheDocument();
    expect(screen.queryByText("internal database error")).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Retry Radio request" }).length).toBeGreaterThan(0);
  });

  it("treats a network rejection as an error and clears loading", async () => {
    let audioCalls = 0;
    mocks.adminFetch.mockImplementation(async (path: string) => {
      if (path.startsWith("/api/admin/radio/audio")) {
        audioCalls += 1;
        if (audioCalls === 1) throw new Error("socket exploded");
      }
      return adminResponse(path);
    });

    renderRadio();

    expect(await screen.findByText("Radio audio records could not be loaded.")).toBeInTheDocument();
    expect(screen.queryByText("Loading legacy Radio data…")).not.toBeInTheDocument();
    expect(screen.queryByText("No Radio audio records are currently available.")).not.toBeInTheDocument();
  });

  it("recovers from a failed initial request when Retry succeeds", async () => {
    let audioCalls = 0;
    mocks.adminFetch.mockImplementation(async (path: string) => {
      if (path.startsWith("/api/admin/radio/audio")) {
        audioCalls += 1;
        return audioCalls === 1 ? response({}, 500) : adminResponse(path);
      }
      return adminResponse(path);
    });

    const user = userEvent.setup();
    renderRadio();
    expect(await screen.findByText("Radio audio records could not be loaded.")).toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: "Retry Radio request" })[0]);

    expect(await screen.findByText("First audio")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText("Some Radio data could not be loaded. Existing data remains visible where available.")).not.toBeInTheDocument());
  });

  it("keeps the error and retry available when Retry fails again", async () => {
    mocks.adminFetch.mockImplementation(async (path: string) => {
      if (path.startsWith("/api/admin/radio/audio")) return response({}, 500);
      return adminResponse(path);
    });

    const user = userEvent.setup();
    renderRadio();
    expect(await screen.findByText("Radio audio records could not be loaded.")).toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: "Retry Radio request" })[0]);

    expect(await screen.findByText("Radio audio records could not be loaded.")).toBeInTheDocument();
    expect(screen.queryByText("No Radio audio records are currently available.")).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Retry Radio request" }).length).toBeGreaterThan(0);
  });

  it("shows a permission error for a 403 response instead of an empty state", async () => {
    mocks.adminFetch.mockImplementation(async (path: string) => {
      if (path.startsWith("/api/admin/radio/audio")) return response({}, 403);
      return adminResponse(path);
    });

    renderRadio();

    expect(await screen.findByText("You do not have permission to view Radio audio.")).toBeInTheDocument();
    expect(screen.queryByText("No Radio audio records are currently available.")).not.toBeInTheDocument();
  });
});

describe("server-backed pagination", () => {
  it("loads next and previous pages with server totals, eligibility counts, and range metadata", async () => {
    mocks.adminFetch.mockImplementation(async (path: string) => {
      if (path.includes("page=2")) return response(audioPayload([secondAudio], 2, 100, 1));
      if (path.startsWith("/api/admin/radio/audio")) return response(audioPayload([firstAudio], 1, 100, 1));
      return adminResponse(path);
    });

    const user = userEvent.setup();
    renderRadio();
    expect(await screen.findByText("First audio")).toBeInTheDocument();
    expect(screen.getByText("Showing 1–50 of 100 total records")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Next/ }));

    expect(await screen.findByText("Second audio")).toBeInTheDocument();
    expect(screen.getByText("Page 2 of 2")).toBeInTheDocument();
    expect(screen.getByText("Showing 51–100 of 100 total records")).toBeInTheDocument();
    expect(mocks.adminFetch).toHaveBeenCalledWith("/api/admin/radio/audio?page=2&pageSize=50");

    await user.click(screen.getByRole("button", { name: /Previous/ }));

    expect(await screen.findByText("First audio")).toBeInTheDocument();
    expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();
  });

  it("preserves the last successful page and makes a failed page retryable", async () => {
    const pageRequest = deferred<Response>();
    let pageTwoCalls = 0;
    mocks.adminFetch.mockImplementation(async (path: string) => {
      if (path.includes("page=2")) {
        pageTwoCalls += 1;
        if (pageTwoCalls === 1) return pageRequest.promise;
        return response(audioPayload([secondAudio], 2, 100, 1));
      }
      if (path.startsWith("/api/admin/radio/audio")) return response(audioPayload([firstAudio], 1, 100, 1));
      return adminResponse(path);
    });

    const user = userEvent.setup();
    renderRadio();
    expect(await screen.findByText("First audio")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Next/ }));
    await waitFor(() => expect(pageTwoCalls).toBe(1));
    expect(screen.getByText("First audio")).toBeInTheDocument();

    pageRequest.resolve(response({ detail: "database timeout" }, 500));

    expect(await screen.findByText("Radio audio records could not be loaded.")).toBeInTheDocument();
    expect(screen.getByText("First audio")).toBeInTheDocument();
    expect(screen.queryByText("No Radio audio records are currently available.")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Retry Radio request" }));

    expect(await screen.findByText("Second audio")).toBeInTheDocument();
    expect(screen.getByText("Page 2 of 2")).toBeInTheDocument();
  });
});

describe("eligibility presentation and discovery", () => {
  it("distinguishes eligible audio from ineligible audio and explains the returned reasons", async () => {
    const ineligibleAudio: AudioFixture = {
      ...firstAudio,
      id: 3,
      title: "Needs review",
      editorialStatus: "ready_for_review",
      processingStatus: "processing",
      rightsStatus: "expired",
      broadcastEligible: false,
      broadcastEligibilityReasons: [
        "processing_not_ready",
        "editorial_approval_required",
        "rights_expired",
        "missing_checksum",
      ],
    };
    mocks.adminFetch.mockImplementation(async (path: string) => {
      if (path.startsWith("/api/admin/radio/audio")) return response(audioPayload([firstAudio, ineligibleAudio], 1, 2, 1));
      return adminResponse(path);
    });

    renderRadio();

    expect((await screen.findAllByText("Broadcast eligible")).length).toBeGreaterThan(1);
    expect(screen.getByText("Not currently broadcast eligible")).toBeInTheDocument();
    expect(screen.getByText(/Processing is not complete/)).toBeInTheDocument();
    expect(screen.getByText(/Editorial approval is required/)).toBeInTheDocument();
    expect(screen.getByText(/Rights have expired/)).toBeInTheDocument();
    expect(screen.getByText(/File checksum is missing/)).toBeInTheDocument();
    expect(screen.getByText(/It is not currently playing/)).toBeInTheDocument();
  });

  it("sends the selected eligibility filter to the authoritative audio list", async () => {
    const user = userEvent.setup();
    renderRadio();
    await screen.findByText("First audio");

    await user.selectOptions(screen.getByRole("combobox", { name: "Broadcast eligibility filter" }), "ineligible");

    await waitFor(() => expect(mocks.adminFetch).toHaveBeenCalledWith(
      "/api/admin/radio/audio?page=1&pageSize=50&eligibility=ineligible",
    ));
  });

  it("refreshes eligible playlist candidates independently from the visible audio page", async () => {
    mocks.adminFetch.mockImplementation(async (path: string) => {
      if (path === "/api/admin/radio/playlists") return response({ playlists: [playlistFixture] });
      if (path === "/api/admin/radio/playlists/1") return response({ playlist: playlistFixture, items: [] });
      return adminResponse(path);
    });
    const user = userEvent.setup();
    renderRadio();

    await user.click(await screen.findByRole("button", { name: "Evening poetry" }));

    expect(await screen.findByRole("option", { name: "First audio" })).toBeInTheDocument();
    expect(mocks.adminFetch).toHaveBeenCalledWith("/api/admin/radio/audio?eligibility=eligible&page=1&pageSize=100");
  });
});

describe("refresh and in-flight guards", () => {
  it("replaces existing data after a successful refresh", async () => {
    const refreshRequest = deferred<Response>();
    let audioCalls = 0;
    mocks.adminFetch.mockImplementation(async (path: string) => {
      if (path.startsWith("/api/admin/radio/audio")) {
        audioCalls += 1;
        return audioCalls === 1 ? adminResponse(path) : refreshRequest.promise;
      }
      return adminResponse(path);
    });

    const user = userEvent.setup();
    renderRadio();
    expect(await screen.findByText("First audio")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Refresh legacy data" }));
    expect(screen.getByText("First audio")).toBeInTheDocument();
    expect(screen.getByText("Refreshing legacy Radio data…")).toBeInTheDocument();

    refreshRequest.resolve(response(audioPayload([secondAudio], 1, 1, 1)));

    expect(await screen.findByText("Second audio")).toBeInTheDocument();
    expect(screen.queryByText("First audio")).not.toBeInTheDocument();
    expect(screen.queryByText(/could not be loaded/i)).not.toBeInTheDocument();
    void user;
  });

  it("keeps existing data visible after a failed refresh", async () => {
    let audioCalls = 0;
    mocks.adminFetch.mockImplementation(async (path: string) => {
      if (path.startsWith("/api/admin/radio/audio")) {
        audioCalls += 1;
        if (audioCalls === 2) throw new Error("network down");
      }
      return adminResponse(path);
    });

    const user = userEvent.setup();
    renderRadio();
    expect(await screen.findByText("First audio")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Refresh legacy data" }));

    expect(await screen.findByText("Radio audio records could not be loaded.")).toBeInTheDocument();
    expect(screen.getByText("First audio")).toBeInTheDocument();
    expect(screen.queryByText("No Radio audio records are currently available.")).not.toBeInTheDocument();
  });

  it("does not create duplicate refresh requests while one is pending", async () => {
    const refreshRequest = deferred<Response>();
    let audioCalls = 0;
    mocks.adminFetch.mockImplementation(async (path: string) => {
      if (path.startsWith("/api/admin/radio/audio")) {
        audioCalls += 1;
        return audioCalls === 1 ? adminResponse(path) : refreshRequest.promise;
      }
      return adminResponse(path);
    });

    renderRadio();
    expect(await screen.findByText("First audio")).toBeInTheDocument();

    const refreshButton = screen.getByRole("button", { name: "Refresh legacy data" });
    fireEvent.click(refreshButton);
    fireEvent.click(refreshButton);
    expect(audioCalls).toBe(2);

    refreshRequest.resolve(adminResponse("/api/admin/radio/audio"));
    await waitFor(() => expect(screen.getByRole("button", { name: "Refresh legacy data" })).not.toBeDisabled());
  });
});

describe("mutations", () => {
  it("shows success feedback and refreshes after a successful audio mutation", async () => {
    const user = userEvent.setup();
    renderRadio();
    expect(await screen.findByText("First audio")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Approve" }));

    expect(await screen.findByText("Audio approval recorded.")).toBeInTheDocument();
    expect(mocks.adminFetch).toHaveBeenCalledWith("/api/admin/radio/audio/1/approve", { method: "POST" });
  });

  it("shows mutation failure feedback and re-enables controls", async () => {
    mocks.adminFetch.mockImplementation(async (path: string) => {
      if (path.includes("/audio/1/approve")) return response({ detail: "private server detail" }, 500);
      return adminResponse(path);
    });

    const user = userEvent.setup();
    renderRadio();
    expect(await screen.findByText("First audio")).toBeInTheDocument();
    const approveButton = screen.getByRole("button", { name: "Approve" });

    await user.click(approveButton);

    expect(await screen.findByText("Radio operation could not be completed. Try again.")).toBeInTheDocument();
    expect(approveButton).not.toBeDisabled();
    expect(screen.queryByText("private server detail")).not.toBeInTheDocument();
  });

  it("guards repeated mutation clicks while the first request is pending", async () => {
    const mutationRequest = deferred<Response>();
    let mutationCalls = 0;
    mocks.adminFetch.mockImplementation(async (path: string) => {
      if (path.includes("/audio/1/approve")) {
        mutationCalls += 1;
        return mutationRequest.promise;
      }
      return adminResponse(path);
    });

    renderRadio();
    expect(await screen.findByText("First audio")).toBeInTheDocument();
    const approveButton = screen.getByRole("button", { name: "Approve" });

    fireEvent.click(approveButton);
    fireEvent.click(approveButton);
    expect(mutationCalls).toBe(1);

    mutationRequest.resolve(response({}));
    expect(await screen.findByText("Audio approval recorded.")).toBeInTheDocument();
  });
});

describe("emergency editorial mode", () => {
  it("renders the off state separately from the unavailable execution state", async () => {
    renderRadio();

    expect((await screen.findAllByText("Emergency editorial mode: Off")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Broadcast execution: Not connected").length).toBeGreaterThan(0);
    expect(screen.getByRole("checkbox", { name: "Enable emergency editorial mode" })).not.toBeChecked();
    expect(screen.queryByText(/emergency broadcast active|broadcasting emergency|live emergency|on air/i)).not.toBeInTheDocument();
  });

  it("renders the on state as editorial configuration without implying a live broadcast", async () => {
    mocks.adminFetch.mockImplementation(async (path: string) => {
      if (path === "/api/admin/radio/emergency") {
        return response({ enabled: true, type: "message", audioId: null, message: "Use the prepared editorial message.", broadcastExecution: "not_available" });
      }
      return adminResponse(path);
    });

    renderRadio();

    expect((await screen.findAllByText("Emergency editorial mode: On")).length).toBeGreaterThan(0);
    expect(screen.getByRole("checkbox", { name: "Enable emergency editorial mode" })).toBeChecked();
    expect(screen.getAllByText("Broadcast execution: Not connected").length).toBeGreaterThan(0);
    expect(screen.queryByText(/emergency broadcast active|broadcasting emergency|live emergency|on air/i)).not.toBeInTheDocument();
  });

  it("confirms an enabled save is editorial-only and clears pending state", async () => {
    let enabled = false;
    mocks.adminFetch.mockImplementation(async (path: string, options?: RequestInit) => {
      if (path === "/api/admin/radio/emergency") {
        if (options?.method === "PUT") {
          enabled = true;
          return response({ enabled: true, type: "message", audioId: null, message: "Prepared message.", broadcastExecution: "not_available" });
        }
        return response({ enabled, type: "message", audioId: null, message: enabled ? "Prepared message." : null, broadcastExecution: "not_available" });
      }
      return adminResponse(path);
    });

    const user = userEvent.setup();
    renderRadio();
    await screen.findAllByText("Emergency editorial mode: Off");

    await user.click(screen.getByRole("checkbox", { name: "Enable emergency editorial mode" }));
    await user.click(screen.getByRole("button", { name: "Save editorial settings" }));

    expect(await screen.findByText("Emergency editorial settings saved. Broadcast execution is not connected; no live stream was changed.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save editorial settings" })).not.toBeDisabled();
  });

  it("shows a sanitized failure and re-enables the emergency save control", async () => {
    mocks.adminFetch.mockImplementation(async (path: string, options?: RequestInit) => {
      if (path === "/api/admin/radio/emergency" && options?.method === "PUT") return response({ detail: "private database detail" }, 500);
      return adminResponse(path);
    });

    const user = userEvent.setup();
    renderRadio();
    await screen.findAllByText("Emergency editorial mode: Off");

    await user.click(screen.getByRole("checkbox", { name: "Enable emergency editorial mode" }));
    const saveButton = screen.getByRole("button", { name: "Save editorial settings" });
    await user.click(saveButton);

    expect(await screen.findByText("Radio operation could not be completed. Try again.")).toBeInTheDocument();
    expect(saveButton).not.toBeDisabled();
    expect(screen.queryByText("private database detail")).not.toBeInTheDocument();
  });

  it("keeps emergency permissions enforced", async () => {
    mocks.adminFetch.mockImplementation(async (path: string) => {
      if (path === "/api/admin/radio/emergency") return response({}, 403);
      return adminResponse(path);
    });

    renderRadio();

    expect(await screen.findByText("Emergency controls require the explicit Radio emergency permission.")).toBeInTheDocument();
    expect(screen.getAllByRole("alert").some((alert) => alert.textContent?.includes("Emergency controls require the explicit Radio emergency permission."))).toBe(true);
  });

  it("recovers the emergency editor after the initial emergency request fails", async () => {
    let emergencyCalls = 0;
    mocks.adminFetch.mockImplementation(async (path: string) => {
      if (path === "/api/admin/radio/emergency") {
        emergencyCalls += 1;
        return emergencyCalls === 1 ? response({}, 500) : adminResponse(path);
      }
      return adminResponse(path);
    });

    const user = userEvent.setup();
    renderRadio();

    expect(await screen.findByText("Emergency state could not be loaded.")).toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: "Retry Radio request" })[0]);

    expect((await screen.findAllByText("Emergency editorial mode: Off")).length).toBeGreaterThan(0);
  });

  it("does not offer ineligible audio for emergency selection", async () => {
    mocks.adminFetch.mockImplementation(async (path: string) => {
      if (path.startsWith("/api/admin/radio/audio")) return response(audioPayload([{ ...firstAudio, broadcastEligible: false }], 1, 1, 0));
      if (path === "/api/admin/radio/emergency") return response({ enabled: true, type: "playlist", audioId: null, message: null, broadcastExecution: "not_available" });
      return adminResponse(path);
    });

    renderRadio();

    await screen.findAllByText("Emergency editorial mode: On");
    expect(screen.queryByRole("option", { name: "First audio" })).not.toBeInTheDocument();
    expect(screen.getAllByText("Only approved, processed, rights-cleared audio can be selected.").length).toBeGreaterThan(0);
  });
});