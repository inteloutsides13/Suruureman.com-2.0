import { describe, expect, it } from "vitest";
import { getMissingPoemFields, getPoemValidationMessage } from "./poem-validation";

const validPoem = {
  title: "A poem",
  titleUrdu: "ایک نظم",
  content: "اردو کلام",
  poetName: "Poet",
  poetNameUrdu: "شاعر",
  category: "ghazal",
  categoryUrdu: "غزل",
  language: "urdu",
  imageUrl: "",
  featured: false,
};

describe("frontend poem validation", () => {
  it("allows valid required fields with optional image and Featured values", () => {
    expect(getMissingPoemFields(validPoem)).toEqual([]);
  });

  it.each([
    ["title", "English Title"],
    ["titleUrdu", "Urdu Title"],
    ["poetName", "Poet"],
    ["poetNameUrdu", "Poet Urdu Name"],
    ["category", "Category"],
    ["categoryUrdu", "Category Urdu Name"],
    ["content", "Urdu Content"],
    ["language", "Language"],
  ])("identifies a missing %s field", (field, label) => {
    expect(getMissingPoemFields({ ...validPoem, [field]: "  " })).toEqual([label]);
  });

  it("returns a clear message listing missing fields", () => {
    expect(getPoemValidationMessage(["Urdu Title", "Language"])).toBe(
      "Please complete all required fields before saving the poem. Missing: Urdu Title, Language",
    );
  });
});