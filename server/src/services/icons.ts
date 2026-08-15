import { eq } from 'drizzle-orm';
import { lookup } from 'node:dns/promises';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { Database } from '../db/client.js';
import { projects } from '../db/schema.js';
import { env } from '../env.js';

const FETCH_TIMEOUT_MS = 8000;
const MAX_HTML_BYTES = 512 * 1024;
const MAX_ICON_BYTES = 1024 * 1024;
const MAX_REDIRECTS = 3;
const MAX_CANDIDATES = 4;

// Raster types only: SVG is active content and must not be served from our origin.
const ALLOWED_MIMES = new Set([
  'image/x-icon',
  'image/vnd.microsoft.icon',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
]);

const EXT_MIME: Record<string, string> = {
  '.ico': 'image/x-icon',
  '.png': 'image/png',
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

function isPrivateIp(ip: string): boolean {
  if (ip.includes(':')) {
    const v6 = ip.toLowerCase();
    if (v6 === '::1' || v6 === '::') return true;
    if (v6.startsWith('fe80:') || v6.startsWith('fc') || v6.startsWith('fd')) return true;
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(v6)?.[1];
    return mapped ? isPrivateIp(mapped) : false;
  }
  const [a, b] = ip.split('.').map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b! >= 64 && b! <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b! >= 16 && b! <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a! >= 224
  );
}

/** SSRF policy: http(s) only, and the hostname must resolve to public IPs. */
async function assertPublicUrl(url: URL, allowPrivateHosts: boolean): Promise<void> {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('scheme_not_allowed');
  }
  if (allowPrivateHosts) return;
  const { address, family } = await lookup(url.hostname);
  const addresses = [address];
  if (addresses.some(isPrivateIp)) throw new Error(`address_not_allowed:${family}`);
}

async function readLimited(res: Response, maxBytes: number): Promise<Buffer> {
  if (!res.body) return Buffer.alloc(0);
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error('response_too_large');
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

/**
 * Fetches a URL with a byte-capped streamed body. Redirects are followed
 * manually so every target re-passes the SSRF policy.
 */
async function fetchBytes(
  url: string,
  maxBytes: number,
  allowPrivateHosts: boolean,
): Promise<{ res: Response; bytes: Buffer }> {
  let current = new URL(url);
  for (let redirects = 0; ; redirects++) {
    await assertPublicUrl(current, allowPrivateHosts);
    const res = await fetch(current, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      redirect: 'manual',
      headers: { 'user-agent': 'slang-icon-fetcher/1.0', accept: '*/*' },
    });
    if (res.status >= 300 && res.status < 400) {
      if (redirects >= MAX_REDIRECTS) throw new Error('too_many_redirects');
      const location = res.headers.get('location');
      if (!location) throw new Error(`fetch_failed:${res.status}`);
      current = new URL(location, current);
      continue;
    }
    if (!res.ok) throw new Error(`fetch_failed:${res.status}`);
    const length = Number(res.headers.get('content-length') ?? 0);
    if (length > maxBytes) throw new Error('response_too_large');
    return { res, bytes: await readLimited(res, maxBytes) };
  }
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
    // Skip data URLs and SVG (active content, not served from our origin).
    if (!href || href.startsWith('data:') || /\.svg(\?|$)/i.test(href)) continue;
    // Prefer png (broad support), then larger declared sizes, then anything.
    const sizes = /sizes\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1] ?? '';
    const size = Math.max(0, ...sizes.split(/\s+/).map((s) => parseInt(s, 10) || 0));
    let score = size;
    if (/\.png(\?|$)/i.test(href)) score += 1000;
    if (rel.includes('apple-touch-icon')) score += 500;
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
  if (fromHeader && ALLOWED_MIMES.has(fromHeader)) return fromHeader;
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
  /** Test-only escape hatch: permits loopback/private fixture servers. */
  allowPrivateHosts = false,
): Promise<string | null> {
  try {
    if (!rawUrl) throw new Error('no_url');
    const pageUrl = new URL(/^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`);
    log(`project ${projectId}: fetching icon for ${pageUrl}`);

    const candidates: string[] = [];
    try {
      const { res, bytes } = await fetchBytes(pageUrl.toString(), MAX_HTML_BYTES, allowPrivateHosts);
      candidates.push(
        ...findIconLinks(bytes.toString('utf8'), new URL(res.url || pageUrl)),
      );
      log(`project ${projectId}: page ok, icon links found:`, candidates);
    } catch (error) {
      log(`project ${projectId}: page fetch failed (${String(error)}), trying /favicon.ico`);
    }
    // Bound the number of outbound fetches: top candidates + the fallback.
    candidates.length = Math.min(candidates.length, MAX_CANDIDATES);
    candidates.push(new URL('/favicon.ico', pageUrl).toString());

    for (const iconUrl of [...new Set(candidates)]) {
      try {
        const { res, bytes } = await fetchBytes(iconUrl, MAX_ICON_BYTES, allowPrivateHosts);
        const mime = mimeFor(res.url || iconUrl, res.headers.get('content-type'));
        if (!mime) {
          log(`project ${projectId}: ${iconUrl} — unrecognized content-type, skipped`);
          continue;
        }
        if (bytes.length === 0) {
          log(`project ${projectId}: ${iconUrl} — empty body, skipped`);
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
