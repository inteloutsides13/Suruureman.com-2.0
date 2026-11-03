import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RadioMiniPlayer, RadioPlayer } from "./radio-player";

const mocks = vi.hoisted(() => ({
  useRadioPlayer: vi.fn(),
  getCasterFmConfig: vi.fn(),
}));

vi.mock("@/hooks/use-radio-player", () => ({
  useRadioPlayer: mocks.useRadioPlayer,
}));

vi.mock("@/lib/casterfm-config", () => ({
  getCasterFmConfig: mocks.getCasterFmConfig,
}));

vi.mock("wouter", () => ({
  Link: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));

function playerState(overrides: Record<string, unknown> = {}) {
  return {
    status: "available",
    streamUrl: "https://radio.example.test/stream",
    nowPlaying: null,
    message: null,
    retry: vi.fn(),
    playback: "idle",
    volume: 0.8,
    setVolume: vi.fn(),
    togglePlayback: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  mocks.getCasterFmConfig.mockReturnValue({ publicToken: null, channelId: null, configured: false });
});

describe("RadioPlayer stream terminology", () => {
  it("uses configuration wording before playback starts", () => {
    mocks.useRadioPlayer.mockReturnValue(playerState());

    render(<RadioPlayer />);

    expect(screen.getByText("Stream configured")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Play radio" })).toBeInTheDocument();
    expect(screen.queryByText(/live|online|broadcasting|on air|stand by|ready/i)).not.toBeInTheDocument();
  });

  it("uses preparing and connecting wording for browser playback", () => {
    mocks.useRadioPlayer.mockReturnValue(playerState({ status: "loading", streamUrl: null }));
    const { rerender } = render(<RadioPlayer />);
    expect(screen.getByText("Preparing playback")).toBeInTheDocument();

    mocks.useRadioPlayer.mockReturnValue(playerState({ playback: "connecting" }));
    rerender(<RadioPlayer />);
    expect(screen.getByText("Connecting")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Connecting to radio" })).toBeInTheDocument();
  });

  it("reports successful browser playback as Playing, not live", () => {
    mocks.useRadioPlayer.mockReturnValue(playerState({ playback: "playing" }));

    render(<RadioPlayer />);

    expect(screen.getByText("Playing")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pause radio" })).toBeInTheDocument();
    expect(screen.queryByText(/live|online|broadcasting|on air/i)).not.toBeInTheDocument();
  });

  it("reports pause and playback failure as player states", () => {
    mocks.useRadioPlayer.mockReturnValue(playerState({ playback: "paused" }));
    const { rerender } = render(<RadioPlayer />);
    expect(screen.getByText("Paused")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Resume radio" })).toBeInTheDocument();

    mocks.useRadioPlayer.mockReturnValue(playerState({ playback: "error" }));
    rerender(<RadioPlayer />);
    expect(screen.getByText("Playback unavailable")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry playback" })).toBeInTheDocument();
  });

  it("distinguishes an unconfigured stream from a failed playback attempt", () => {
    mocks.useRadioPlayer.mockReturnValue(playerState({ status: "empty", streamUrl: null }));

    render(<RadioPlayer />);

    expect(screen.getByText("Playback unavailable")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Play radio" })).toBeDisabled();
  });

  it("does not expose controls that claim to start or stop a broadcast runtime", async () => {
    const togglePlayback = vi.fn();
    mocks.useRadioPlayer.mockReturnValue(playerState({ togglePlayback }));
    const user = userEvent.setup();

    render(<RadioPlayer />);
    await user.click(screen.getByRole("button", { name: "Play radio" }));

    expect(togglePlayback).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: /start broadcast|stop broadcast|go live/i })).not.toBeInTheDocument();
  });

  it("labels provided metadata as configured instead of now playing", () => {
    mocks.useRadioPlayer.mockReturnValue(playerState({
      nowPlaying: { title: "Configured evening programme", show: "Poetry" },
    }));

    render(<RadioPlayer />);

    expect(screen.getByText("Configured program metadata")).toBeInTheDocument();
    expect(screen.queryByText(/^Now Playing$/i)).not.toBeInTheDocument();
  });
});

describe("RadioMiniPlayer browser playback states", () => {
  it("keeps paused and failed playback states visible in the mini-player", () => {
    mocks.useRadioPlayer.mockReturnValue(playerState({ playback: "paused" }));
    const { rerender } = render(<RadioMiniPlayer />);

    expect(screen.getByText("Paused in this browser")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Resume Radio Suruur FM" })).toBeInTheDocument();

    mocks.useRadioPlayer.mockReturnValue(playerState({ playback: "error" }));
    rerender(<RadioMiniPlayer />);

    expect(screen.getByText("Playback unavailable")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry Radio Suruur FM" })).toBeInTheDocument();
  });

  it("hides the HTML-audio mini-player while the Caster.fm widget is configured", () => {
    mocks.getCasterFmConfig.mockReturnValue({
      publicToken: null,
      channelId: null,
      configured: true,
    });
    mocks.useRadioPlayer.mockReturnValue(playerState({ playback: "playing" }));

    const { container } = render(<RadioMiniPlayer />);

    expect(container.firstChild).toBeNull();
  });
});
