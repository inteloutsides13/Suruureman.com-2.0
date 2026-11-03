import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CasterFmPlayer } from "./casterfm-player";

const CASTERFM_SCRIPT_ID = "casterfm-cloud-widget-script";

afterEach(() => {
  cleanup();
  delete window.casterfmWidgetsRescan;
  document.getElementById(CASTERFM_SCRIPT_ID)?.remove();
});

describe("CasterFmPlayer", () => {
  it("loads the official script once and rescans a newly mounted widget", async () => {
    const rescan = vi.fn(() => {
      document.querySelectorAll<HTMLElement>('.cstrEmbed[data-rendered="false"]').forEach((container) => {
        const frame = document.createElement("iframe");
        container.replaceChildren(frame);
        container.dataset.rendered = "true";
      });
    });

    const firstMount = render(<CasterFmPlayer publicToken="unit-test-token" />);
    const script = document.getElementById(CASTERFM_SCRIPT_ID) as HTMLScriptElement | null;
    const firstContainer = document.querySelector<HTMLElement>(".cstrEmbed");

    expect(script?.src).toBe("https://cdn.cloud.caster.fm/widgets/embed.js");
    expect(document.querySelectorAll(`#${CASTERFM_SCRIPT_ID}`)).toHaveLength(1);
    expect(firstContainer?.getAttribute("data-publictoken")).toBe("unit-test-token");
    expect(firstContainer?.getAttribute("data-channelid")).toBeNull();
    expect(firstContainer?.children).toHaveLength(3);

    window.casterfmWidgetsRescan = rescan;
    fireEvent.load(script as HTMLScriptElement);
    await waitFor(() => expect(rescan).toHaveBeenCalledTimes(1));

    const firstFrame = document.querySelector("iframe");
    expect(firstFrame).not.toBeNull();
    fireEvent.load(firstFrame as HTMLIFrameElement);
    expect(await screen.findByText(/Caster\.fm frame loaded\. Use its controls if available/)).toBeInTheDocument();

    firstMount.unmount();
    expect(document.querySelector("iframe")).toBeNull();

    render(<CasterFmPlayer publicToken="unit-test-token" channelId="unit-test-channel" />);
    await waitFor(() => expect(rescan).toHaveBeenCalledTimes(2));
    expect(document.querySelectorAll(`#${CASTERFM_SCRIPT_ID}`)).toHaveLength(1);

    const secondContainer = document.querySelector<HTMLElement>(".cstrEmbed");
    expect(secondContainer?.getAttribute("data-channelid")).toBe("unit-test-channel");
    expect(document.querySelectorAll("iframe")).toHaveLength(1);
  });
});
