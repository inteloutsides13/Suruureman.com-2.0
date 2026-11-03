import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { REQUIRED_POEM_FIELDS, getMissingPoemFields } from "./poemValidation.js";

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

describe("poem required-field validation", () => {
  it("allows a complete poem with an empty image URL and Featured unchecked", () => {
    assert.deepEqual(getMissingPoemFields(validPoem), []);
  });

  it("rejects every required field when it is missing, empty, or whitespace-only", () => {
    for (const field of REQUIRED_POEM_FIELDS) {
      assert.deepEqual(getMissingPoemFields({ ...validPoem, [field]: undefined }), [field]);
      assert.deepEqual(getMissingPoemFields({ ...validPoem, [field]: "" }), [field]);
      assert.deepEqual(getMissingPoemFields({ ...validPoem, [field]: "   " }), [field]);
    }
  });

  it("uses the same rule for create and update payloads", () => {
    const clearedContent = { ...validPoem, content: "" };
    assert.deepEqual(getMissingPoemFields(clearedContent), ["content"]);
    assert.deepEqual(getMissingPoemFields({ ...clearedContent }), ["content"]);
  });

  it("is role-independent for Developer, Admin, and Contributor", () => {
    for (const role of ["developer", "admin", "contributor"]) {
      assert.deepEqual(getMissingPoemFields({ ...validPoem, language: "" }), ["language"], role);
      assert.deepEqual(getMissingPoemFields(validPoem), [], role);
    }
  });
});