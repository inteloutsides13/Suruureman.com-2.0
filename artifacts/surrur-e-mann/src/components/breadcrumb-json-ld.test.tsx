import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { BreadcrumbJsonLd } from "./breadcrumb-json-ld";

afterEach(cleanup);

describe("BreadcrumbJsonLd", () => {
  it("renders a schema.org BreadcrumbList with absolute existing-route URLs", () => {
    const { container } = render(
      <BreadcrumbJsonLd
        items={[
          { name: "Home", href: "/" },
          { name: "Poets", href: "/poets" },
          { name: "Faiz", href: "/poets/12" },
        ]}
      />,
    );
    const script = container.querySelector('script[type="application/ld+json"]');
    expect(script).not.toBeNull();
    expect(JSON.parse(script!.textContent!)).toEqual({
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Home",
          item: "https://suruureman.com/",
        },
        {
          "@type": "ListItem",
          position: 2,
          name: "Poets",
          item: "https://suruureman.com/poets",
        },
        {
          "@type": "ListItem",
          position: 3,
          name: "Faiz",
          item: "https://suruureman.com/poets/12",
        },
      ],
    });
  });

  it("escapes script-closing characters in content", () => {
    const { container } = render(
      <BreadcrumbJsonLd items={[{ name: "</script>", href: "/" }]} />,
    );
    const script = container.querySelector('script[type="application/ld+json"]');
    expect(script?.textContent).toContain("\\u003c/script>");
    expect(() => JSON.parse(script!.textContent!)).not.toThrow();
  });
});
