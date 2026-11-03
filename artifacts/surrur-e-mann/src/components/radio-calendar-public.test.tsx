import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RadioCalendarPublic } from "./radio-calendar-public";

function berlinToday() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function moveDate(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function mondayFor(date: string) {
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  return moveDate(date, weekday === 0 ? -6 : 1 - weekday);
}

function response(programmes: unknown[], status = 200) {
  return new Response(JSON.stringify({ timezone: "Europe/Berlin", startDate: berlinToday(), programmes }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const fixture = {
  id: 37,
  titleEn: "The Evening Ghazal",
  titleUr: "شام کی غزل",
  descriptionEn: "A reading of poems from the literary archive.",
  descriptionUr: "منتخب شاعری کی ایک نشست",
  programmeType: "Poetry Hour",
  programmeDate: berlinToday(),
  startTime: "00:00:00",
  endTime: "23:59:00",
  externalLink: "https://example.org/programme",
  publicNote: "Programme details are subject to change.",
};

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async () => response([fixture])));
});

describe("public radio programme calendar", () => {
  it("loads the Berlin week, opens an accessible programme detail panel and restores focus", async () => {
    render(<RadioCalendarPublic />);

    expect(await screen.findByTestId("programme-row-37")).toBeInTheDocument();
    expect(screen.getByText("Europe/Berlin")).toBeInTheDocument();
    expect(screen.queryByText("Scheduled now")).not.toBeInTheDocument();
    expect(screen.queryByText(/Schedule times are shown in Europe\/Berlin/)).not.toBeInTheDocument();
    const dayNavigation = screen.getByRole("navigation", { name: "Choose a schedule day" });
    expect(dayNavigation).toHaveAttribute("dir", "ltr");
    expect(Array.from(dayNavigation.querySelectorAll("button")).map((button) => button.getAttribute("data-testid"))).toEqual(
      Array.from({ length: 7 }, (_, index) => `calendar-day-${moveDate(mondayFor(berlinToday()), index)}`),
    );
    fireEvent.click(screen.getByRole("button", { name: "About schedule times and publication" }));
    expect(screen.getByRole("tooltip")).toBeVisible();
    expect(fetch).toHaveBeenCalledWith(
      `/api/radio-calendar/programmes?startDate=${mondayFor(berlinToday())}`,
      expect.objectContaining({ cache: "no-store" }),
    );
    expect(screen.getAllByText("The Evening Ghazal").length).toBeGreaterThanOrEqual(1);

    const openDetails = screen.getByRole("button", { name: /Show details for The Evening Ghazal/ });
    openDetails.focus();
    fireEvent.click(openDetails);
    expect(screen.getByRole("dialog", { name: "The Evening Ghazal" })).toBeInTheDocument();
    expect(screen.getByText("A reading of poems from the literary archive.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /More information/ })).toHaveAttribute("href", fixture.externalLink);

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(openDetails).toHaveFocus();
  });

  it("shows a truthful empty state and supports day selection", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => response([])));
    render(<RadioCalendarPublic />);
    expect(await screen.findByTestId("calendar-empty")).toBeInTheDocument();

    const nextDay = new Date(`${berlinToday()}T00:00:00Z`);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    const nextDate = nextDay.toISOString().slice(0, 10);
    fireEvent.click(screen.getByTestId(`calendar-day-${nextDate}`));

    expect(screen.getByTestId(`calendar-day-${nextDate}`)).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("There are no published programmes for this day.")).toBeInTheDocument();
  });

  it("isolates request errors and offers a retry", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response([], 503))
      .mockResolvedValueOnce(response([fixture]));
    vi.stubGlobal("fetch", fetchMock);
    render(<RadioCalendarPublic />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Schedule unavailable");
    fireEvent.click(screen.getByTestId("calendar-retry"));
    expect(await screen.findByTestId("programme-row-37")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("loads adjacent weeks and returns to the current Berlin date", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response([fixture]))
      .mockResolvedValue(response([]));
    vi.stubGlobal("fetch", fetchMock);
    render(<RadioCalendarPublic />);

    expect(await screen.findByTestId("programme-row-37")).toBeInTheDocument();
    const currentMonday = mondayFor(berlinToday());
    fireEvent.click(screen.getByTestId("calendar-next-week"));
    await screen.findByTestId("calendar-empty");
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      `/api/radio-calendar/programmes?startDate=${moveDate(currentMonday, 7)}`,
      expect.objectContaining({ cache: "no-store" }),
    );

    fireEvent.click(screen.getByTestId("calendar-this-week"));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(fetchMock).toHaveBeenLastCalledWith(
      `/api/radio-calendar/programmes?startDate=${currentMonday}`,
      expect.objectContaining({ cache: "no-store" }),
    );
    expect(screen.getByTestId(`calendar-day-${berlinToday()}`)).toHaveAttribute("aria-pressed", "true");
  });

  it("keeps programmes on their saved dates and allows selection of all seven days", async () => {
    const tomorrow = moveDate(berlinToday(), 1);
    const secondProgrammeToday = { ...fixture, id: 38, titleEn: "A second reading", startTime: "18:00:00", endTime: "19:00:00" };
    const programmeTomorrow = { ...fixture, id: 39, titleEn: "Tomorrow's reading", programmeDate: tomorrow, startTime: "10:00:00", endTime: "11:00:00" };
    const fetchMock = vi.fn().mockResolvedValue(response([fixture, secondProgrammeToday, programmeTomorrow]));
    vi.stubGlobal("fetch", fetchMock);
    render(<RadioCalendarPublic />);

    expect(await screen.findByTestId("programme-row-37")).toBeInTheDocument();
    expect(screen.getByTestId("programme-row-38")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId(`calendar-day-${tomorrow}`));
    expect(screen.getByTestId("programme-row-39")).toBeInTheDocument();
    expect(screen.queryByTestId("programme-row-37")).not.toBeInTheDocument();

    for (const day of Array.from({ length: 7 }, (_, index) => moveDate(mondayFor(berlinToday()), index))) {
      fireEvent.click(screen.getByTestId(`calendar-day-${day}`));
      expect(screen.getByTestId(`calendar-day-${day}`)).toHaveAttribute("aria-pressed", "true");
    }
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
