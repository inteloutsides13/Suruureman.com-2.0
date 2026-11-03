import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PoemBreadcrumb } from "./poem-detail";

afterEach(cleanup);

describe("PoemBreadcrumb", () => {
  it("uses the visible Roman poem title as the final JSON-LD breadcrumb name", () => {
    const { container, getByText } = render(
      <PoemBreadcrumb poem={{ id: 42, title: "Roman poem title" }} />,
    );

    expect(getByText("Roman poem title")).toBeInTheDocument();
    const script = container.querySelector('script[type="application/ld+json"]');
    const data = JSON.parse(script!.textContent!);
    expect(data.itemListElement[2]).toEqual({
      "@type": "ListItem",
      position: 3,
      name: "Roman poem title",
      item: "https://suruureman.com/poems/42",
    });
  });
});
