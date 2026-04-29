import { useState, useEffect, useRef } from "react";
import { useGetPost, useListComments, useCreateComment, useUpvotePost, getGetPostQueryKey, getListCommentsQueryKey } from "@workspace/api-client-react";
import { Link, useRoute, useLocation } from "wouter";
import { Layout, UserAvatar } from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowUp, ArrowLeft, MessageSquare, Eye, Bot, Stethoscope,
  BookOpen, Heart, AlertTriangle, CheckCircle2, Clock,
  BookMarked, CalendarPlus, Share2, UserCheck,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

interface AiSummary {
  whatItCouldBe: string;
  riskLevel: "low" | "medium" | "high" | "emergency";
  whatToDo: string;
  whenToSeeDoctor: string;
  disclaimer: string;
}

const riskConfig = {
  low: { label: "Low Risk", color: "text-green-600", bg: "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800", icon: CheckCircle2, iconColor: "text-green-500" },
  medium: { label: "Moderate", color: "text-yellow-600", bg: "bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800", icon: Clock, iconColor: "text-yellow-500" },
  high: { label: "High Risk", color: "text-orange-600", bg: "bg-orange-50 border-orange-200 dark:bg-orange-900/20 dark:border-orange-800", icon: AlertTriangle, iconColor: "text-orange-500" },
  emergency: { label: "Emergency", color: "text-red-600", bg: "bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800", icon: AlertTriangle, iconColor: "text-red-500" },
};

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

export default function PostDetail() {
  const [, params] = useRoute("/communities/:communityId/post/:postId");
  const [, navigate] = useLocation();
  const communityId = parseInt(params?.communityId || "0", 10);
  const postId = parseInt(params?.postId || "0", 10);
  const queryClient = useQueryClient();

  const { data: post, isLoading: postLoading } = useGetPost(postId, {
    query: { queryKey: getGetPostQueryKey(postId), enabled: !!postId },
  });
  const { data: comments, isLoading: commentsLoading } = useListComments(postId, {
    query: { queryKey: getListCommentsQueryKey(postId), enabled: !!postId },
  });

  const createComment = useCreateComment();
  const upvotePost = useUpvotePost();

  const [commentContent, setCommentContent] = useState("");
  // True for ~12s after the user posts a comment that mentions @askYukti.
  // Yukti's bot reply is generated asynchronously on the server (typically
  // 1-3s), so we poll/refresh comments for a short window and show a
  // "Yukti is preparing a reply…" indicator until the bot comment lands.
  const [yuktiPending, setYuktiPending] = useState(false);
  const yuktiTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearYuktiTimers = () => {
    for (const t of yuktiTimersRef.current) clearTimeout(t);
    yuktiTimersRef.current = [];
  };

  // Clean up any pending Yukti polling timers when the user leaves the page
  // or the post changes. Without this, a user navigating away mid-poll would
  // trigger setState on an unmounted component and waste network calls.
  useEffect(() => {
    return () => clearYuktiTimers();
  }, [postId]);
  const [aiSummary, setAiSummary] = useState<AiSummary | null>(null);
  type AiStatus = "loading" | "ready" | "generating" | "unavailable" | "failed";
  const [aiStatus, setAiStatus] = useState<AiStatus>("loading");
  const [aiRetryNonce, setAiRetryNonce] = useState(0);
  const [consultationRequested, setConsultationRequested] = useState(false);

  // Server is the source of truth for the saved state. Local mirror exists only
  // so the icon flips immediately on click; useEffect below keeps it in sync.
  const [bookmarked, setBookmarked] = useState<boolean>(!!(post as { hasBookmarked?: boolean } | undefined)?.hasBookmarked);
  useEffect(() => {
    setBookmarked(!!(post as { hasBookmarked?: boolean } | undefined)?.hasBookmarked);
  }, [(post as { hasBookmarked?: boolean } | undefined)?.hasBookmarked]);

  const bookmarkMutation = useMutation({
    mutationFn: async (): Promise<{ bookmarked: boolean }> => {
      const r = await fetch(`${API_BASE}/posts/${postId}/bookmark`, { method: "POST", credentials: "include" });
      if (!r.ok) throw new Error("Bookmark failed");
      return r.json();
    },
    onMutate: () => {
      const previous = bookmarked;
      setBookmarked(!previous);
      return { previous };
    },
    onSuccess: (data) => {
      setBookmarked(data.bookmarked);
      queryClient.invalidateQueries({ queryKey: getGetPostQueryKey(postId) });
      toast.success(data.bookmarked ? "Saved to your bookmarks" : "Removed from bookmarks");
    },
    onError: (_err, _vars, context) => {
      if (context) setBookmarked(context.previous);
      toast.error("Couldn't update your bookmark. Please try again.");
    },
  });

  const requestConsultation = useMutation({
    mutationFn: async () => {
      const r = await fetch(`${API_BASE}/posts/${postId}/request-consultation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          riskLevel: aiSummary?.riskLevel ?? "high",
          reason: `User requested professional review for post: ${post?.title ?? ""}`,
        }),
      });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    onSuccess: (data) => {
      setConsultationRequested(true);
      toast.success(data.alreadyExists ? "Request already submitted" : "Doctor's opinion requested! A medical professional will review this.");
    },
    onError: () => toast.error("Could not submit request. Please try again."),
  });

  // AI summary fetcher — polls only while server reports `generating`. Stops
  // immediately on `ready`, `unavailable`, or hard failure. Manual "Try again"
  // bumps `aiRetryNonce` to re-run this effect.
  useEffect(() => {
    if (!postId) return;
    let cancelled = false;
    let attempts = 0;
    const MAX_ATTEMPTS = 8;        // ~32 seconds total
    const POLL_INTERVAL_MS = 4000;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const controller = new AbortController();

    setAiStatus("loading");
    setAiSummary(null);

    type SummaryResponse =
      | { status: "ready"; summary: AiSummary }
      | { status: "generating" }
      | { status: "unavailable" };

    const tick = async () => {
      attempts++;
      try {
        const res = await fetch(`${API_BASE}/posts/${postId}/ai-summary`, {
          credentials: "include",
          signal: controller.signal,
        });
        if (cancelled) return;
        if (!res.ok) {
          // Hard failure (404 means post deleted; otherwise surface as failed).
          setAiStatus("failed");
          return;
        }
        const data = (await res.json()) as SummaryResponse;
        if (cancelled) return;
        if (data.status === "ready") {
          setAiSummary(data.summary);
          setAiStatus("ready");
        } else if (data.status === "unavailable") {
          setAiStatus("unavailable");
        } else if (data.status === "generating") {
          if (attempts >= MAX_ATTEMPTS) {
            setAiStatus("failed");
          } else {
            setAiStatus("generating");
            timer = setTimeout(tick, POLL_INTERVAL_MS);
          }
        }
      } catch (err) {
        if (cancelled || (err as Error)?.name === "AbortError") return;
        console.error("AI summary fetch failed", err);
        setAiStatus("failed");
      }
    };

    tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      controller.abort();
    };
  }, [postId, aiRetryNonce]);

  const handleUpvote = () => {
    if (upvotePost.isPending) return;
    upvotePost.mutate({ postId }, {
      onSuccess: (result) => {
        queryClient.setQueryData(getGetPostQueryKey(postId), (old: unknown) => {
          if (!old || typeof old !== "object") return old;
          return { ...(old as object), upvoteCount: result.upvoteCount, hasUpvoted: result.hasUpvoted };
        });
      },
      onError: () => toast.error("Couldn't save your vote. Please try again."),
    });
  };

  const handleComment = () => {
    if (!commentContent.trim()) return;
    const submitted = commentContent;
    const tagsYukti = /@askYukti/i.test(submitted);
    createComment.mutate({ postId, data: { content: submitted } }, {
      onSuccess: () => {
        setCommentContent("");
        queryClient.invalidateQueries({ queryKey: getListCommentsQueryKey(postId) });
        queryClient.invalidateQueries({ queryKey: getGetPostQueryKey(postId) });
        toast.success("Reply posted");

        // Yukti's reply is generated on the server asynchronously after the
        // comment is created. Poll a few times so it shows up automatically
        // without the user needing to refresh. Timer handles are tracked in
        // a ref so they can be cancelled on unmount or when a new
        // Yukti-tagged comment is posted before the previous polling window
        // has elapsed.
        if (tagsYukti) {
          clearYuktiTimers();
          setYuktiPending(true);
          const refreshes = [2000, 5000, 9000, 14000];
          for (const ms of refreshes) {
            yuktiTimersRef.current.push(
              setTimeout(() => {
                queryClient.invalidateQueries({ queryKey: getListCommentsQueryKey(postId) });
                queryClient.invalidateQueries({ queryKey: getGetPostQueryKey(postId) });
              }, ms),
            );
          }
          yuktiTimersRef.current.push(
            setTimeout(() => setYuktiPending(false), 16000),
          );
        }
      },
      onError: () => toast.error("Failed to post reply"),
    });
  };

  if (postLoading) {
    return (
      <Layout>
        <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-4">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      </Layout>
    );
  }

  if (!post) return <Layout><div className="p-8 text-center text-muted-foreground">Post not found</div></Layout>;

  const risk = riskConfig[aiSummary?.riskLevel ?? "low"];
  const RiskIcon = risk.icon;

  return (
    <Layout>
      <div className="max-w-3xl mx-auto p-4 md:p-6 pb-24 md:pb-6 space-y-4">
        {/* Back */}
        <button
          onClick={() => navigate(`/communities/${communityId}`)}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Community
        </button>

        {/* Post Card */}
        <Card className="overflow-hidden border-border shadow-sm">
          {post.isBroadcast && (
            <div className="bg-blue-600 text-white px-4 py-1.5 text-xs font-bold tracking-wider text-center">
              OFFICIAL ANNOUNCEMENT
            </div>
          )}
          <CardContent className="p-5 md:p-7">
            {/* Author Row */}
            <div className="flex items-center gap-2.5 text-sm text-muted-foreground mb-4">
              <UserAvatar name={post.authorName} url={post.authorAvatar} className="w-8 h-8" />
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground">{post.authorName}</span>
                  {post.authorLevel && <Badge variant="secondary" className="text-[10px] h-4">Lvl {post.authorLevel}</Badge>}
                </div>
                <div className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}</div>
              </div>
            </div>

            {/* Title */}
            <h1 className="font-extrabold text-xl md:text-2xl text-foreground mb-3 leading-tight tracking-tight">
              {post.title}
            </h1>

            {/* Content */}
            <p className="text-sm md:text-base text-foreground/85 whitespace-pre-wrap leading-relaxed mb-5">
              {post.content}
            </p>

            {post.imageUrl && (
              <div className="rounded-xl overflow-hidden mb-5 border bg-muted/10">
                <img src={post.imageUrl} alt="Post attachment" className="w-full max-h-[400px] object-contain" />
              </div>
            )}

            {/* Meta Row */}
            <div className="flex items-center gap-3 pt-4 border-t text-sm text-muted-foreground">
              <button
                onClick={handleUpvote}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors font-medium",
                  post.hasUpvoted
                    ? "text-primary bg-primary/10 hover:bg-primary/20"
                    : "hover:bg-muted text-muted-foreground"
                )}
              >
                <ArrowUp className="w-4 h-4" />
                <span>{post.upvoteCount}</span>
              </button>
              <span className="flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4" /> {post.commentCount}
              </span>
              <span className="flex items-center gap-1.5">
                <Eye className="w-4 h-4" /> {(post.viewCount ?? 0) + 1}
              </span>
              <button
                className="flex items-center gap-1.5 ml-auto disabled:opacity-50"
                onClick={() => bookmarkMutation.mutate()}
                disabled={bookmarkMutation.isPending}
                aria-label={bookmarked ? "Remove bookmark" : "Save post"}
                data-testid="button-bookmark-header"
              >
                <BookMarked className={cn("w-4 h-4 transition-colors", bookmarked ? "text-primary fill-primary" : "text-muted-foreground")} />
              </button>
              <button
                className="flex items-center gap-1.5"
                onClick={async () => {
                  try {
                    if (navigator.share) {
                      await navigator.share({ title: post.title, url: window.location.href });
                    } else {
                      await navigator.clipboard.writeText(window.location.href);
                      toast.success("Link copied");
                    }
                  } catch (err) {
                    if ((err as Error)?.name !== "AbortError") {
                      toast.error("Couldn't share. Try copying the URL from the address bar.");
                    }
                  }
                }}
                aria-label="Share post"
              >
                <Share2 className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
          </CardContent>
        </Card>

        {/* AI Summary Box — pinned & prominent */}
        <Card className={cn("border", aiSummary ? risk.bg : "border-border")}>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <Bot className="w-4 h-4 text-primary" />
              <span className="text-sm font-bold text-primary">Yukti AI Summary</span>
              {aiSummary && (
                <Badge className={cn("ml-auto text-[10px] px-2 py-0", risk.color, "bg-transparent border", risk.bg.split(" ")[1])}>
                  <RiskIcon className={cn("w-3 h-3 mr-1", risk.iconColor)} /> {risk.label}
                </Badge>
              )}
            </div>

            {(aiStatus === "loading" || aiStatus === "generating") && !aiSummary ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
                  <div className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-pulse delay-100" />
                  <div className="w-1.5 h-1.5 bg-primary/30 rounded-full animate-pulse delay-200" />
                  <span>Yukti is analysing this question…</span>
                </div>
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            ) : aiSummary ? (
              <div className="space-y-3 text-sm">
                <div>
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 flex items-center gap-1.5">
                    <BookOpen className="w-3 h-3" /> What this could be
                  </div>
                  <p className="text-foreground leading-relaxed">{aiSummary.whatItCouldBe}</p>
                </div>
                <div>
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3 h-3" /> What to do now
                  </div>
                  <p className="text-foreground leading-relaxed">{aiSummary.whatToDo}</p>
                </div>
                <div>
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 flex items-center gap-1.5">
                    <Stethoscope className="w-3 h-3" /> When to see a doctor
                  </div>
                  <p className="text-foreground leading-relaxed">{aiSummary.whenToSeeDoctor}</p>
                </div>
                <p className="text-[10px] text-muted-foreground border-t pt-2 mt-2 leading-relaxed">{aiSummary.disclaimer}</p>
                {(aiSummary.riskLevel === "high" || aiSummary.riskLevel === "emergency") && (
                  <div className="pt-2">
                    {consultationRequested ? (
                      <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-200 px-3 py-2 rounded-lg">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        Doctor consultation requested — a medical professional will review this.
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full gap-2 text-xs border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100"
                        onClick={() => requestConsultation.mutate()}
                        disabled={requestConsultation.isPending}
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        {requestConsultation.isPending ? "Requesting…" : "Get a Doctor's Opinion"}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  {aiStatus === "unavailable"
                    ? "Yukti AI isn't available right now. The community can still help — see the replies below."
                    : "Yukti couldn't analyse this post. You can try again in a moment."}
                </p>
                {aiStatus === "failed" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs h-8"
                    onClick={() => setAiRetryNonce(n => n + 1)}
                    data-testid="button-ai-summary-retry"
                  >
                    Try again
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Action Panel */}
        <div className="grid grid-cols-3 gap-2">
          <Link href="/providers">
            <Button variant="outline" className="w-full h-auto py-3 flex-col gap-1 text-xs font-medium">
              <CalendarPlus className="w-4 h-4 text-primary" />
              Book Doctor
            </Button>
          </Link>
          <Link href="/chat">
            <Button variant="outline" className="w-full h-auto py-3 flex-col gap-1 text-xs font-medium">
              <Bot className="w-4 h-4 text-primary" />
              Ask Yukti AI
            </Button>
          </Link>
          <Button
            variant="outline"
            className="w-full h-auto py-3 flex-col gap-1 text-xs font-medium"
            onClick={() => bookmarkMutation.mutate()}
            disabled={bookmarkMutation.isPending}
            data-testid="button-bookmark-action"
          >
            <BookMarked className={cn("w-4 h-4 transition-colors", bookmarked ? "text-primary fill-primary" : "text-muted-foreground")} />
            {bookmarked ? "Saved" : "Save Post"}
          </Button>
        </div>

        {/* Community Replies */}
        <div className="space-y-4 pt-2">
          <h3 className="font-bold text-base flex items-center gap-2">
            Community Replies
            <Badge variant="secondary" className="font-normal">{post.commentCount}</Badge>
          </h3>

          {/* Write Reply */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <Textarea
                placeholder="Share your experience or advice — be kind and constructive... (type @askYukti to get a reply from Yukti AI)"
                value={commentContent}
                onChange={e => setCommentContent(e.target.value)}
                className="min-h-[90px] resize-y bg-background text-sm"
              />
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] text-muted-foreground">
                  Tip: mention <span className="font-semibold text-primary">@askYukti</span> for an AI-guided response in this thread
                </p>
                <Button
                  size="sm"
                  onClick={handleComment}
                  disabled={!commentContent.trim() || createComment.isPending}
                >
                  {createComment.isPending ? "Posting..." : "Post Reply"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Comment List */}
          <div className="space-y-3">
            {yuktiPending && (
              <div className="flex items-center gap-3 p-3 rounded-xl border bg-primary/5 border-primary/20">
                <div className="shrink-0 w-7 h-7 rounded-full bg-ai-gradient flex items-center justify-center shadow-sm">
                  <Bot className="w-3.5 h-3.5 text-white" />
                </div>
                <div className="flex-1 text-xs">
                  <span className="font-semibold text-primary">Yukti is preparing a reply…</span>
                  <span className="text-muted-foreground"> usually a few seconds</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                  <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-pulse delay-100" />
                  <span className="w-1.5 h-1.5 rounded-full bg-primary/30 animate-pulse delay-200" />
                </div>
              </div>
            )}
            {commentsLoading ? (
              [1, 2].map(i => <Skeleton key={i} className="h-28 w-full rounded-xl" />)
            ) : comments?.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground text-sm">
                <div className="text-2xl mb-2">💬</div>
                Be the first to reply and help this community member!
              </div>
            ) : (
              comments?.map(comment => (
                <CommentCard key={comment.id} comment={comment} />
              ))
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}

function CommentCard({ comment }: { comment: any }) {
  const isDoctor = comment.authorRole === "doctor" || (comment as any).isDoctor;
  const isYuktiBot = comment.authorId === "bot:yukti" || comment.authorName === "Yukti AI";

  if (isYuktiBot) {
    return (
      <div className="flex gap-3 p-4 rounded-xl border bg-primary/5 border-primary/20">
        <div className="shrink-0 w-8 h-8 mt-0.5 rounded-full bg-ai-gradient flex items-center justify-center shadow-sm">
          <Bot className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <span className="text-sm font-semibold text-primary">Yukti AI</span>
            <Badge className="text-[9px] h-4 px-1.5 bg-primary/10 text-primary border border-primary/20">AI Response</Badge>
            <span className="text-xs text-muted-foreground ml-auto">{formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}</span>
          </div>
          <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">{comment.content}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "flex gap-3 p-4 rounded-xl border transition-colors",
      isDoctor ? "bg-blue-50/50 border-blue-200 dark:bg-blue-900/10 dark:border-blue-800" : "bg-card border-border/60 shadow-sm"
    )}>
      <div className="relative shrink-0">
        <UserAvatar name={comment.authorName} url={comment.authorAvatar} className="w-8 h-8 mt-0.5" />
        {isDoctor && (
          <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-blue-600 rounded-full flex items-center justify-center">
            <Stethoscope className="w-2.5 h-2.5 text-white" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1.5">
          <span className="text-sm font-semibold text-foreground">{comment.authorName}</span>
          {isDoctor && (
            <Badge className="text-[9px] h-4 px-1.5 bg-blue-600 text-white">Doctor</Badge>
          )}
          {comment.authorLevel && !isDoctor && (
            <Badge variant="secondary" className="text-[9px] h-4 px-1.5">Lvl {comment.authorLevel}</Badge>
          )}
          <span className="text-xs text-muted-foreground ml-auto">{formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}</span>
        </div>
        <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">{comment.content}</p>
      </div>
    </div>
  );
}
