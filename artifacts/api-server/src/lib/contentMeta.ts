/**
 * Helpers for in-app content cards (videos / articles / audio) attached to
 * posts. Pure functions — no I/O — so they're easy to unit test.
 *
 * Goals:
 *  - Detect the source from a URL (youtube / ted / vimeo / spotify / external)
 *  - Pull the YouTube video id out of any of the half-dozen URL shapes Google
 *    ships (youtu.be/X, youtube.com/watch?v=X, youtube.com/embed/X,
 *    youtube.com/shorts/X, youtube.com/v/X) so we can build a thumbnail and a
 *    privacy-enhanced embed URL ourselves.
 *  - Keep this dependency-free; it's invoked from a hot admin route.
 */

export type ContentType = "discussion" | "video" | "article" | "audio";
export type ContentSource = "youtube" | "ted" | "vimeo" | "spotify" | "external";

const ALLOWED_TYPES: ReadonlySet<string> = new Set(["discussion", "video", "article", "audio"]);

export function normaliseContentType(raw: unknown): ContentType {
  return typeof raw === "string" && ALLOWED_TYPES.has(raw) ? (raw as ContentType) : "discussion";
}

/**
 * Extract a YouTube video id from any of YouTube's many URL shapes.
 * Returns null if the URL is not a recognised YouTube URL.
 */
export function extractYouTubeId(url: string): string | null {
  if (!url || typeof url !== "string") return null;
  let parsed: URL;
  try { parsed = new URL(url.trim()); } catch { return null; }

  const host = parsed.hostname.toLowerCase().replace(/^www\./, "");

  // youtu.be/<id>
  if (host === "youtu.be") {
    const id = parsed.pathname.slice(1).split("/")[0];
    return isValidYouTubeId(id) ? id : null;
  }

  if (host === "youtube.com" || host === "m.youtube.com" || host === "youtube-nocookie.com") {
    // /watch?v=<id>
    const v = parsed.searchParams.get("v");
    if (v && isValidYouTubeId(v)) return v;

    // /embed/<id>, /v/<id>, /shorts/<id>
    const m = parsed.pathname.match(/^\/(embed|v|shorts)\/([A-Za-z0-9_-]+)/);
    if (m && isValidYouTubeId(m[2])) return m[2];
  }

  return null;
}

function isValidYouTubeId(id: string | undefined | null): id is string {
  // YouTube ids are stable at 11 chars in the [A-Za-z0-9_-] alphabet.
  return !!id && /^[A-Za-z0-9_-]{11}$/.test(id);
}

export function deriveYouTubeThumbnail(videoId: string): string {
  // hqdefault is the most reliably available across all videos (mqdefault
  // sometimes 404s for unlisted clips; maxresdefault is missing for older
  // uploads). 480x360, ~good enough for a card thumbnail.
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

export function buildYouTubeEmbedUrl(videoId: string): string {
  // Privacy-enhanced (no-cookie) host so we don't drop tracking cookies on
  // users who never click play. modestbranding hides the YouTube logo;
  // rel=0 keeps suggested-video chrome in-channel.
  return `https://www.youtube-nocookie.com/embed/${videoId}?modestbranding=1&rel=0`;
}

/**
 * Best-effort detection of the source platform from a URL. Falls back to
 * "external" — we never throw because this runs in admin user-input flows
 * and the source label is purely cosmetic.
 */
export function detectContentSource(url: string): ContentSource {
  if (!url) return "external";
  let host = "";
  try { host = new URL(url).hostname.toLowerCase().replace(/^www\./, ""); } catch { return "external"; }

  if (host === "youtu.be" || host.endsWith("youtube.com") || host === "youtube-nocookie.com") return "youtube";
  if (host === "ted.com" || host.endsWith(".ted.com")) return "ted";
  if (host === "vimeo.com" || host.endsWith(".vimeo.com")) return "vimeo";
  if (host === "spotify.com" || host.endsWith(".spotify.com")) return "spotify";
  return "external";
}

/**
 * One-stop normaliser used by the broadcast route. Given the (possibly
 * partial) content fields from the admin UI, returns a canonical record
 * ready to insert. Returns nulls for everything when contentType is
 * 'discussion' (so legacy broadcasts keep their pristine null payload).
 */
export interface NormalisedContentFields {
  contentType: ContentType;
  contentUrl: string | null;
  contentSource: ContentSource | null;
  contentThumbnail: string | null;
  contentDurationSec: number | null;
  contentSummary: string | null;
}

export function normaliseContentFields(input: {
  contentType?: unknown;
  contentUrl?: unknown;
  contentSource?: unknown;
  contentThumbnail?: unknown;
  contentDurationSec?: unknown;
  contentSummary?: unknown;
}): NormalisedContentFields {
  const contentType = normaliseContentType(input.contentType);

  if (contentType === "discussion") {
    return {
      contentType: "discussion",
      contentUrl: null,
      contentSource: null,
      contentThumbnail: null,
      contentDurationSec: null,
      contentSummary: null,
    };
  }

  const rawUrl = typeof input.contentUrl === "string" ? input.contentUrl.trim() : "";
  const contentUrl = rawUrl.length > 0 && rawUrl.length <= 2048 ? rawUrl : null;

  const explicitSource = typeof input.contentSource === "string" ? input.contentSource.trim().toLowerCase() : "";
  const contentSource: ContentSource | null = contentUrl
    ? (explicitSource && ["youtube", "ted", "vimeo", "spotify", "external"].includes(explicitSource)
        ? (explicitSource as ContentSource)
        : detectContentSource(contentUrl))
    : null;

  // Auto-derive a YouTube thumbnail when the admin didn't supply one.
  let contentThumbnail: string | null = null;
  const explicitThumb = typeof input.contentThumbnail === "string" ? input.contentThumbnail.trim() : "";
  if (explicitThumb.length > 0 && explicitThumb.length <= 2048) {
    contentThumbnail = explicitThumb;
  } else if (contentSource === "youtube" && contentUrl) {
    const ytId = extractYouTubeId(contentUrl);
    if (ytId) contentThumbnail = deriveYouTubeThumbnail(ytId);
  }

  const rawDur = typeof input.contentDurationSec === "number" ? input.contentDurationSec : Number(input.contentDurationSec);
  const contentDurationSec = Number.isFinite(rawDur) && rawDur > 0 && rawDur < 60 * 60 * 24
    ? Math.floor(rawDur)
    : null;

  const rawSummary = typeof input.contentSummary === "string" ? input.contentSummary.trim() : "";
  const contentSummary = rawSummary.length > 0 && rawSummary.length <= 4000 ? rawSummary : null;

  return { contentType, contentUrl, contentSource, contentThumbnail, contentDurationSec, contentSummary };
}
