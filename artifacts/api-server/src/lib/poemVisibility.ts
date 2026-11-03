import { eq, type SQL } from "drizzle-orm";
import { poemsTable } from "@workspace/db/schema";

export function isPoemVisible(status: unknown, canViewUnpublished: boolean): boolean {
  return canViewUnpublished || status === "published";
}

export function filterPoemsForVisibility<T extends { status?: unknown }>(
  poems: T[],
  canViewUnpublished: boolean,
): T[] {
  return poems.filter((poem) => isPoemVisible(poem.status, canViewUnpublished));
}

export function buildPoemVisibilityWhere(canViewUnpublished: boolean): SQL<unknown> | undefined {
  return canViewUnpublished ? undefined : eq((poemsTable as any).status, "published");
}

/** Explicit public response allowlist; creator identity stays on the protected admin endpoint. */
export function mapPublicPoem(p: typeof poemsTable.$inferSelect) {
  return {
    id: p.id,
    title: p.title,
    titleUrdu: p.titleUrdu,
    content: p.content,
    poetName: p.poetName,
    poetNameUrdu: p.poetNameUrdu,
    category: p.category,
    categoryUrdu: p.categoryUrdu,
    featured: p.featured,
    imageUrl: p.imageUrl ?? null,
    likes: p.likes,
    views: p.views,
    shares: p.shares,
    visualPoetry: p.visualPoetry,
    language: p.language,
    status: (p as any).status,
    createdAt: p.createdAt.toISOString(),
  };
}
