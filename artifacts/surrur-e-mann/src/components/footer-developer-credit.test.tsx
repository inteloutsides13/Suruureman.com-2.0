import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FooterDeveloperCredit } from "./footer-developer-credit";

describe("footer developer credit", () => {
  it("shows the exact credit and links the name and logo to the developer site", () => {
    render(<FooterDeveloperCredit />);

    expect(screen.getByText("Developed & Maintained by")).toBeInTheDocument();
    expect(screen.getByText("The Quantum Forge")).toBeInTheDocument();

    const link = screen.getByRole("link", {
      name: "The Quantum Forge (opens in a new tab)",
    });
    expect(link).toHaveAttribute("href", "https://thequantumforge.net");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");

    const logo = screen.getByRole("img", { name: "The Quantum Forge" });
    expect(logo).toHaveAttribute("width", "512");
    expect(logo).toHaveAttribute("height", "512");
    expect(logo).toHaveClass("h-auto", "object-contain", "w-[78px]", "sm:w-24");
    expect(link).toContainElement(logo);
  });
});
