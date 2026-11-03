import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RadioPlayerProvider, useRadioPlayer } from "./use-radio-player";

const mocks = vi.hoisted(() => ({
  useRadioStatus: vi.fn(),
  getCasterFmConfig: vi.fn(),
}));

vi.mock("@/hooks/use-radio-status", () => ({
  useRadioStatus: mocks.useRadioStatus,
}));

vi.mock("@/lib/casterfm-config", () => ({
  getCasterFmConfig: mocks.getCasterFmConfig,
}));

function PlaybackProbe() {
  const radio = useRadioPlayer();
  return <button type="button" onClick={radio.togglePlayback}>Attempt direct playback</button>;
}

describe("RadioPlayerProvider in Caster.fm mode", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not attach or play the legacy direct stream", () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
    vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
    mocks.getCasterFmConfig.mockReturnValue({ publicToken: null, channelId: null, configured: true });
    mocks.useRadioStatus.mockReturnValue({
      status: "available",
      streamUrl: "https://radio.example.test/listen",
      isLive: null,
      nowPlaying: null,
      message: null,
      checkedAt: null,
      station: null,
      schedules: [],
    });

    render(
      <RadioPlayerProvider>
        <PlaybackProbe />
      </RadioPlayerProvider>,
    );

    const audio = screen.getByLabelText("Radio Suruur FM playback") as HTMLAudioElement;
    expect(audio.getAttribute("src")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Attempt direct playback" }));

    expect(play).not.toHaveBeenCalled();
    expect(audio.getAttribute("src")).toBeNull();
  });
});
