export const REQUIRED_POEM_FIELDS = [
  { key: "title", label: "English Title" },
  { key: "titleUrdu", label: "Urdu Title" },
  { key: "poetName", label: "Poet" },
  { key: "poetNameUrdu", label: "Poet Urdu Name" },
  { key: "category", label: "Category" },
  { key: "categoryUrdu", label: "Category Urdu Name" },
  { key: "content", label: "Urdu Content" },
  { key: "language", label: "Language" },
] as const;

export type PoemFormValues = Partial<Record<(typeof REQUIRED_POEM_FIELDS)[number]["key"], unknown>>;

export function getMissingPoemFields(values: PoemFormValues | null | undefined): string[] {
  if (!values || typeof values !== "object") {
    return REQUIRED_POEM_FIELDS.map(({ label }) => label);
  }

  return REQUIRED_POEM_FIELDS
    .filter(({ key }) => typeof values[key] !== "string" || !(values[key] as string).trim())
    .map(({ label }) => label);
}

export function getPoemValidationMessage(missingFields: string[]): string {
  return `Please complete all required fields before saving the poem. Missing: ${missingFields.join(", ")}`;
}