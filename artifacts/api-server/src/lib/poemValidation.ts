export const REQUIRED_POEM_FIELDS = [
  "title",
  "titleUrdu",
  "content",
  "poetName",
  "poetNameUrdu",
  "category",
  "categoryUrdu",
  "language",
] as const;

export type PoemValidationBody = Partial<Record<(typeof REQUIRED_POEM_FIELDS)[number], unknown>>;

function isBlank(value: unknown): boolean {
  return typeof value !== "string" || value.trim().length === 0;
}

export function getMissingPoemFields(body: PoemValidationBody | null | undefined): string[] {
  if (!body || typeof body !== "object") {
    return [...REQUIRED_POEM_FIELDS];
  }

  return REQUIRED_POEM_FIELDS.filter((field) => isBlank(body[field]));
}