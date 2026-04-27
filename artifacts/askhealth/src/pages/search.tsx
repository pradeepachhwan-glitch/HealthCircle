import { useState } from "react";
import { useGlobalSearch } from "@workspace/api-client-react";
import { Layout, UserAvatar } from "@/components/Layout";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search as SearchIcon, Users, FileText } from "lucide-react";
import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

export default function Search() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  // Simple debounce
  useState(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);
    return () => clearTimeout(handler);
  });

  const { data: results, isLoading } = useGlobalSearch(
    { q: debouncedQuery },
    { query: { enabled: debouncedQuery.length > 2 } }
  );

  return (
    <Layout>
      <div className="max-w-4xl mx-auto p-6 md:p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-4 tracking-tight">Global Search</h1>
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
            <Input 
              placeholder="Search posts and members..." 
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-10 py-6 text-lg bg-card shadow-sm"
              autoFocus
            />
          </div>
        </div>

        {debouncedQuery.length <= 2 ? (
          <div className="text-center py-12 text-muted-foreground">
            <SearchIcon className="w-12 h-12 mx-auto mb-4 text-muted-foreground/30" />
            <p>Type at least 3 characters to search.</p>
          </div>
        ) : isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-10 w-48 mb-6" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : !results || (results.posts.length === 0 && results.members.length === 0) ? (
          <div className="text-center py-12 text-muted-foreground bg-muted/20 rounded-xl border border-dashed">
            <p>No results found for "{debouncedQuery}"</p>
          </div>
        ) : (
          <Tabs defaultValue="all" className="w-full">
            <TabsList className="mb-6 bg-muted/50 p-1">
              <TabsTrigger value="all" className="data-[state=active]:bg-background">
                All Results ({results.totalCount})
              </TabsTrigger>
              <TabsTrigger value="posts" className="data-[state=active]:bg-background">
                Posts ({results.posts.length})
              </TabsTrigger>
              <TabsTrigger value="members" className="data-[state=active]:bg-background">
                Members ({results.members.length})
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="all" className="space-y-8">
              {results.members.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Users className="w-5 h-5 text-primary" /> Members
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {results.members.slice(0, 4).map(member => (
                      <Card key={member.id} className="overflow-hidden hover:border-primary/30 transition-colors">
                        <CardContent className="p-4 flex items-center gap-4">
                          <UserAvatar name={member.displayName} url={member.avatarUrl} className="w-12 h-12" />
                          <div>
                            <div className="font-semibold">{member.displayName}</div>
                            <div className="text-sm text-muted-foreground flex items-center gap-2">
                              Level {member.level} • {member.healthCredits} HC
                            </div>
                          </div>
                          <Badge variant="outline" className="ml-auto">{member.role}</Badge>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
              
              {results.posts.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-primary" /> Posts
                  </h3>
                  <div className="space-y-4">
                    {results.posts.map(post => (
                      <Link key={post.id} href={`/communities/${post.communityId}/post/${post.id}`}>
                        <Card className="hover:shadow-md hover:border-primary/30 transition-all cursor-pointer">
                          <CardContent className="p-5">
                            <h4 className="font-bold text-lg mb-2 text-foreground">{post.title}</h4>
                            <p className="text-muted-foreground line-clamp-2 text-sm mb-3">
                              {post.content}
                            </p>
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <div className="flex items-center gap-2">
                                <UserAvatar name={post.authorName} url={post.authorAvatar} className="w-5 h-5" />
                                <span>{post.authorName}</span>
                              </div>
                              <div className="flex items-center gap-3">
                                <span>{post.upvoteCount} upvotes</span>
                                <span>{post.commentCount} comments</span>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="posts" className="space-y-4">
              {results.posts.map(post => (
                <Link key={post.id} href={`/communities/${post.communityId}/post/${post.id}`}>
                  <Card className="hover:shadow-md hover:border-primary/30 transition-all cursor-pointer">
                    <CardContent className="p-5">
                      <h4 className="font-bold text-lg mb-2 text-foreground">{post.title}</h4>
                      <p className="text-muted-foreground line-clamp-2 text-sm mb-3">
                        {post.content}
                      </p>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <UserAvatar name={post.authorName} url={post.authorAvatar} className="w-5 h-5" />
                          <span>{post.authorName}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span>{post.upvoteCount} upvotes</span>
                          <span>{post.commentCount} comments</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </TabsContent>

            <TabsContent value="members" className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {results.members.map(member => (
                <Card key={member.id} className="overflow-hidden hover:border-primary/30 transition-colors">
                  <CardContent className="p-4 flex items-center gap-4">
                    <UserAvatar name={member.displayName} url={member.avatarUrl} className="w-12 h-12" />
                    <div>
                      <div className="font-semibold">{member.displayName}</div>
                      <div className="text-sm text-muted-foreground flex items-center gap-2">
                        Level {member.level} • {member.healthCredits} HC
                      </div>
                    </div>
                    <Badge variant="outline" className="ml-auto">{member.role}</Badge>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </Layout>
  );
}
