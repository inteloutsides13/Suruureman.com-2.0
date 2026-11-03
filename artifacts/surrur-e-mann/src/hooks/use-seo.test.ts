import { describe, expect, it } from "vitest";
import {
  getCanonicalUrl,
  isClientSide404Route,
  isNonIndexableRoute,
  truncateMetaDescription,
} from "./use-seo";

describe("SEO route metadata helpers", () => {
  it("uses the production origin and keeps only the category filter in poem canonicals", () => {
    expect(getCanonicalUrl("/poems/", "?category=ghazal&sort=latest"))
      .toBe("https://suruureman.com/poems?category=ghazal");
  });

  it("drops tracking and search parameters from other canonical URLs", () => {
    expect(getCanonicalUrl("/poets/12/", "?utm_source=preview"))
      .toBe("https://suruureman.com/poets/12");
    expect(getCanonicalUrl("/search", "?q=ghazal"))
      .toBe("https://suruureman.com/search");
    expect(getCanonicalUrl("/poetry/farsi"))
      .toBe("https://suruureman.com/poetry/persian");
  });

  it("marks private and access-restricted route families non-indexable", () => {
    expect(isNonIndexableRoute("/admin/login")).toBe(true);
    expect(isNonIndexableRoute("/contributor/activate/secret-token")).toBe(true);
    expect(isNonIndexableRoute("/contributor-status")).toBe(true);
    expect(isNonIndexableRoute("/irab")).toBe(true);
    expect(isNonIndexableRoute("/search?q=ghazal")).toBe(true);
    expect(isNonIndexableRoute("/poems/812")).toBe(false);
  });

  it("marks unmatched client-side routes as non-indexable 404 pages", () => {
    expect(isClientSide404Route("/unknown-page")).toBe(true);
    expect(isNonIndexableRoute("/unknown-page")).toBe(true);
    expect(isClientSide404Route("/poetry/urdu")).toBe(false);
    expect(isNonIndexableRoute("/poetry/urdu")).toBe(false);
    expect(isNonIndexableRoute("/poetry/unknown")).toBe(true);
    expect(isNonIndexableRoute("/poetry/farsi")).toBe(false);
    expect(isClientSide404Route("/poets/12")).toBe(false);
  });

  it("truncates long descriptions at word boundaries", () => {
    const description = truncateMetaDescription("Urdu poetry ".repeat(20));
    expect(description.length).toBeLessThanOrEqual(160);
    expect(description.endsWith("…")).toBe(true);
    expect(description).not.toMatch(/\s…$/);
  });
});
