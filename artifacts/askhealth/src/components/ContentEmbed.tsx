import { useState } from "react";
import { Play, FileText, Volume2, Sparkles, ExternalLink, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLocation } from "wouter";

/**
 * In-app player for content cards attached to broadcasts/posts.
 *
 * Renders three flavours from the same data shape:
 *   - video  → privacy-enhanced YouTube nocookie iframe (lazy: thumbnail
 *              first, swap to iframe on click so we don't slam the page
 *              with an iframe per feed item)
 *   - audio  → native HTML5 <audio controls>
 *   - article→ "Read inside app" button → sandboxed iframe in a dialog so
 *              users never leave HealthCircle
 *
 * Every card includes an "Ask Yukti about this" CTA that deep-links into
 * the chat with a pre-filled prompt that mentions the content title and
 * pins the conversation to the originating community.
 */

export interface ContentPayload {
  contentType: "video" | "article" | "audio";
  contentUrl: string | null;
  contentSource: string | null;
  contentThumbnail: string | null;
  contentDurationSec: number | null;
  contentSummary: string | null;
}

interface Props {
  title: string;
  payload: ContentPayload;
  /** Slug of the community this content was broadcast into — used to pin the
   *  Yukti conversation to the matching community persona. */
  communitySlug?: string | null;
  communityName?: string | null;
}

function extractYouTubeId(url: string): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    if (host === "youtu.be") return /^[A-Za-z0-9_-]{11}$/.test(u.pathname.slice(1)) ? u.pathname.slice(1) : null;
    if (host.endsWith("youtube.com") || host === "youtube-nocookie.com") {
      const v = u.searchParams.get("v");
      if (v && /^[A-Za-z0-9_-]{11}$/.test(v)) return v;
      const m = u.pathname.match(/^\/(embed|v|shorts)\/([A-Za-z0-9_-]{11})/);
      if (m) return m[2];
    }
  } catch { /* noop */ }
  return null;
}

function formatDuration(sec: number | null): string | null {
  if (!sec || sec <= 0) return null;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m >= 60
    ? `${Math.floor(m / 60)}h ${m % 60}m`
    : `${m}:${s.toString().padStart(2, "0")}`;
}

export function ContentEmbed({ title, payload, communitySlug, communityName }: Props) {
  const [, setLocation] = useLocation();
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [articleOpen, setArticleOpen] = useState(false);

  const duration = formatDuration(payload.contentDurationSec);
  const sourceLabel = payload.contentSource
    ? payload.contentSource[0].toUpperCase() + payload.contentSource.slice(1)
    : null;

  const askYukti = (e: React.MouseEvent) => {
    // Stop the parent <Link> on the post card from also firing.
    e.preventDefault();
    e.stopPropagation();
    const verb = payload.contentType === "video" ? "video" : payload.contentType === "audio" ? "audio" : "article";
    const prompt = `Can you summarise this ${verb} for me and tell me what's most important to take away from it? Title: "${title}"`;
    const params = new URLSearchParams();
    params.set("prompt", prompt);
    if (communitySlug) params.set("community", communitySlug);
    if (communityName) params.set("communityName", communityName);
    setLocation(`/chat?${params.toString()}`);
  };

  const stopBubble = (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); };

  return (
    <div className="mt-3 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden bg-slate-50 dark:bg-slate-900/40" onClick={stopBubble}>
      {/* ─── Video ─────────────────────────────────────────────────── */}
      {payload.contentType === "video" && payload.contentUrl && (() => {
        const videoId = extractYouTubeId(payload.contentUrl);
        const thumb = payload.contentThumbnail || (videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : null);
        return (
          <div className="relative aspect-video bg-black">
            {videoPlaying && videoId ? (
              <iframe
                title={title}
                className="absolute inset-0 w-full h-full"
                src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&modestbranding=1&rel=0`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <button
                type="button"
                onClick={(e) => { stopBubble(e); if (videoId) setVideoPlaying(true); else window.open(payload.contentUrl!, "_blank", "noopener,noreferrer"); }}
                className="absolute inset-0 w-full h-full group"
              >
                {thumb ? (
                  <img src={thumb} alt={title} loading="lazy" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-slate-700 to-slate-900" />
                )}
                <div className="absolute inset-0 bg-black/30 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                  <div className="w-16 h-16 rounded-full bg-red-600 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                    <Play className="w-7 h-7 text-white fill-white ml-1" />
                  </div>
                </div>
                {(sourceLabel || duration) && (
                  <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-xs">
                    {sourceLabel && <Badge className="bg-black/70 text-white border-0">{sourceLabel}</Badge>}
                    {duration && <Badge className="bg-black/70 text-white border-0">{duration}</Badge>}
                  </div>
                )}
              </button>
            )}
          </div>
        );
      })()}

      {/* ─── Audio ─────────────────────────────────────────────────── */}
      {payload.contentType === "audio" && payload.contentUrl && (
        <div className="p-4 flex items-center gap-3 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/40 dark:to-purple-950/40">
          <div className="w-12 h-12 rounded-full bg-indigo-600 flex items-center justify-center shrink-0">
            <Volume2 className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {sourceLabel && <Badge variant="outline" className="text-[10px]">{sourceLabel}</Badge>}
              {duration && <span className="text-xs text-muted-foreground">{duration}</span>}
            </div>
            <audio
              controls
              preload="none"
              src={payload.contentUrl}
              className="w-full h-8"
              onClick={stopBubble}
            />
          </div>
        </div>
      )}

      {/* ─── Article ───────────────────────────────────────────────── */}
      {payload.contentType === "article" && payload.contentUrl && (
        <div className="flex gap-3 p-3">
          {payload.contentThumbnail ? (
            <img src={payload.contentThumbnail} alt={title} loading="lazy" className="w-24 h-24 rounded-lg object-cover shrink-0" />
          ) : (
            <div className="w-24 h-24 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shrink-0">
              <FileText className="w-10 h-10 text-white" />
            </div>
          )}
          <div className="flex-1 min-w-0 flex flex-col">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              {sourceLabel && <Badge variant="outline" className="text-[10px]">{sourceLabel}</Badge>}
              <Badge className="text-[10px] bg-blue-600">ARTICLE</Badge>
            </div>
            <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
              {payload.contentSummary || "Tap to read inside the app."}
            </p>
            <div className="mt-auto">
              <Button
                size="sm"
                variant="secondary"
                onClick={(e) => { stopBubble(e); setArticleOpen(true); }}
                className="h-7 text-xs"
              >
                Read inside app
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Summary + Yukti CTA (always shown for non-discussion payloads) ─── */}
      <div className="px-3 py-3 border-t border-slate-200 dark:border-slate-700 space-y-2">
        {payload.contentSummary && payload.contentType !== "article" && (
          <p className="text-xs text-muted-foreground leading-relaxed">{payload.contentSummary}</p>
        )}
        <Button
          size="sm"
          onClick={askYukti}
          className="w-full h-8 text-xs bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white"
        >
          <Sparkles className="w-3.5 h-3.5 mr-1.5" />
          Ask Yukti about this
        </Button>
      </div>

      {/* ─── In-app article webview ───────────────────────────────── */}
      <Dialog open={articleOpen} onOpenChange={setArticleOpen}>
        <DialogContent className="max-w-4xl w-[95vw] h-[85vh] p-0 gap-0 flex flex-col">
          <DialogHeader className="px-4 py-3 border-b shrink-0 flex flex-row items-center justify-between space-y-0">
            <DialogTitle className="text-base line-clamp-1 pr-4">{title}</DialogTitle>
            <div className="flex items-center gap-2 shrink-0">
              <a
                href={payload.contentUrl ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
              >
                <ExternalLink className="w-3 h-3" /> Open in new tab
              </a>
              <button onClick={() => setArticleOpen(false)} className="text-muted-foreground hover:text-foreground p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
          </DialogHeader>
          <div className="flex-1 min-h-0">
            {articleOpen && payload.contentUrl && (
              <iframe
                title={title}
                src={payload.contentUrl}
                className="w-full h-full border-0"
                sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
                referrerPolicy="no-referrer"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
