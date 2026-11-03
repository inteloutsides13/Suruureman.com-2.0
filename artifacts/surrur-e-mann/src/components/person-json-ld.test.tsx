import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PersonJsonLd } from "./person-json-ld";

afterEach(cleanup);

describe("PersonJsonLd", () => {
  it("emits escaped Person data using only supplied profile facts", () => {
    const { container } = render(
      <PersonJsonLd
        name="Faiz"
        alternateName="فیض"
        description="A poet"
        url="https://suruureman.com/poets/12"
      />,
    );
    const script = container.querySelector('script[type="application/ld+json"]');
    expect(JSON.parse(script!.textContent!)).toEqual({
      "@context": "https://schema.org",
      "@type": "Person",
      name: "Faiz",
      alternateName: "فیض",
      description: "A poet",
      url: "https://suruureman.com/poets/12",
    });
  });

  it("escapes script-closing text before embedding JSON-LD", () => {
    const { container } = render(
      <PersonJsonLd name="</script><script>" url="https://suruureman.com/poets/12" />,
    );
    const script = container.querySelector('script[type="application/ld+json"]');
    expect(script?.textContent).toContain("\\u003c/script>");
    expect(() => JSON.parse(script!.textContent!)).not.toThrow();
  });
});
