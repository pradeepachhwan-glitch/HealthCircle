import { useState } from "react";
import { useBroadcastAnnouncement, useListCommunities, useSummarizeContent } from "@workspace/api-client-react";
import { Layout } from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Send, Sparkles, Video, FileText, Volume2, MessageSquare } from "lucide-react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";

type ContentType = "discussion" | "video" | "article" | "audio";

function detectSource(url: string): string | null {
  if (!url) return null;
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    if (host === "youtu.be" || host.endsWith("youtube.com")) return "youtube";
    if (host === "ted.com" || host.endsWith(".ted.com")) return "ted";
    if (host === "vimeo.com" || host.endsWith(".vimeo.com")) return "vimeo";
    if (host === "spotify.com" || host.endsWith(".spotify.com")) return "spotify";
    return "external";
  } catch { return null; }
}

function deriveYoutubeThumb(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    if (host === "youtu.be") {
      const id = u.pathname.slice(1).split("/")[0];
      return /^[A-Za-z0-9_-]{11}$/.test(id) ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
    }
    if (host.endsWith("youtube.com")) {
      const v = u.searchParams.get("v");
      if (v && /^[A-Za-z0-9_-]{11}$/.test(v)) return `https://i.ytimg.com/vi/${v}/hqdefault.jpg`;
      const m = u.pathname.match(/^\/(embed|shorts|v)\/([A-Za-z0-9_-]{11})/);
      if (m) return `https://i.ytimg.com/vi/${m[2]}/hqdefault.jpg`;
    }
  } catch { /* noop */ }
  return null;
}

export default function Broadcast() {
  const [, setLocation] = useLocation();
  const { data: communities, isLoading } = useListCommunities();
  const broadcastMutation = useBroadcastAnnouncement();
  const summarizeMutation = useSummarizeContent();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [postToAll, setPostToAll] = useState(true);
  const [selectedCommunities, setSelectedCommunities] = useState<number[]>([]);

  // ─── Optional content payload ─────────────────────────────────────
  const [contentType, setContentType] = useState<ContentType>("discussion");
  const [contentUrl, setContentUrl] = useState("");
  const [contentThumbnail, setContentThumbnail] = useState("");
  const [contentDurationMin, setContentDurationMin] = useState("");
  const [contentSummary, setContentSummary] = useState("");

  const detectedSource = contentUrl ? detectSource(contentUrl) : null;
  const autoThumbnail = contentType === "video" && !contentThumbnail ? deriveYoutubeThumb(contentUrl) : null;
  const previewThumbnail = contentThumbnail || autoThumbnail;

  const handleToggleCommunity = (id: number) =>
    setSelectedCommunities(prev => (prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]));

  const handleGenerateSummary = () => {
    if (!title.trim()) {
      toast.error("Add a title first so the AI knows what to summarise");
      return;
    }
    if (contentType !== "discussion" && !contentUrl.trim()) {
      toast.error("Add the content URL first");
      return;
    }
    summarizeMutation.mutate(
      { data: { title: title.trim(), url: contentUrl.trim() || null, contentType } },
      {
        onSuccess: (res) => {
          setContentSummary(res.summary);
          toast.success("AI summary generated");
        },
        onError: (err: unknown) => {
          // Surface the real reason so admins know whether to retry, fix the
          // input, or escalate (e.g. AI service unavailable means the
          // integration itself is broken — not something a retry will solve).
          const msg = err instanceof Error && err.message ? err.message : "Unknown error";
          // eslint-disable-next-line no-console
          console.error("[summarize] failed", err);
          if (/AI service unavailable|503/i.test(msg)) {
            toast.error("AI service is unavailable. The Anthropic/OpenAI integration needs to be reconnected.");
          } else {
            toast.error(`Couldn't generate summary: ${msg.slice(0, 200)}`);
          }
        },
      }
    );
  };

  // Inline validation message: shown directly above the Send button so it
  // can't be missed (toast-only errors disappear in 3s and are easy to lose).
  const validationError: string | null = (() => {
    if (!title.trim()) return "Add an announcement title.";
    if (!content.trim()) return "Add some body text describing the announcement.";
    if (!postToAll && selectedCommunities.length === 0) return "Select at least one community, or turn on “Post to all”.";
    if (contentType !== "discussion" && !contentUrl.trim()) {
      return `You picked the ${contentType} tab — paste a ${contentType} URL above, or switch back to the Discussion tab.`;
    }
    return null;
  })();

  const handleSend = () => {
    if (validationError) {
      toast.error(validationError);
      return;
    }

    const durationSec = contentDurationMin ? Math.floor(Number(contentDurationMin) * 60) : null;

    broadcastMutation.mutate(
      {
        data: {
          title,
          content,
          postToAll,
          communityIds: postToAll ? [] : selectedCommunities,
          contentType,
          contentUrl: contentType === "discussion" ? null : contentUrl.trim(),
          contentSource: contentType === "discussion" ? null : detectedSource,
          contentThumbnail: contentType === "discussion" ? null : (contentThumbnail.trim() || null),
          contentDurationSec: contentType === "discussion" ? null : durationSec,
          contentSummary: contentType === "discussion" ? null : (contentSummary.trim() || null),
        },
      },
      {
        onSuccess: (result) => {
          toast.success(`Broadcasted to ${result.postsCreated} communities`);
          setLocation("/admin");
        },
        onError: (err: unknown) => {
          // Surface the actual server message instead of a generic "Failed".
          // The codegen client throws an Error whose message is the response
          // body when the status is non-2xx — so we render that verbatim.
          const msg = err instanceof Error && err.message ? err.message : "Unknown error";
          // eslint-disable-next-line no-console
          console.error("[broadcast] send failed", err);
          toast.error(`Broadcast failed: ${msg.slice(0, 200)}`);
        },
      }
    );
  };

  return (
    <Layout>
      <div className="max-w-3xl mx-auto p-6 md:p-8">
        <div className="mb-6 flex items-center gap-4">
          <Link href="/admin">
            <Button variant="ghost" size="icon" className="shrink-0">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-foreground tracking-tight">New Broadcast</h1>
            <p className="text-muted-foreground">Post an announcement, video, article or podcast to communities.</p>
          </div>
        </div>

        <Card>
          <CardContent className="p-6 space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Announcement Title</label>
              <Input
                placeholder="Important update..."
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="text-lg py-6"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Body / context</label>
              <Textarea
                placeholder="Write your announcement here..."
                value={content}
                onChange={e => setContent(e.target.value)}
                className="min-h-[140px] resize-y"
              />
            </div>

            {/* ─── Attach content ─────────────────────────────────── */}
            <div className="space-y-3 pt-4 border-t">
              <div>
                <h3 className="text-lg font-medium">Attach content (optional)</h3>
                <p className="text-xs text-muted-foreground">
                  Embed a YouTube video, article or audio that members can play inside the app — no leaving HealthCircle.
                </p>
              </div>

              <Tabs value={contentType} onValueChange={(v) => setContentType(v as ContentType)}>
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="discussion" className="text-xs">
                    <MessageSquare className="w-3.5 h-3.5 mr-1" /> Discussion
                  </TabsTrigger>
                  <TabsTrigger value="video" className="text-xs">
                    <Video className="w-3.5 h-3.5 mr-1" /> Video
                  </TabsTrigger>
                  <TabsTrigger value="article" className="text-xs">
                    <FileText className="w-3.5 h-3.5 mr-1" /> Article
                  </TabsTrigger>
                  <TabsTrigger value="audio" className="text-xs">
                    <Volume2 className="w-3.5 h-3.5 mr-1" /> Audio
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              {contentType !== "discussion" && (
                <div className="space-y-3 p-4 border rounded-lg bg-muted/20">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">Content URL</label>
                    <Input
                      placeholder={
                        contentType === "video" ? "https://www.youtube.com/watch?v=…" :
                        contentType === "article" ? "https://example.com/article-on-bp" :
                        "https://example.com/episode.mp3"
                      }
                      value={contentUrl}
                      onChange={e => setContentUrl(e.target.value)}
                    />
                    {detectedSource && (
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">Source: {detectedSource}</Badge>
                        {autoThumbnail && contentType === "video" && (
                          <Badge variant="outline" className="text-[10px]">Thumbnail auto-derived</Badge>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-foreground">Thumbnail URL (optional)</label>
                      <Input
                        placeholder="https://… (leave blank for YouTube)"
                        value={contentThumbnail}
                        onChange={e => setContentThumbnail(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-foreground">Duration in minutes (optional)</label>
                      <Input
                        type="number"
                        min={0}
                        step={0.5}
                        placeholder="e.g. 12"
                        value={contentDurationMin}
                        onChange={e => setContentDurationMin(e.target.value)}
                      />
                    </div>
                  </div>

                  {previewThumbnail && (
                    <div className="flex gap-3 items-start p-2 bg-white dark:bg-slate-900 border rounded-md">
                      <img src={previewThumbnail} alt="thumbnail preview" className="w-24 h-16 object-cover rounded" />
                      <div className="text-xs text-muted-foreground">
                        <p className="font-medium text-foreground mb-0.5">Preview</p>
                        <p>This is what users will see in the feed.</p>
                      </div>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-foreground">AI-generated summary</label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={handleGenerateSummary}
                        disabled={summarizeMutation.isPending}
                      >
                        <Sparkles className="w-3 h-3 mr-1" />
                        {summarizeMutation.isPending ? "Generating…" : "Generate with AI"}
                      </Button>
                    </div>
                    <Textarea
                      placeholder="2-3 sentence summary shown next to the play button. Click 'Generate with AI' to draft one from the title and URL."
                      value={contentSummary}
                      onChange={e => setContentSummary(e.target.value)}
                      className="min-h-[80px] text-sm resize-y"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* ─── Audience ───────────────────────────────────────── */}
            <div className="space-y-4 pt-4 border-t">
              <h3 className="text-lg font-medium">Target Audience</h3>
              <div className="flex items-center space-x-2 p-3 border rounded-lg bg-muted/20">
                <Checkbox id="postToAll" checked={postToAll} onCheckedChange={(checked) => setPostToAll(checked as boolean)} />
                <label htmlFor="postToAll" className="text-sm font-medium leading-none cursor-pointer">
                  Post to all active communities
                </label>
              </div>

              {!postToAll && communities && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4 p-4 border rounded-lg max-h-60 overflow-y-auto">
                  {communities.filter(c => !c.isArchived).map(community => (
                    <div key={community.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`comm-${community.id}`}
                        checked={selectedCommunities.includes(community.id)}
                        onCheckedChange={() => handleToggleCommunity(community.id)}
                      />
                      <label htmlFor={`comm-${community.id}`} className="text-sm cursor-pointer line-clamp-1 flex items-center gap-1.5">
                        {(community as any).iconUrl ? (
                          <img
                            src={(community as any).iconUrl}
                            alt=""
                            className="w-4 h-4 rounded object-cover bg-white"
                          />
                        ) : (
                          <span>{community.iconEmoji}</span>
                        )}
                        <span className="truncate">{community.name}</span>
                      </label>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {validationError && (
              <div
                className="mt-4 px-4 py-3 rounded-md border border-amber-300 bg-amber-50 text-amber-900 text-sm dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100"
                role="alert"
              >
                <strong className="font-medium">Can't send yet:</strong> {validationError}
              </div>
            )}
            <div className="pt-6 flex justify-end">
              <Button
                size="lg"
                onClick={handleSend}
                disabled={broadcastMutation.isPending || isLoading}
                className="w-full sm:w-auto"
              >
                {broadcastMutation.isPending ? "Sending..." : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Send Broadcast
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
