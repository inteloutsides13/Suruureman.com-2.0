import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MobileBroadcastGuide } from "./mobile-broadcast-guide";

describe("MobileBroadcastGuide", () => {
  it("shows concise bilingual contributor steps and the public player link", () => {
    render(<MobileBroadcastGuide audience="contributor" />);

    expect(screen.getByRole("heading", { name: "Broadcasting instructions" })).toBeInTheDocument();
    expect(screen.getByText("نشریاتی ہدایات")).toBeInTheDocument();
    expect(screen.getByText(/Use the broadcaster setup link and connection details shared privately by the Radio administrator/)).toBeInTheDocument();
    expect(screen.getByText("منظور شدہ ایپ یا ڈیوائس کے ذریعے نشریات شروع کریں۔")).toBeInTheDocument();
    expect(screen.getByText(/Playback cannot be verified by this website/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open public Radio page/ })).toHaveAttribute("href", "/radio");
    expect(screen.queryByText(/Caster\.fm|Cool Mic/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Troubleshooting" })).not.toBeInTheDocument();
    expect(screen.queryByText(/To be supplied by the Radio administrator/)).not.toBeInTheDocument();
  });

  it("shows only the four GoCast dashboard and broadcast steps to admins", () => {
    render(<MobileBroadcastGuide audience="admin" />);

    expect(screen.getByText("Open the GoCast.fm station dashboard.")).toBeInTheDocument();
    expect(screen.getByText("Start the station/AutoDJ or connect an approved broadcaster.")).toBeInTheDocument();
    expect(screen.getByText("Open the public /radio page and test playback in the player.")).toBeInTheDocument();
    expect(screen.getByText("Stop broadcasting when finished.")).toBeInTheDocument();
    expect(screen.getByText(/Check playback in the GoCast\.fm player on \/radio/)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Troubleshooting" })).not.toBeInTheDocument();
    expect(screen.queryByText(/^LIVE$/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
