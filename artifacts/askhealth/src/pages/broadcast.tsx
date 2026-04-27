import { useState } from "react";
import { useBroadcastAnnouncement, useListCommunities } from "@workspace/api-client-react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Send } from "lucide-react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";

export default function Broadcast() {
  const [, setLocation] = useLocation();
  const { data: communities, isLoading } = useListCommunities();
  const broadcastMutation = useBroadcastAnnouncement();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [postToAll, setPostToAll] = useState(true);
  const [selectedCommunities, setSelectedCommunities] = useState<number[]>([]);

  const handleToggleCommunity = (id: number) => {
    setSelectedCommunities(prev => 
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const handleSend = () => {
    if (!title.trim() || !content.trim()) {
      toast.error("Please provide both title and content");
      return;
    }
    if (!postToAll && selectedCommunities.length === 0) {
      toast.error("Please select at least one community");
      return;
    }

    broadcastMutation.mutate({
      data: {
        title,
        content,
        postToAll,
        communityIds: postToAll ? [] : selectedCommunities
      }
    }, {
      onSuccess: (result) => {
        toast.success(`Successfully broadcasted to ${result.postsCreated} communities`);
        setLocation("/admin");
      },
      onError: () => {
        toast.error("Failed to send broadcast");
      }
    });
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
            <p className="text-muted-foreground">Post an announcement to communities.</p>
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
              <label className="text-sm font-medium text-foreground">Content</label>
              <Textarea 
                placeholder="Write your announcement here..." 
                value={content}
                onChange={e => setContent(e.target.value)}
                className="min-h-[200px] resize-y"
              />
            </div>

            <div className="space-y-4 pt-4 border-t">
              <h3 className="text-lg font-medium">Target Audience</h3>
              
              <div className="flex items-center space-x-2 p-3 border rounded-lg bg-muted/20">
                <Checkbox 
                  id="postToAll" 
                  checked={postToAll}
                  onCheckedChange={(checked) => setPostToAll(checked as boolean)}
                />
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
                      <label htmlFor={`comm-${community.id}`} className="text-sm cursor-pointer line-clamp-1">
                        {community.iconEmoji} {community.name}
                      </label>
                    </div>
                  ))}
                </div>
              )}
            </div>

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
