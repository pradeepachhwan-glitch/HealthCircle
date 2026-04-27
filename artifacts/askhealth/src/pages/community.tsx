import { useState } from "react";
import { useGetCommunity, useListPosts, useGetPinnedPosts, useGetCommunityStats, useGetCommunityMembers, useGetLeaderboard, getListPostsQueryKey, useCreatePost } from "@workspace/api-client-react";
import { Link, useRoute } from "wouter";
import { Layout, UserAvatar } from "@/components/Layout";
import { YuktiChat } from "@/components/YuktiChat";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowUp, MessageSquare, Pin, Plus, Calendar, Image as ImageIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

export default function Community() {
  const [, params] = useRoute("/communities/:id");
  const communityId = parseInt(params?.id || "0", 10);
  const queryClient = useQueryClient();

  const { data: community, isLoading: communityLoading } = useGetCommunity(communityId, { query: { enabled: !!communityId } });
  const { data: posts, isLoading: postsLoading } = useListPosts(communityId, undefined, { query: { enabled: !!communityId } });
  const { data: pinnedPosts } = useGetPinnedPosts(communityId, { query: { enabled: !!communityId } });
  const { data: stats } = useGetCommunityStats(communityId, { query: { enabled: !!communityId } });
  const { data: leaderboard } = useGetLeaderboard({ period: "weekly" });
  
  const createPost = useCreatePost();

  const [isPostOpen, setIsPostOpen] = useState(false);
  const [postTitle, setPostTitle] = useState("");
  const [postContent, setPostContent] = useState("");
  const [postImage, setPostImage] = useState("");

  const handleCreatePost = () => {
    if (!postTitle.trim() || !postContent.trim()) {
      toast.error("Title and content are required");
      return;
    }

    createPost.mutate({
      communityId,
      data: {
        title: postTitle,
        content: postContent,
        imageUrl: postImage || undefined
      }
    }, {
      onSuccess: () => {
        setIsPostOpen(false);
        setPostTitle("");
        setPostContent("");
        setPostImage("");
        queryClient.invalidateQueries({ queryKey: getListPostsQueryKey(communityId) });
        toast.success("Post created successfully");
      },
      onError: () => toast.error("Failed to create post")
    });
  };

  if (communityLoading) {
    return (
      <Layout>
        <div className="max-w-6xl mx-auto p-6">
          <Skeleton className="h-48 w-full rounded-xl mb-8" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-4">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-48 w-full" />
            </div>
            <div className="space-y-6">
              <Skeleton className="h-64 w-full" />
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (!community) return <Layout><div className="p-8 text-center text-muted-foreground">Community not found</div></Layout>;

  return (
    <Layout>
      <div className="max-w-6xl mx-auto">
        {/* Banner */}
        <div 
          className="h-32 md:h-48 w-full"
          style={{ backgroundColor: community.coverColor || "hsl(var(--primary))" }}
        />
        
        <div className="px-6 md:px-8 pb-8 -mt-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
            <div className="flex items-end gap-4">
              <div className="w-16 h-16 md:w-20 md:h-20 bg-card rounded-xl shadow-sm border flex items-center justify-center text-4xl md:text-5xl">
                {community.iconEmoji || "🏥"}
              </div>
              <div className="mb-1">
                <h1 className="text-2xl md:text-3xl font-bold text-foreground">{community.name}</h1>
                <p className="text-muted-foreground text-sm max-w-2xl">{community.description}</p>
              </div>
            </div>
            
            <Dialog open={isPostOpen} onOpenChange={setIsPostOpen}>
              <DialogTrigger asChild>
                <Button size="lg" className="shrink-0 shadow-sm">
                  <Plus className="w-4 h-4 mr-2" /> New Discussion
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                  <DialogTitle>Create a New Discussion</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <Input 
                    placeholder="Discussion title..." 
                    value={postTitle}
                    onChange={(e) => setPostTitle(e.target.value)}
                    className="text-lg font-medium"
                  />
                  <Textarea 
                    placeholder="Share your clinical insights, ask a question, or start a discussion..."
                    value={postContent}
                    onChange={(e) => setPostContent(e.target.value)}
                    className="min-h-[200px]"
                  />
                  <div className="relative">
                    <ImageIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                    <Input 
                      placeholder="Optional image URL..." 
                      value={postImage}
                      onChange={(e) => setPostImage(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsPostOpen(false)}>Cancel</Button>
                  <Button onClick={handleCreatePost} disabled={createPost.isPending}>
                    {createPost.isPending ? "Posting..." : "Post Discussion"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-8">
            {/* Feed Content */}
            <div className="space-y-6">
              {/* Pinned Posts */}
              {pinnedPosts && pinnedPosts.length > 0 && (
                <div className="space-y-4 mb-8">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                    <Pin className="w-4 h-4" /> Pinned Discussions
                  </h3>
                  {pinnedPosts.map(post => (
                    <PostCard key={post.id} post={post} communityId={communityId} />
                  ))}
                </div>
              )}

              {/* Regular Posts */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Recent Discussions
                </h3>
                {postsLoading ? (
                  [1, 2, 3].map(i => <Skeleton key={i} className="h-40 w-full rounded-xl" />)
                ) : posts?.length === 0 ? (
                  <div className="text-center py-12 border rounded-xl bg-muted/20 border-dashed">
                    <p className="text-muted-foreground">No discussions yet. Be the first to post!</p>
                  </div>
                ) : (
                  posts?.map(post => (
                    <PostCard key={post.id} post={post} communityId={communityId} />
                  ))
                )}
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold">About Community</CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Members</span>
                    <span className="font-medium">{stats?.memberCount || community.memberCount}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Discussions</span>
                    <span className="font-medium">{stats?.postCount || community.postCount}</span>
                  </div>
                  <div className="pt-4 border-t flex items-center gap-2 text-muted-foreground text-xs">
                    <Calendar className="w-4 h-4" />
                    Created {new Date(community.createdAt).toLocaleDateString()}
                  </div>
                </CardContent>
              </Card>

              {leaderboard && leaderboard.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-semibold">Top Contributors</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="divide-y">
                      {leaderboard.slice(0, 5).map((entry, idx) => (
                        <div key={entry.userId} className="flex items-center gap-3 p-3">
                          <div className="font-bold text-muted-foreground text-xs w-4 text-center">{idx + 1}</div>
                          <UserAvatar name={entry.displayName} url={entry.avatarUrl} className="w-8 h-8" />
                          <div className="flex-1 overflow-hidden">
                            <div className="font-medium text-sm truncate">{entry.displayName}</div>
                            <div className="text-[10px] text-muted-foreground">Level {entry.level}</div>
                          </div>
                          <div className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                            {entry.credits} HC
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>
      
      <YuktiChat communityId={community.id} communityName={community.name} />
    </Layout>
  );
}

function PostCard({ post, communityId }: { post: any, communityId: number }) {
  return (
    <Link href={`/communities/${communityId}/post/${post.id}`}>
      <Card className="hover:border-primary/30 transition-colors cursor-pointer border-border shadow-sm">
        <CardContent className="p-5">
          <div className="flex items-start gap-4">
            <div className="flex flex-col items-center gap-1 shrink-0 text-muted-foreground w-8">
              <ArrowUp className="w-5 h-5 hover:text-primary transition-colors" />
              <span className="font-medium text-sm text-foreground">{post.upvoteCount}</span>
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                <UserAvatar name={post.authorName} url={post.authorAvatar} className="w-5 h-5" />
                <span className="font-medium text-foreground">{post.authorName}</span>
                {post.authorLevel && <Badge variant="secondary" className="text-[9px] h-4 px-1.5 font-medium">Lvl {post.authorLevel}</Badge>}
                {post.isBroadcast && <Badge variant="default" className="text-[9px] h-4 px-1.5 font-medium bg-blue-600">ANNOUNCEMENT</Badge>}
                <span>•</span>
                <span>{formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}</span>
              </div>
              
              <h3 className="font-bold text-lg text-foreground mb-2 leading-snug">{post.title}</h3>
              <p className="text-sm text-muted-foreground line-clamp-3 mb-4 leading-relaxed">
                {post.content}
              </p>
              
              {post.imageUrl && (
                <div className="rounded-lg overflow-hidden mb-4 border max-h-[300px] bg-muted/20">
                  <img src={post.imageUrl} alt="Post attachment" className="w-full h-full object-cover" />
                </div>
              )}
              
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
                  <MessageSquare className="w-4 h-4" />
                  {post.commentCount} Comments
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
