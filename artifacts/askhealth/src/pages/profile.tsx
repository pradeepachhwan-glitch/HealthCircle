import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useGetCurrentUser, useGetMyCreditsSummary, useGetUserAchievements } from "@workspace/api-client-react";
import { useAuth } from "@workspace/replit-auth-web";
import { Layout, UserAvatar } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { formatDistanceToNow } from "date-fns";
import {
  Award, Star, Activity, Trophy, MessageSquare, Users,
  ArrowUp, Eye, FileText, ChevronRight,
} from "lucide-react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

type Tab = "overview" | "posts" | "communities";

interface MyPost {
  id: number;
  title: string;
  content: string;
  communityId: number;
  communityName: string;
  communityIcon?: string;
  upvoteCount: number;
  commentCount: number;
  viewCount: number;
  createdAt: string;
}

interface MyCommunity {
  id: number;
  name: string;
  slug: string;
  iconEmoji?: string;
  coverColor?: string;
  description?: string;
  memberCount: number;
  postCount: number;
}

export default function Profile() {
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  const { isLoaded: clerkLoaded, isSignedIn } = useAuth();
  const authReady = clerkLoaded && isSignedIn;
  const { data: user, isLoading: userLoading } = useGetCurrentUser({ query: { enabled: authReady } });
  const { data: credits, isLoading: creditsLoading } = useGetMyCreditsSummary({ query: { enabled: !!user } });
  const { data: achievements, isLoading: achievementsLoading } = useGetUserAchievements(user?.id || "", { query: { enabled: !!user?.id } });

  const { data: myPosts = [], isLoading: postsLoading, isError: postsError, refetch: refetchPosts } = useQuery<MyPost[]>({
    queryKey: ["me-posts"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/users/me/posts`, { credentials: "include" });
      if (!res.ok) throw new Error(`Failed to load posts (${res.status})`);
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: !!user && activeTab === "posts",
    retry: 1,
  });

  const { data: myCommunities = [], isLoading: communitiesLoading, isError: communitiesError, refetch: refetchCommunities } = useQuery<MyCommunity[]>({
    queryKey: ["me-communities"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/users/me/communities`, { credentials: "include" });
      if (!res.ok) throw new Error(`Failed to load communities (${res.status})`);
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: !!user && activeTab === "communities",
    retry: 1,
  });

  const isLoading = userLoading || creditsLoading || achievementsLoading;

  const TABS: { key: Tab; label: string; icon: typeof FileText }[] = [
    { key: "overview", label: "Overview", icon: Star },
    { key: "posts", label: "My Posts", icon: FileText },
    { key: "communities", label: "My Communities", icon: Users },
  ];

  return (
    <Layout>
      <div className="max-w-4xl mx-auto p-6 md:p-8">
        {isLoading ? (
          <div className="space-y-8">
            <Skeleton className="h-48 w-full rounded-xl" />
            <div className="grid md:grid-cols-3 gap-6">
              <Skeleton className="h-32 md:col-span-2" />
              <Skeleton className="h-32" />
            </div>
          </div>
        ) : user ? (
          <div className="space-y-6">
            {/* Profile Header Card */}
            <Card className="border-border overflow-hidden">
              <div className="h-28 bg-gradient-to-r from-primary/20 to-primary/5" />
              <div className="px-6 pb-6 relative">
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end -mt-10 mb-4">
                  <UserAvatar
                    name={user.displayName}
                    url={user.avatarUrl}
                    className="w-20 h-20 text-2xl border-4 border-card bg-card shadow-sm"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h1 className="text-2xl font-bold text-foreground">{user.displayName}</h1>
                      <Badge variant={user.role === "admin" ? "default" : "secondary"} className="text-xs">
                        {user.role === "admin" ? "Admin" : user.role === "moderator" ? "Moderator" : "Member"}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground text-sm">{user.email}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Joined {new Date(user.createdAt).toLocaleDateString("en-IN", { year: "numeric", month: "long" })}
                    </p>
                  </div>
                  {/* HC + Level pill */}
                  <div className="flex items-center gap-3 bg-primary/5 border border-primary/20 px-4 py-2.5 rounded-xl">
                    <div className="text-center">
                      <div className="text-xl font-extrabold text-primary">{credits?.healthCredits ?? 0}</div>
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Health Credits</div>
                    </div>
                    <div className="w-px h-8 bg-primary/20" />
                    <div className="text-center">
                      <div className="text-xl font-extrabold text-foreground">Lvl {credits?.level ?? 1}</div>
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{credits?.levelName}</div>
                    </div>
                  </div>
                </div>

                {/* Level progress bar */}
                {credits && credits.level < 10 && (
                  <div className="space-y-1.5 mt-2">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{credits.levelName}</span>
                      <span>{credits.creditsToNextLevel} HC to next level</span>
                    </div>
                    <Progress value={credits.progressPercent} className="h-2" />
                  </div>
                )}
              </div>
            </Card>

            {/* Tabs */}
            <div className="flex gap-1 border-b border-border">
              {TABS.map(tab => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                      activeTab === tab.key
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* OVERVIEW TAB */}
            {activeTab === "overview" && (
              <div className="grid md:grid-cols-3 gap-6">
                <div className="md:col-span-2 space-y-6">
                  {/* Weekly Activity */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Activity className="w-4 h-4 text-primary" />
                        This Week
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <Star className="w-6 h-6 text-primary fill-primary" />
                        </div>
                        <div>
                          <div className="text-3xl font-extrabold text-foreground">{credits?.weeklyCredits ?? 0}</div>
                          <div className="text-sm text-muted-foreground">HC earned this week</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Achievements */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Trophy className="w-4 h-4 text-primary" />
                        Achievements
                      </CardTitle>
                      <CardDescription>Earned by participating in health communities</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {achievementsLoading ? (
                        <div className="space-y-3">
                          {[1, 2].map(i => <Skeleton key={i} className="h-14 w-full" />)}
                        </div>
                      ) : achievements && achievements.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {achievements.map((a) => (
                            <div key={a.id} className="flex items-start gap-3 p-3 rounded-lg border border-border/50 bg-muted/10 hover:bg-muted/20 transition-colors">
                              <div className="text-2xl mt-0.5 shrink-0">{a.badgeIcon ?? "🎖️"}</div>
                              <div>
                                <h4 className="font-semibold text-sm text-foreground">{a.badgeName}</h4>
                                <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{a.badgeDescription}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          <Award className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
                          <p className="text-sm font-medium">No achievements yet</p>
                          <p className="text-xs mt-1">Post questions and reply to earn your first badge.</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Right sidebar stats */}
                <div className="space-y-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Earning Guide</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {[
                        { label: "Start a discussion", hc: "+10 HC", icon: FileText },
                        { label: "Reply to someone", hc: "+5 HC", icon: MessageSquare },
                        { label: "Receive an upvote", hc: "+2 HC", icon: ArrowUp },
                      ].map(({ label, hc, icon: Icon }) => (
                        <div key={label} className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-2 text-muted-foreground">
                            <Icon className="w-3.5 h-3.5" /> {label}
                          </span>
                          <span className="text-primary font-semibold">{hc}</span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Quick Actions</div>
                      <div className="space-y-2">
                        <button onClick={() => setActiveTab("posts")} className="w-full text-left text-sm flex items-center justify-between text-foreground/80 hover:text-primary transition-colors">
                          <span className="flex items-center gap-2"><FileText className="w-3.5 h-3.5" /> View my posts</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setActiveTab("communities")} className="w-full text-left text-sm flex items-center justify-between text-foreground/80 hover:text-primary transition-colors">
                          <span className="flex items-center gap-2"><Users className="w-3.5 h-3.5" /> My communities</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                        <Link href="/communities" className="w-full text-sm flex items-center justify-between text-foreground/80 hover:text-primary transition-colors block">
                          <span className="flex items-center gap-2"><MessageSquare className="w-3.5 h-3.5" /> Ask a question</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}

            {/* MY POSTS TAB */}
            {activeTab === "posts" && (
              <div className="space-y-3">
                {postsLoading ? (
                  [1, 2, 3].map(i => <Skeleton key={i} className="h-28 w-full rounded-xl" />)
                ) : postsError ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <FileText className="w-10 h-10 mx-auto mb-3 text-red-300" />
                    <p className="font-medium text-red-600">Couldn't load your posts</p>
                    <p className="text-sm mt-1">Check your connection and try again.</p>
                    <button onClick={() => refetchPosts()} className="mt-4 px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50">
                      Retry
                    </button>
                  </div>
                ) : myPosts.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground">
                    <FileText className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
                    <p className="font-medium">No posts yet</p>
                    <p className="text-sm mt-1">Join a community and ask your first health question.</p>
                    <Link href="/communities">
                      <button className="mt-4 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90">
                        Browse Communities
                      </button>
                    </Link>
                  </div>
                ) : (
                  myPosts.map(post => (
                    <Link key={post.id} href={`/communities/${post.communityId}/post/${post.id}`}>
                      <Card className="hover:border-primary/40 transition-all cursor-pointer shadow-sm hover:shadow-md group">
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <div className="text-xl shrink-0 mt-0.5">{post.communityIcon ?? "🏥"}</div>
                            <div className="flex-1 min-w-0">
                              <div className="text-[11px] text-muted-foreground mb-1">{post.communityName}</div>
                              <h3 className="font-semibold text-base text-foreground leading-snug group-hover:text-primary transition-colors mb-1.5">
                                {post.title}
                              </h3>
                              <p className="text-xs text-muted-foreground line-clamp-1 mb-2">{post.content}</p>
                              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1"><ArrowUp className="w-3 h-3" /> {post.upvoteCount}</span>
                                <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" /> {post.commentCount}</span>
                                <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> {post.viewCount ?? 0}</span>
                                <span className="ml-auto">{formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}</span>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))
                )}
              </div>
            )}

            {/* MY COMMUNITIES TAB */}
            {activeTab === "communities" && (
              <div className="space-y-3">
                {communitiesLoading ? (
                  [1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full rounded-xl" />)
                ) : communitiesError ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Users className="w-10 h-10 mx-auto mb-3 text-red-300" />
                    <p className="font-medium text-red-600">Couldn't load your communities</p>
                    <p className="text-sm mt-1">Check your connection and try again.</p>
                    <button onClick={() => refetchCommunities()} className="mt-4 px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50">
                      Retry
                    </button>
                  </div>
                ) : myCommunities.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground">
                    <Users className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
                    <p className="font-medium">No communities joined yet</p>
                    <p className="text-sm mt-1">Find communities that match your health journey.</p>
                    <Link href="/communities">
                      <button className="mt-4 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90">
                        Explore Communities
                      </button>
                    </Link>
                  </div>
                ) : (
                  <div className="grid sm:grid-cols-2 gap-3">
                    {myCommunities.map(c => (
                      <Link key={c.id} href={`/communities/${c.id}`}>
                        <Card className="hover:border-primary/40 transition-all cursor-pointer hover:shadow-md group overflow-hidden">
                          <div className="h-1 w-full" style={{ backgroundColor: c.coverColor ?? "hsl(var(--primary))" }} />
                          <CardContent className="p-4">
                            <div className="flex items-start gap-3">
                              <span className="text-2xl shrink-0">{c.iconEmoji ?? "🏥"}</span>
                              <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors">{c.name}</h3>
                                <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5 mb-2">{c.description}</p>
                                <div className="flex gap-3 text-xs text-muted-foreground">
                                  <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {c.memberCount}</span>
                                  <span className="flex items-center gap-1"><FileText className="w-3 h-3" /> {c.postCount}</span>
                                </div>
                              </div>
                              <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0 mt-1" />
                            </div>
                          </CardContent>
                        </Card>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : null}
      </div>
    </Layout>
  );
}
