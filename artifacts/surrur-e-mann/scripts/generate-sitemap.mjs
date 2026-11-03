import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SITE_ORIGIN = "https://suruureman.com";
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.resolve(SCRIPT_DIR, "../public");
const API_PAGE_SIZE = 2000;

async function fetchJson(pathname) {
  const response = await fetch(new URL(pathname, `${SITE_ORIGIN}/`), {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    throw new Error(`Sitemap source ${new URL(pathname, `${SITE_ORIGIN}/`).pathname} returned HTTP ${response.status}.`);
  }
  if (!response.headers.get("content-type")?.includes("application/json")) {
    throw new Error(`Sitemap source ${new URL(pathname, `${SITE_ORIGIN}/`).pathname} did not return JSON.`);
  }

  return response.json();
}

async function fetchPublicPoems() {
  // Use only the anonymous list endpoint. Poem detail GETs can record views.
  const firstPage = await fetchJson(`/api/poems?limit=${API_PAGE_SIZE}&offset=0`);
  const total = Number(firstPage.total);
  if (!Array.isArray(firstPage.poems) || !Number.isSafeInteger(total) || total < 0) {
    throw new Error("The public poems list returned an unexpected response.");
  }

  const poems = [...firstPage.poems];
  while (poems.length < total) {
    const offset = poems.length;
    const page = await fetchJson(`/api/poems?limit=${API_PAGE_SIZE}&offset=${offset}`);
    if (!Array.isArray(page.poems) || page.poems.length === 0) {
      throw new Error("The public poems list ended before its reported total.");
    }
    poems.push(...page.poems);
  }

  return poems;
}

function xmlEscape(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function absoluteUrl(pathname) {
  return new URL(pathname, `${SITE_ORIGIN}/`).toString();
}

const staticPaths = [
  "/",
  "/poems",
  "/poets",
  "/videos",
  "/poetry/urdu",
  "/poetry/punjabi",
  "/poetry/arabic",
  "/poetry/persian",
  "/poetry/hindi",
  "/poetry/siraiki",
  "/poetry/english",
  "/poetry/spanish",
  "/poetry/punjabi-shahmukhi",
  "/contact",
  "/tools",
  "/radio",
  "/become-a-contributor",
];

const [poems, poetResponse] = await Promise.all([
  fetchPublicPoems(),
  fetchJson("/api/poets"),
]);

if (!Array.isArray(poetResponse.poets)) {
  throw new Error("The public poets list returned an unexpected response.");
}

const urls = new Set(staticPaths.map(absoluteUrl));
const categories = new Set();

for (const poem of poems) {
  if (Number.isSafeInteger(Number(poem.id)) && Number(poem.id) > 0) {
    urls.add(absoluteUrl(`/poems/${Number(poem.id)}`));
  }
  if (typeof poem.category === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(poem.category)) {
    categories.add(poem.category);
  }
}

for (const poet of poetResponse.poets) {
  if (Number.isSafeInteger(Number(poet.id)) && Number(poet.id) > 0) {
    urls.add(absoluteUrl(`/poets/${Number(poet.id)}`));
  }
}

for (const category of categories) {
  const query = new URLSearchParams({ category }).toString();
  urls.add(absoluteUrl(`/poems?${query}`));
}

if (urls.size > 50_000) {
  throw new Error("The generated sitemap exceeds the single-file URL limit.");
}

const urlEntries = [...urls]
  .sort()
  .map((url) => `  <url><loc>${xmlEscape(url)}</loc></url>`)
  .join("\n");
const sitemap = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  urlEntries,
  "</urlset>",
  "",
].join("\n");

await mkdir(PUBLIC_DIR, { recursive: true });
await writeFile(path.join(PUBLIC_DIR, "sitemap.xml"), sitemap, "utf8");
console.log(`Generated sitemap with ${urls.size} URLs from public list endpoints.`);
