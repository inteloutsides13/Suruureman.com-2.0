import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminRadioCalendar from "./radio-calendar";

const mocks = vi.hoisted(() => ({
  adminFetch: vi.fn(),
  useAdminAuth: vi.fn(),
}));

vi.mock("@/hooks/use-admin-auth", () => ({
  adminFetch: mocks.adminFetch,
  useAdminAuth: mocks.useAdminAuth,
}));

vi.mock("@/components/admin-layout", () => ({
  AdminLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

function berlinToday() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const programme = {
  id: 14,
  titleEn: "Poetry at Dusk",
  titleUr: "شام کی شاعری",
  descriptionEn: "Readings from the archive.",
  descriptionUr: null,
  programmeType: "Poetry Hour",
  programmeDate: berlinToday(),
  startTime: "18:00:00",
  endTime: "19:00:00",
  timezone: "Europe/Berlin",
  externalLink: null,
  publicNote: null,
  status: "draft",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.useAdminAuth.mockReturnValue({ role: "admin" });
  mocks.adminFetch.mockImplementation(async (path: string) => {
    if (path.startsWith("/api/admin/radio-calendar/programmes?")) return response({ timezone: "Europe/Berlin", startDate: berlinToday(), programmes: [programme] });
    if (path.endsWith("/publish")) return response({ programme: { ...programme, status: "published" } });
    return response({ programme });
  });
});

describe("admin radio programme calendar", () => {
  it("loads draft schedule entries and exposes supported status actions only", async () => {
    render(<AdminRadioCalendar />);

    expect(await screen.findByTestId("admin-programme-14")).toBeInTheDocument();
    expect(screen.getByTestId("status-14")).toHaveTextContent("draft");
    expect(screen.getByTestId("publish-programme-14")).toBeInTheDocument();
    expect(screen.getByTestId("cancel-programme-14")).toBeInTheDocument();
    expect(screen.queryByText(/unpublish|delete programme/i)).not.toBeInTheDocument();
    expect(mocks.adminFetch).toHaveBeenCalledWith(`/api/admin/radio-calendar/programmes?startDate=${berlinToday()}`);
  });

  it("normalizes database time values before editing and saving", async () => {
    const user = userEvent.setup();
    render(<AdminRadioCalendar />);
    await screen.findByTestId("admin-programme-14");

    await user.click(screen.getByTestId("edit-programme-14"));
    expect(screen.getByTestId("programme-start-time")).toHaveValue("18:00");
    await user.click(screen.getByTestId("save-programme"));

    await waitFor(() => expect(mocks.adminFetch).toHaveBeenCalledWith(
      "/api/admin/radio-calendar/programmes/14",
      expect.objectContaining({ method: "PUT" }),
    ));
    const updateCall = mocks.adminFetch.mock.calls.find(([path, options]) =>
      path === "/api/admin/radio-calendar/programmes/14" && options?.method === "PUT");
    expect(JSON.parse(updateCall?.[1]?.body as string)).toMatchObject({
      startTime: "18:00",
      endTime: "19:00",
      timezone: "Europe/Berlin",
    });
  });

  it("blocks invalid time ranges and publishes valid drafts through the supported endpoint", async () => {
    const user = userEvent.setup();
    render(<AdminRadioCalendar />);
    await screen.findByTestId("admin-programme-14");

    await user.type(screen.getByTestId("programme-title-en"), " A new programme");
    await user.type(screen.getByTestId("programme-title-ur"), " نیا پروگرام");
    await user.clear(screen.getByTestId("programme-start-time"));
    await user.type(screen.getByTestId("programme-start-time"), "20:00");
    await user.clear(screen.getByTestId("programme-end-time"));
    await user.type(screen.getByTestId("programme-end-time"), "19:00");
    await user.click(screen.getByTestId("save-programme"));

    expect(await screen.findByRole("alert")).toHaveTextContent("End time must be later than start time");
    expect(mocks.adminFetch).not.toHaveBeenCalledWith("/api/admin/radio-calendar/programmes", expect.objectContaining({ method: "POST" }));

    await user.clear(screen.getByTestId("programme-end-time"));
    await user.type(screen.getByTestId("programme-end-time"), "21:00");
    await user.click(screen.getByTestId("save-programme"));
    await waitFor(() => expect(mocks.adminFetch).toHaveBeenCalledWith(
      "/api/admin/radio-calendar/programmes",
      expect.objectContaining({ method: "POST", body: expect.stringContaining('"titleEn":"A new programme"') }),
    ));
    const createCall = mocks.adminFetch.mock.calls.find(([path, options]) =>
      path === "/api/admin/radio-calendar/programmes" && options?.method === "POST");
    expect(JSON.parse(createCall?.[1]?.body as string)).toMatchObject({
      startTime: "20:00",
      endTime: "21:00",
      timezone: "Europe/Berlin",
    });

    await user.click(await screen.findByTestId("publish-programme-14"));
    expect(await screen.findByRole("status")).toHaveTextContent("Programme published to the public calendar.");
    await waitFor(() => expect(mocks.adminFetch).toHaveBeenCalledWith("/api/admin/radio-calendar/programmes/14/publish", { method: "POST" }));
  });

  it("requires confirmation before sending the cancellation request", async () => {
    mocks.adminFetch.mockImplementation(async (path: string) => {
      if (path.startsWith("/api/admin/radio-calendar/programmes?")) return response({ timezone: "Europe/Berlin", startDate: berlinToday(), programmes: [{ ...programme, status: "published" }] });
      return response({ programme: { ...programme, status: "cancelled" } });
    });
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const user = userEvent.setup();
    render(<AdminRadioCalendar />);
    await screen.findByTestId("admin-programme-14");

    await user.click(screen.getByTestId("cancel-programme-14"));

    expect(confirm).toHaveBeenCalledWith(expect.stringContaining("Cancel “Poetry at Dusk”?"));
    expect(mocks.adminFetch).not.toHaveBeenCalledWith("/api/admin/radio-calendar/programmes/14/cancel", expect.anything());

    confirm.mockReturnValue(true);
    await user.click(screen.getByTestId("cancel-programme-14"));
    expect(await screen.findByRole("status")).toHaveTextContent("Programme cancelled and removed from the public schedule.");
    expect(mocks.adminFetch).toHaveBeenCalledWith("/api/admin/radio-calendar/programmes/14/cancel", { method: "POST" });
  });

  it("previews a JSON file and imports only after confirmation through the Admin API client", async () => {
    const imported = {
      titleEn: "A demo programme",
      titleUr: "ایک ڈیمو پروگرام",
      descriptionEn: "A short demo.",
      descriptionUr: "مختصر ڈیمو۔",
      programmeType: "Recorded Show",
      programmeDate: "2026-10-12",
      startTime: "08:00",
      endTime: "08:45",
      timezone: "Europe/Berlin",
      externalLink: null,
      publicNote: null,
    };
    mocks.adminFetch.mockImplementation(async (path: string, options?: RequestInit) => {
      if (path.startsWith("/api/admin/radio-calendar/programmes?")) {
        return response({ timezone: "Europe/Berlin", startDate: berlinToday(), programmes: [programme] });
      }
      if (path === "/api/admin/radio-calendar/programmes/import") {
        return response({ programmes: [{ ...imported, id: 88, status: "draft" }] }, 201);
      }
      return response({ programme });
    });
    const user = userEvent.setup();
    render(<AdminRadioCalendar />);
    await screen.findByTestId("admin-programme-14");

    const file = new File([JSON.stringify([imported])], "radio-demo.json", { type: "application/json" });
    await user.upload(screen.getByLabelText("Choose Radio Calendar JSON file"), file);

    expect(await screen.findByTestId("radio-calendar-import-preview")).toBeInTheDocument();
    expect(screen.getByText("A demo programme")).toBeInTheDocument();
    expect(screen.getByText(/1 programme · Europe\/Berlin/)).toBeInTheDocument();
    expect(mocks.adminFetch).not.toHaveBeenCalledWith(
      "/api/admin/radio-calendar/programmes/import",
      expect.anything(),
    );

    await user.click(screen.getByTestId("import-radio-calendar-json"));
    expect(await screen.findByRole("status")).toHaveTextContent("1 programmes imported as drafts");
    expect(mocks.adminFetch).toHaveBeenCalledWith(
      "/api/admin/radio-calendar/programmes/import",
      { method: "POST", body: JSON.stringify([imported]) },
    );
  });
});
