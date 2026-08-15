import { eq } from 'drizzle-orm';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { Database } from '../db/client.js';
import { projects } from '../db/schema.js';
import { env } from '../env.js';

const FETCH_TIMEOUT_MS = 8000;
const MAX_HTML_BYTES = 512 * 1024;
const MAX_ICON_BYTES = 1024 * 1024;

const EXT_MIME: Record<string, string> = {
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

function iconPath(iconsDir: string, projectId: number): string {
  return join(iconsDir, String(projectId));
}

function log(...args: unknown[]): void {
  console.log('[icons]', ...args);
}

async function fetchBytes(url: string, maxBytes: number): Promise<Response> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    redirect: 'follow',
    headers: { 'user-agent': 'slang-icon-fetcher/1.0', accept: '*/*' },
  });
  if (!res.ok) throw new Error(`fetch_failed:${res.status}`);
  const length = Number(res.headers.get('content-length') ?? 0);
  if (length > maxBytes) throw new Error('response_too_large');
  return res;
}

/** `<link rel="...icon...">` candidates from an HTML head, best first. */
function findIconLinks(html: string, base: URL): string[] {
  const candidates: Array<{ href: string; score: number }> = [];
  const linkRe = /<link\b[^>]*>/gi;
  for (const match of html.matchAll(linkRe)) {
    const tag = match[0];
    const rel = /rel\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1]?.toLowerCase() ?? '';
    if (!/(^|\s)(shortcut\s+)?icon(\s|$)|apple-touch-icon|mask-icon/.test(rel)) continue;
    const href = /href\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1];
    if (!href || href.startsWith('data:')) continue;
    // Prefer png (broad support), then larger declared sizes, then anything.
    const sizes = /sizes\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1] ?? '';
    const size = Math.max(0, ...sizes.split(/\s+/).map((s) => parseInt(s, 10) || 0));
    let score = size;
    if (/\.png(\?|$)/i.test(href)) score += 1000;
    if (rel.includes('apple-touch-icon')) score += 500;
    if (/\.svg(\?|$)/i.test(href)) score -= 500;
    try {
      candidates.push({ href: new URL(href, base).toString(), score });
    } catch {
      // Unresolvable href — skip.
    }
  }
  return candidates.sort((a, b) => b.score - a.score).map((c) => c.href);
}

function mimeFor(url: string, contentType: string | null): string | null {
  const fromHeader = contentType?.split(';')[0]?.trim().toLowerCase();
  if (fromHeader?.startsWith('image/')) return fromHeader;
  const ext = /\.[a-z0-9]+/i.exec(new URL(url).pathname)?.[0]?.toLowerCase();
  return (ext && EXT_MIME[ext]) || null;
}

/**
 * Downloads the favicon for the project's URL (HTML `<link rel=icon>` first,
 * `/favicon.ico` as fallback) and stores it at `<ICONS_DIR>/<projectId>`.
 * Updates `projects.iconMimeType`; clears it when no icon could be fetched.
 * Returns the stored mime type, or null on failure. Never throws.
 */
export async function fetchAndStoreIcon(
  db: Database,
  projectId: number,
  rawUrl: string | null,
  iconsDir: string = env.ICONS_DIR,
): Promise<string | null> {
  try {
    if (!rawUrl) throw new Error('no_url');
    const pageUrl = new URL(/^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`);
    log(`project ${projectId}: fetching icon for ${pageUrl}`);

    const candidates: string[] = [];
    try {
      const res = await fetchBytes(pageUrl.toString(), MAX_HTML_BYTES);
      const html = await res.text();
      candidates.push(...findIconLinks(html.slice(0, MAX_HTML_BYTES), new URL(res.url || pageUrl)));
      log(`project ${projectId}: page ok, icon links found:`, candidates);
    } catch (error) {
      log(`project ${projectId}: page fetch failed (${String(error)}), trying /favicon.ico`);
    }
    candidates.push(new URL('/favicon.ico', pageUrl).toString());

    for (const iconUrl of [...new Set(candidates)]) {
      try {
        const res = await fetchBytes(iconUrl, MAX_ICON_BYTES);
        const mime = mimeFor(res.url || iconUrl, res.headers.get('content-type'));
        if (!mime) {
          log(`project ${projectId}: ${iconUrl} — unrecognized content-type, skipped`);
          continue;
        }
        const bytes = Buffer.from(await res.arrayBuffer());
        if (bytes.length === 0 || bytes.length > MAX_ICON_BYTES) {
          log(`project ${projectId}: ${iconUrl} — bad size ${bytes.length}, skipped`);
          continue;
        }
        await mkdir(iconsDir, { recursive: true });
        await writeFile(iconPath(iconsDir, projectId), bytes);
        await db.update(projects).set({ iconMimeType: mime }).where(eq(projects.id, projectId));
        log(`project ${projectId}: stored ${mime} (${bytes.length} bytes) from ${iconUrl}`);
        return mime;
      } catch (error) {
        log(`project ${projectId}: ${iconUrl} failed (${String(error)})`);
      }
    }
    throw new Error('icon_not_found');
  } catch (error) {
    log(`project ${projectId}: no icon (${String(error)}), clearing`);
    await clearIcon(db, projectId, iconsDir);
    return null;
  }
}

/** Removes a stored icon file and clears the mime type. Never throws. */
export async function clearIcon(
  db: Database,
  projectId: number,
  iconsDir: string = env.ICONS_DIR,
): Promise<void> {
  await rm(iconPath(iconsDir, projectId), { force: true }).catch(() => {});
  await db
    .update(projects)
    .set({ iconMimeType: null })
    .where(eq(projects.id, projectId))
    .catch(() => {});
}
