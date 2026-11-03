import { describe, expect, it } from "vitest";
import { getPoemLanguage, getPoemLanguageLabel, POEM_LANGUAGES } from "./poem-languages";

describe("poem language options", () => {
  it("exposes one canonical Persian option and keeps the other language options", () => {
    expect(POEM_LANGUAGES.map(({ value }) => value)).toEqual([
      "urdu",
      "punjabi",
      "arabic",
      "persian",
      "hindi",
      "siraiki",
      "english",
      "spanish",
      "punjabi-shahmukhi",
    ]);
    expect(new Set(POEM_LANGUAGES.map(({ value }) => value)).size).toBe(POEM_LANGUAGES.length);
    expect(POEM_LANGUAGES.filter(({ labelUrdu }) => labelUrdu === "فارسی")).toHaveLength(1);
    expect(getPoemLanguage("english")?.label).toBe("English");
    expect(getPoemLanguage("spanish")?.label).toBe("Spanish / Español");
    expect(getPoemLanguage("punjabi-shahmukhi")?.label).toBe("Punjabi (Shahmukhi)");
    expect(getPoemLanguage("punjabi-shahmukhi")?.description).toContain("Shahmukhi script");
    expect(getPoemLanguage("farsi")?.value).toBe("persian");
    expect(getPoemLanguageLabel("farsi")).toBe("Persian (legacy Farsi)");
    expect(getPoemLanguageLabel("punjabi")).toBe("Punjabi");
    expect(getPoemLanguageLabel("legacy-language")).toBe("legacy-language");
  });
});
