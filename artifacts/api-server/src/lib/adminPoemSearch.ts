import { ListAdminPoemsQueryParams, CreatePoemBody } from "@workspace/api-zod";
import { and, eq, ilike, inArray, or, type SQL } from "drizzle-orm";
import { poemsTable, usersTable } from "@workspace/db/schema";
import { poemLanguageFilterValues } from "./poemLanguageAliases.js";

export interface AdminPoemsQuery {
  limit: number;
  offset: number;
  search?: string;
  language?: string;
}

export function parseAdminPoemsQuery(input: unknown): AdminPoemsQuery | null {
  const parsed = ListAdminPoemsQueryParams.safeParse(input);
  if (!parsed.success) return null;

  const { limit, offset, search, language } = parsed.data;
  if (
    (limit !== undefined && !Number.isInteger(limit))
    || (offset !== undefined && !Number.isInteger(offset))
  ) {
    return null;
  }

  return {
    limit: Math.max(1, Math.min(limit ?? 2000, 2000)),
    offset: Math.max(0, offset ?? 0),
    search: search?.trim() || undefined,
    language,
  };
}

export function isSupportedPoemLanguage(value: unknown): value is string {
  return typeof value === "string"
    && CreatePoemBody.shape.language.safeParse(value).success;
}

function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

export function buildAdminPoemSearchWhereClause(
  search?: string,
  language?: string,
): SQL | undefined {
  const conditions: SQL[] = [];

  if (language) conditions.push(inArray(poemsTable.language, poemLanguageFilterValues(language)));

  const term = search?.trim();
  if (term) {
    const pattern = `%${escapeLikePattern(term)}%`;
    const searchClause = or(
      ilike(poemsTable.title, pattern),
      ilike(poemsTable.titleUrdu, pattern),
      ilike(poemsTable.content, pattern),
      ilike(poemsTable.poetName, pattern),
      ilike(poemsTable.poetNameUrdu, pattern),
      ilike(usersTable.name, pattern),
    );
    if (searchClause) conditions.push(searchClause);
  }

  return conditions.length ? and(...conditions) : undefined;
}
