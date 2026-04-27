import { useState } from "react";
import {
  useGetCommunity, useListPosts, useGetCommunityStats, useGetLeaderboard,
  getListPostsQueryKey, useCreatePost, getGetCommunityQueryKey,
} from "@workspace/api-client-react";
import { Link, useRoute, useLocation } from "wouter";
import { Layout, UserAvatar } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowUp, MessageSquare, Eye, Plus, ArrowLeft, Users, Stethoscope,
  TrendingUp, Clock, HelpCircle, Bot,
} from "lucide-react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ConsentModal } from "@/components/ConsentModal";
import { cn } from "@/lib/utils";

type Tab = "trending" | "latest" | "unanswered" | "doctor";

export default function Community() {
  const [, params] = useRoute("/communities/:id");
  const [, navigate] = useLocation();
  const communityId = parseInt(params?.id || "0", 10);
  const queryClient = useQueryClient();

  const { data: community, isLoading: communityLoading } = useGetCommunity(communityId, { query: { enabled: !!communityId } });
  const { data: posts, isLoading: postsLoading } = useListPosts(communityId, undefined, { query: { enabled: !!communityId } });
  const { data: stats } = useGetCommunityStats(communityId, { query: { enabled: !!communityId } });
  const { data: leaderboard } = useGetLeaderboard({ period: "weekly" });

  const createPost = useCreatePost();
  const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

  const joinCommunity = useMutation({
    mutationFn: async ({ communityId, isCurrentlyMember }: { communityId: number; isCurrentlyMember: boolean }) => {
      const res = await fetch(`${API_BASE}/communities/${communityId}/join`, {
        method: isCurrentlyMember ? "DELETE" : "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update membership");
      return res.json();
    },
  });

  const [activeTab, setActiveTab] = useState<Tab>("latest");
  const [isPostOpen, setIsPostOpen] = useState(false);
  const [showConsent, setShowConsent] = useState(false);
  const [hasConsented, setHasConsented] = useState(false);
  const [postTitle, setPostTitle] = useState("");
  const [postContent, setPostContent] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const isMember = (community as any)?.isMember ?? false;

  const handleAskClick = () => {
    if (!hasConsented) {
      setShowConsent(true);
    } else {
      setIsPostOpen(true);
    }
  };

  const handleConsent = () => {
    setShowConsent(false);
    setHasConsented(true);
    setIsPostOpen(true);
  };

  const handleJoin = () => {
    joinCommunity.mutate({ communityId, isCurrentlyMember: isMember }, {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: getGetCommunityQueryKey(communityId) });
        toast.success(data?.isMember ? "Joined community!" : "Left community");
      },
      onError: () => toast.error("Failed to update membership"),
    });
  };

  const handleCreatePost = () => {
    if (!postTitle.trim() || !postContent.trim()) {
      toast.error("Title and content are required");
      return;
    }
    createPost.mutate({
      communityId,
      data: { title: postTitle, content: postContent }
    }, {
      onSuccess: () => {
        setIsPostOpen(false);
        setPostTitle("");
        setPostContent("");
        queryClient.invalidateQueries({ queryKey: getListPostsQueryKey(communityId) });
        toast.success("Your question has been posted. Yukti AI is generating a summary...");
      },
      onError: () => toast.error("Failed to create post"),
    });
  };

  const filteredPosts = posts?.filter(p => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return p.title.toLowerCase().includes(q) || p.content.toLowerCase().includes(q);
    }
    return true;
  }) ?? [];

  const sortedPosts = (() => {
    switch (activeTab) {
      case "trending": return [...filteredPosts].sort((a, b) => (b.upvoteCount + b.commentCount * 2) - (a.upvoteCount + a.commentCount * 2));
      case "latest": return [...filteredPosts].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      case "unanswered": return filteredPosts.filter(p => p.commentCount === 0).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      case "doctor": return filteredPosts.filter(p => (p as any).hasDoctorAnswer).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      default: return filteredPosts;
    }
  })();

  if (communityLoading) {
    return (
      <Layout>
        <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-4">
          <Skeleton className="h-44 w-full rounded-2xl" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      </Layout>
    );
  }

  if (!community) return <Layout><div className="p-8 text-center text-muted-foreground">Community not found</div></Layout>;

  return (
    <Layout>
      <div className="max-w-5xl mx-auto pb-24 md:pb-6">
        {/* Hero Banner */}
        <div className="relative" style={{ backgroundColor: community.coverColor || "hsl(var(--primary))" }}>
          <div className="absolute inset-0 bg-gradient-to-b from-black/10 to-black/50" />
          <div className="relative px-4 md:px-8 pt-12 pb-8">
            <button
              onClick={() => navigate("/communities")}
              className="inline-flex items-center gap-1.5 text-white/80 hover:text-white text-sm font-medium mb-6 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> All Communities
            </button>
            <div className="flex items-end justify-between gap-4">
              <div className="flex items-end gap-4">
                <div className="w-16 h-16 md:w-20 md:h-20 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center text-4xl md:text-5xl border border-white/30 shadow-lg">
                  {community.iconEmoji || "🏥"}
                </div>
                <div>
                  <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">{community.name}</h1>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-white/80 text-sm flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" /> {stats?.memberCount ?? community.memberCount} members
                    </span>
                    <span className="text-white/40">•</span>
                    <span className="text-white/80 text-sm">{stats?.postCount ?? community.postCount} posts</span>
                  </div>
                </div>
              </div>
              <Button
                size="sm"
                variant={isMember ? "secondary" : "default"}
                onClick={handleJoin}
                disabled={joinCommunity.isPending}
                className="shrink-0 bg-white/20 hover:bg-white/30 text-white border-white/30 backdrop-blur-sm"
              >
                {isMember ? "✓ Joined" : "+ Join"}
              </Button>
            </div>
          </div>
        </div>

        <div className="px-4 md:px-8 mt-4 space-y-4">
          <p className="text-sm text-muted-foreground leading-relaxed">{community.description}</p>

          {/* Ask Question CTA */}
          <button
            onClick={handleAskClick}
            className="w-full flex items-center gap-3 bg-muted/50 hover:bg-muted rounded-xl px-4 py-3 text-sm text-muted-foreground border border-border/60 transition-colors text-left"
          >
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Plus className="w-4 h-4 text-primary" />
            </div>
            <span>Ask a health question in {community.name}...</span>
          </button>

          {/* Search */}
          <Input
            placeholder="Search discussions..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="bg-background"
          />

          <div className="grid grid-cols-1 xl:grid-cols-[1fr_280px] gap-6">
            {/* Feed */}
            <div>
              <Tabs value={activeTab} onValueChange={v => setActiveTab(v as Tab)}>
                <TabsList className="w-full grid grid-cols-4 mb-4">
                  <TabsTrigger value="trending" className="text-xs gap-1">
                    <TrendingUp className="w-3 h-3" /> Trending
                  </TabsTrigger>
                  <TabsTrigger value="latest" className="text-xs gap-1">
                    <Clock className="w-3 h-3" /> Latest
                  </TabsTrigger>
                  <TabsTrigger value="unanswered" className="text-xs gap-1">
                    <HelpCircle className="w-3 h-3" /> Unanswered
                  </TabsTrigger>
                  <TabsTrigger value="doctor" className="text-xs gap-1">
                    <Stethoscope className="w-3 h-3" /> Doctor
                  </TabsTrigger>
                </TabsList>

                <TabsContent value={activeTab} className="mt-0">
                  <div className="space-y-3">
                    {postsLoading ? (
                      [1, 2, 3].map(i => <Skeleton key={i} className="h-36 w-full rounded-xl" />)
                    ) : sortedPosts.length === 0 ? (
                      <div className="text-center py-14 border rounded-xl border-dashed bg-muted/20">
                        <div className="text-3xl mb-2">💬</div>
                        <p className="text-sm text-muted-foreground">
                          {activeTab === "unanswered" ? "All questions have been answered!" :
                           activeTab === "doctor" ? "No doctor answers yet in this community." :
                           searchQuery ? "No posts match your search." :
                           "No discussions yet. Be the first to ask!"}
                        </p>
                        {activeTab === "latest" && !searchQuery && (
                          <Button size="sm" className="mt-3" onClick={handleAskClick}>Ask the first question</Button>
                        )}
                      </div>
                    ) : (
                      sortedPosts.map(post => (
                        <PostCard key={post.id} post={post} communityId={communityId} />
                      ))
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </div>

            {/* Sidebar */}
            <div className="space-y-5">
              {leaderboard && leaderboard.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Top Contributors</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="divide-y">
                      {leaderboard.slice(0, 5).map((entry, idx) => (
                        <div key={entry.userId} className="flex items-center gap-3 px-4 py-2.5">
                          <span className="text-xs font-bold text-muted-foreground w-4 text-center">{idx + 1}</span>
                          <UserAvatar name={entry.displayName} url={entry.avatarUrl} className="w-7 h-7" />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{entry.displayName}</div>
                            <div className="text-[10px] text-muted-foreground">Level {entry.level}</div>
                          </div>
                          <Badge variant="secondary" className="text-[10px] shrink-0">{entry.credits} HC</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card className="border-primary/20 bg-primary/5">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Bot className="w-4 h-4 text-primary" />
                    <span className="text-sm font-semibold text-primary">Ask Yukti AI</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                    Get an instant AI-powered health guidance — private and personalized.
                  </p>
                  <Link href="/chat">
                    <Button size="sm" variant="default" className="w-full text-xs">Start AI Chat</Button>
                  </Link>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* Consent Modal */}
      <ConsentModal
        open={showConsent}
        onConsent={handleConsent}
        onCancel={() => setShowConsent(false)}
      />

      {/* Ask Question Dialog */}
      <Dialog open={isPostOpen} onOpenChange={setIsPostOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Ask in {community.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Input
              placeholder="What's your health question? (Be specific)"
              value={postTitle}
              onChange={e => setPostTitle(e.target.value)}
              className="font-medium"
            />
            <Textarea
              placeholder="Share more details — symptoms, duration, medications, age, etc. The more context, the better the community can help."
              value={postContent}
              onChange={e => setPostContent(e.target.value)}
              className="min-h-[160px]"
            />
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 flex items-start gap-2">
              <Bot className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                Yukti AI will automatically generate a health summary for your post to help the community respond better.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPostOpen(false)}>Cancel</Button>
            <Button onClick={handleCreatePost} disabled={createPost.isPending || !postTitle.trim() || !postContent.trim()}>
              {createPost.isPending ? "Posting..." : "Post Question"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}

function PostCard({ post, communityId }: { post: any; communityId: number }) {
  const riskColors: Record<string, string> = {
    low: "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400",
    medium: "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400",
    high: "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400",
    emergency: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400",
  };

  return (
    <Link href={`/communities/${communityId}/post/${post.id}`}>
      <Card className="hover:border-primary/40 transition-all cursor-pointer shadow-sm hover:shadow-md group">
        <CardContent className="p-4">
          <div className="flex gap-3">
            {/* Vote Column */}
            <div className="flex flex-col items-center gap-0.5 shrink-0 pt-0.5">
              <ArrowUp className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
              <span className="text-xs font-bold text-foreground">{post.upvoteCount}</span>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1.5 flex-wrap">
                <UserAvatar name={post.authorName} url={post.authorAvatar} className="w-4 h-4" />
                <span className="font-medium text-foreground/80">{post.authorName}</span>
                {post.isBroadcast && (
                  <Badge className="text-[9px] h-4 px-1.5 bg-blue-600">ANNOUNCEMENT</Badge>
                )}
                <span className="text-muted-foreground/50">•</span>
                <span>{formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}</span>
              </div>

              <h3 className="font-bold text-base text-foreground leading-snug mb-1.5 group-hover:text-primary transition-colors">
                {post.title}
              </h3>

              <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed mb-3">
                {post.content}
              </p>

              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <MessageSquare className="w-3.5 h-3.5" /> {post.commentCount}
                </span>
                <span className="flex items-center gap-1">
                  <Eye className="w-3.5 h-3.5" /> {post.viewCount ?? 0}
                </span>
                {post.commentCount === 0 && (
                  <Badge variant="outline" className="text-[9px] h-4 px-1.5 text-amber-600 border-amber-200 bg-amber-50 dark:bg-amber-900/20">
                    Unanswered
                  </Badge>
                )}
                <div className="ml-auto">
                  <Bot className="w-3.5 h-3.5 text-primary/60" title="AI summary available" />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
