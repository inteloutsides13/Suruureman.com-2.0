import { useEffect } from "react";
import { getPoemLanguage } from "@/lib/poem-languages";

export const SITE_ORIGIN = "https://suruureman.com";
const SITE_NAME = "Surrur-e-Mann";
const DEFAULT_DESCRIPTION =
  "Surrur-e-Mann (Suruureman) — سُرُورِ مَن — an Urdu poetry library featuring ghazals, nazms, and classical poetry.";

function upsertMeta(selector: string, attr: string, content: string) {
  let el = document.querySelector(selector) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement("meta");
    const [attrName, attrValue] = attr.split("=");
    el.setAttribute(attrName, attrValue);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function upsertCanonicalLink(href: string) {
  let el = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement("link");
    el.rel = "canonical";
    document.head.appendChild(el);
  }
  el.href = href;
}

export function getCanonicalUrl(pathname: string, search = ""): string {
  const pathWithoutQuery = pathname.split(/[?#]/, 1)[0] || "/";
  const safePath = `/${pathWithoutQuery.replace(/^\/+/, "").replace(/\/+/g, "/")}`;
  const canonicalPath = safePath === "/" ? "/" : safePath.replace(/\/+$/, "");
  const url = new URL(canonicalPath, `${SITE_ORIGIN}/`);

  if (url.pathname === "/poems") {
    const category = new URLSearchParams(search).get("category")?.trim();
    if (category) url.searchParams.set("category", category);
  }
  if (url.pathname === "/poetry/farsi") {
    url.pathname = "/poetry/persian";
  }

  return url.toString();
}

export function isNonIndexableRoute(pathname: string): boolean {
  const path = `/${pathname.split(/[?#]/, 1)[0].replace(/^\/+/, "").replace(/\/+$/, "")}`;
  const languageRoute = /^\/poetry\/([^/]+)$/.exec(path);
  return (
    path === "/admin" ||
    path.startsWith("/admin/") ||
    path === "/contributor" ||
    path.startsWith("/contributor/") ||
    path === "/contributor-status" ||
    path === "/irab" ||
    path.startsWith("/irab/") ||
    path === "/search" ||
    (languageRoute !== null && !getPoemLanguage(languageRoute[1])) ||
    isClientSide404Route(path)
  );
}

export function isClientSide404Route(pathname: string): boolean {
  const path = `/${pathname.split(/[?#]/, 1)[0].replace(/^\/+/, "").replace(/\/+$/, "")}`;
  const knownRoutes = new Set([
    "/",
    "/poems",
    "/videos",
    "/poets",
    "/search",
    "/contact",
    "/tools",
    "/irab",
    "/radio",
    "/become-a-contributor",
    "/contributor-status",
  ]);

  return !(
    knownRoutes.has(path) ||
    /^\/poetry\/[^/]+$/.test(path) ||
    /^\/poems\/[^/]+$/.test(path) ||
    /^\/poets\/[^/]+$/.test(path)
  );
}

export function useSeoRouteMetadata(pathname: string, search = "") {
  useEffect(() => {
    const canonicalUrl = getCanonicalUrl(pathname, search);
    upsertCanonicalLink(canonicalUrl);
    upsertMeta('meta[property="og:url"]', "property=og:url", canonicalUrl);
    upsertMeta(
      'meta[name="robots"]',
      "name=robots",
      isNonIndexableRoute(pathname) ? "noindex, nofollow" : "index, follow",
    );
  }, [pathname, search]);
}

function getOgImage(path?: string): string {
  if (!path) return `${SITE_ORIGIN}/opengraph.jpg`;
  if (/^https?:\/\//i.test(path)) return path;
  return new URL(path.startsWith("/") ? path : `/${path}`, `${SITE_ORIGIN}/`).toString();
}

export interface SeoOptions {
  title?: string;
  description?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  ogType?: "website" | "article";
  noindex?: boolean;
}

export function useSeo({
  title,
  description,
  ogTitle,
  ogDescription,
  ogImage,
  ogType = "website",
  noindex = false,
}: SeoOptions = {}) {
  useEffect(() => {
    const fullTitle = title ? `${title} | ${SITE_NAME}` : `${SITE_NAME} | Urdu Poetry`;
    const desc = description || DEFAULT_DESCRIPTION;
    const resolvedOgImage = getOgImage(ogImage);
    const canonicalUrl = getCanonicalUrl(window.location.pathname, window.location.search);

    document.title = fullTitle;

    upsertMeta('meta[name="description"]', "name=description", desc);

    upsertMeta('meta[property="og:title"]', "property=og:title", ogTitle || fullTitle);
    upsertMeta('meta[property="og:description"]', "property=og:description", ogDescription || desc);
    upsertMeta('meta[property="og:image"]', "property=og:image", resolvedOgImage);
    upsertMeta('meta[property="og:type"]', "property=og:type", ogType);
    upsertMeta('meta[property="og:site_name"]', "property=og:site_name", SITE_NAME);
    upsertMeta('meta[property="og:url"]', "property=og:url", canonicalUrl);

    upsertMeta('meta[name="twitter:card"]', "name=twitter:card", "summary_large_image");
    upsertMeta('meta[name="twitter:title"]', "name=twitter:title", ogTitle || fullTitle);
    upsertMeta('meta[name="twitter:description"]', "name=twitter:description", ogDescription || desc);
    upsertMeta('meta[name="twitter:image"]', "name=twitter:image", resolvedOgImage);
    if (noindex) {
      upsertMeta('meta[name="robots"]', "name=robots", "noindex, nofollow");
    }
    upsertCanonicalLink(canonicalUrl);

    return () => {
      document.title = `${SITE_NAME} | Urdu Poetry`;
    };
  }, [title, description, ogTitle, ogDescription, ogImage, ogType, noindex]);
}

export function truncateMetaDescription(value: string, maxLength = 160): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;

  const limit = Math.max(1, maxLength - 1);
  const shortened = normalized.slice(0, limit);
  const lastSpace = shortened.lastIndexOf(" ");
  const boundary = lastSpace >= Math.floor(limit * 0.65) ? lastSpace : limit;
  return `${shortened.slice(0, boundary).trimEnd()}…`;
}
