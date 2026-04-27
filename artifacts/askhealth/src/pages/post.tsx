import { useState } from "react";
import { useGetPost, useListComments, useCreateComment, useUpvotePost, getGetPostQueryKey, getListCommentsQueryKey } from "@workspace/api-client-react";
import { Link, useRoute } from "wouter";
import { Layout, UserAvatar } from "@/components/Layout";
import { YuktiChat } from "@/components/YuktiChat";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ArrowUp, ArrowLeft, MessageSquare, Share2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

export default function PostDetail() {
  const [, params] = useRoute("/communities/:communityId/post/:postId");
  const communityId = parseInt(params?.communityId || "0", 10);
  const postId = parseInt(params?.postId || "0", 10);
  const queryClient = useQueryClient();

  const { data: post, isLoading: postLoading } = useGetPost(postId, { query: { enabled: !!postId } });
  const { data: comments, isLoading: commentsLoading } = useListComments(postId, { query: { enabled: !!postId } });
  
  const createComment = useCreateComment();
  const upvotePost = useUpvotePost();

  const [commentContent, setCommentContent] = useState("");

  const handleUpvote = () => {
    if (upvotePost.isPending) return;
    
    upvotePost.mutate({ postId }, {
      onSuccess: (result) => {
        // Optimistically update
        queryClient.setQueryData(getGetPostQueryKey(postId), (old: any) => 
          old ? { ...old, upvoteCount: result.upvoteCount, hasUpvoted: result.hasUpvoted } : old
        );
      }
    });
  };

  const handleComment = () => {
    if (!commentContent.trim()) return;

    createComment.mutate({
      postId,
      data: { content: commentContent }
    }, {
      onSuccess: () => {
        setCommentContent("");
        queryClient.invalidateQueries({ queryKey: getListCommentsQueryKey(postId) });
        queryClient.invalidateQueries({ queryKey: getGetPostQueryKey(postId) });
        toast.success("Comment posted");
      },
      onError: () => toast.error("Failed to post comment")
    });
  };

  if (postLoading) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto p-6 md:p-8 space-y-6">
          <Skeleton className="h-8 w-32" />
          <Card>
            <CardContent className="p-6">
              <div className="flex gap-4">
                <Skeleton className="w-8 h-16 shrink-0" />
                <div className="flex-1 space-y-4">
                  <Skeleton className="h-6 w-1/4" />
                  <Skeleton className="h-10 w-3/4" />
                  <Skeleton className="h-48 w-full" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  if (!post) return <Layout><div className="p-8 text-center">Post not found</div></Layout>;

  return (
    <Layout>
      <div className="max-w-4xl mx-auto p-6 md:p-8">
        <Link href={`/communities/${communityId}`} className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Community
        </Link>

        {/* Main Post */}
        <Card className="mb-8 border-border shadow-sm overflow-hidden">
          {post.isBroadcast && (
            <div className="bg-blue-600 text-white px-4 py-1.5 text-xs font-bold tracking-wider flex items-center justify-center">
              OFFICIAL ANNOUNCEMENT
            </div>
          )}
          <CardContent className="p-6 sm:p-8">
            <div className="flex items-start gap-4 sm:gap-6">
              <div className="flex flex-col items-center gap-1 shrink-0">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className={`w-10 h-10 rounded-full ${post.hasUpvoted ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:bg-muted'}`}
                  onClick={handleUpvote}
                >
                  <ArrowUp className="w-6 h-6" />
                </Button>
                <span className={`font-bold text-lg ${post.hasUpvoted ? 'text-primary' : 'text-foreground'}`}>
                  {post.upvoteCount}
                </span>
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2.5 text-sm text-muted-foreground mb-4">
                  <UserAvatar name={post.authorName} url={post.authorAvatar} className="w-6 h-6" />
                  <span className="font-semibold text-foreground">{post.authorName}</span>
                  {post.authorLevel && <Badge variant="secondary" className="text-[10px] h-5 font-medium">Lvl {post.authorLevel}</Badge>}
                  <span className="text-muted-foreground/50">•</span>
                  <span>{new Date(post.createdAt).toLocaleDateString()} at {new Date(post.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                
                <h1 className="font-extrabold text-2xl sm:text-3xl text-foreground mb-4 tracking-tight leading-tight">
                  {post.title}
                </h1>
                
                <div className="prose prose-slate dark:prose-invert max-w-none mb-6">
                  <p className="whitespace-pre-wrap leading-relaxed text-base sm:text-lg text-foreground/90">{post.content}</p>
                </div>
                
                {post.imageUrl && (
                  <div className="rounded-xl overflow-hidden mb-6 border bg-muted/10">
                    <img src={post.imageUrl} alt="Post attachment" className="w-full max-h-[500px] object-contain" />
                  </div>
                )}
                
                <div className="flex items-center gap-4 pt-4 border-t text-sm font-medium text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    {post.commentCount} Comments
                  </div>
                  <Button variant="ghost" size="sm" className="h-8 text-muted-foreground hover:text-foreground">
                    <Share2 className="w-4 h-4 mr-2" /> Share
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Comments Section */}
        <div className="space-y-6">
          <h3 className="font-bold text-lg flex items-center gap-2">
            Discussions
            <Badge variant="secondary" className="font-normal">{post.commentCount}</Badge>
          </h3>
          
          <Card className="border-border/50 shadow-sm">
            <CardContent className="p-4 sm:p-6">
              <div className="space-y-4">
                <Textarea 
                  placeholder="Share your thoughts or clinical perspective..." 
                  value={commentContent}
                  onChange={(e) => setCommentContent(e.target.value)}
                  className="min-h-[100px] resize-y bg-background"
                />
                <div className="flex justify-end">
                  <Button 
                    onClick={handleComment} 
                    disabled={!commentContent.trim() || createComment.isPending}
                  >
                    {createComment.isPending ? "Posting..." : "Post Comment"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4 pt-4">
            {commentsLoading ? (
              [1, 2].map(i => <Skeleton key={i} className="h-32 w-full rounded-xl" />)
            ) : comments?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No comments yet. Start the conversation!
              </div>
            ) : (
              comments?.map(comment => (
                <div key={comment.id} className="flex gap-4 p-4 sm:p-6 bg-card rounded-xl border border-border/50 shadow-sm">
                  <UserAvatar name={comment.authorName} url={comment.authorAvatar} className="w-8 h-8 shrink-0 mt-1" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 text-xs mb-2">
                      <span className="font-semibold text-foreground text-sm">{comment.authorName}</span>
                      <Badge variant="secondary" className="text-[9px] h-4 px-1.5 font-medium">Lvl {comment.authorLevel}</Badge>
                      <span className="text-muted-foreground/50">•</span>
                      <span className="text-muted-foreground">{formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}</span>
                    </div>
                    <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
                      {comment.content}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      
      {/* Passing community id for context if needed */}
      <YuktiChat communityId={communityId} />
    </Layout>
  );
}
