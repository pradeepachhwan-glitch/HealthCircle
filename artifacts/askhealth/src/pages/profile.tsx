import { useGetCurrentUser, useGetMyCreditsSummary, useGetUserAchievements } from "@workspace/api-client-react";
import { Layout, UserAvatar } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Award, Star, Activity, Trophy } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function Profile() {
  const { data: user, isLoading: userLoading } = useGetCurrentUser();
  const { data: credits, isLoading: creditsLoading } = useGetMyCreditsSummary({ query: { enabled: !!user } });
  const { data: achievements, isLoading: achievementsLoading } = useGetUserAchievements(user?.id || "", { query: { enabled: !!user?.id } });

  const isLoading = userLoading || creditsLoading || achievementsLoading;

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
          <div className="space-y-8">
            {/* Header Profile Card */}
            <Card className="border-border overflow-hidden">
              <div className="h-32 bg-gradient-to-r from-primary/20 to-sidebar-accent" />
              <div className="px-6 pb-6 relative">
                <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-end -mt-12 mb-4">
                  <UserAvatar 
                    name={user.displayName} 
                    url={user.avatarUrl} 
                    className="w-24 h-24 text-3xl border-4 border-card bg-card shadow-sm"
                  />
                  <div className="flex-1">
                    <h1 className="text-3xl font-bold text-foreground">{user.displayName}</h1>
                    <p className="text-muted-foreground">{user.role === 'admin' ? 'Administrator' : user.role === 'moderator' ? 'Moderator' : 'Clinical Member'}</p>
                  </div>
                </div>
              </div>
            </Card>

            <div className="grid md:grid-cols-3 gap-6">
              {/* Level & Credits Progress */}
              <div className="md:col-span-2 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Star className="w-5 h-5 text-yellow-500" fill="currentColor" />
                      Level {credits?.level}: {credits?.levelName}
                    </CardTitle>
                    <CardDescription>Earn Health Credits (HC) by contributing to discussions</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium text-foreground">{credits?.healthCredits} HC Total</span>
                        <span className="text-muted-foreground">{credits?.creditsToNextLevel} to next level</span>
                      </div>
                      <Progress value={credits?.progressPercent} className="h-3" />
                    </div>
                  </CardContent>
                </Card>

                {/* Achievements */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Trophy className="w-5 h-5 text-primary" />
                      Achievements
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {achievements && achievements.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {achievements.map((achievement) => (
                          <div key={achievement.id} className="flex items-start gap-3 p-3 rounded-lg border border-border/50 bg-muted/10">
                            <div className="text-2xl mt-1">{achievement.badgeIcon || "🎖️"}</div>
                            <div>
                              <h4 className="font-medium text-sm text-foreground">{achievement.badgeName}</h4>
                              <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{achievement.badgeDescription}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <Award className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
                        <p>No achievements yet.</p>
                        <p className="text-sm mt-1">Participate in communities to earn badges.</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Sidebar Stats */}
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Weekly Activity</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <Activity className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <div className="text-2xl font-bold">{credits?.weeklyCredits || 0}</div>
                        <div className="text-sm text-muted-foreground">HC earned this week</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Profile Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Email</div>
                      <div className="text-sm">{user.email}</div>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Role</div>
                      <Badge variant={user.role === 'admin' ? "default" : "secondary"}>
                        {user.role}
                      </Badge>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Joined</div>
                      <div className="text-sm">{new Date(user.createdAt).toLocaleDateString()}</div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </Layout>
  );
}
