import { useListCommunities } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { MessageSquare, Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function Communities() {
  const { data: communities, isLoading } = useListCommunities();

  return (
    <Layout>
      <div className="max-w-5xl mx-auto p-6 md:p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2 tracking-tight">Communities</h1>
          <p className="text-muted-foreground">Discover and join clinical discussions.</p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <Card key={i} className="overflow-hidden">
                <div className="h-2 bg-muted/50 w-full" />
                <CardHeader>
                  <Skeleton className="h-6 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-full" />
                </CardHeader>
                <CardContent>
                  <div className="flex gap-4">
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {communities?.map((community) => (
              <Link key={community.id} href={`/communities/${community.id}`}>
                <Card className="hover:shadow-md transition-all cursor-pointer h-full border-border/50 hover:border-primary/30 group">
                  <div 
                    className="h-2 w-full transition-colors group-hover:bg-primary"
                    style={{ backgroundColor: community.coverColor || "hsl(var(--primary))" }}
                  />
                  <CardHeader>
                    <div className="flex items-center gap-3 mb-2">
                      {community.iconEmoji && (
                        <span className="text-2xl">{community.iconEmoji}</span>
                      )}
                      <CardTitle className="text-lg">{community.name}</CardTitle>
                    </div>
                    <CardDescription className="line-clamp-2 text-sm">{community.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground mt-auto">
                      <div className="flex items-center gap-1.5">
                        <Users className="w-4 h-4" />
                        <span>{community.memberCount} members</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <MessageSquare className="w-4 h-4" />
                        <span>{community.postCount} posts</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
            {communities?.length === 0 && (
              <div className="col-span-full py-12 text-center text-muted-foreground bg-muted/20 rounded-xl border border-dashed">
                No communities available yet.
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
