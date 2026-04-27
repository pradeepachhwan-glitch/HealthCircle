import { useState, useEffect } from "react";
import { useGetAdminStats, useListUsers, getListUsersQueryKey, useBanUser } from "@workspace/api-client-react";
import { Layout, UserAvatar } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, FileText, MessageSquare, Activity, Shield, ShieldAlert, ShieldCheck, Bot, Coins, Building2, Pin, Trash2, CheckCircle2, XCircle, Pencil, Star, Radio, TrendingUp, Award, Stethoscope } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

const ADMIN_TOKEN_KEY = "healthcircle:adminToken";

function getAdminToken(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(ADMIN_TOKEN_KEY) ?? "";
}

function adminHeaders(extra?: Record<string, string>): Record<string, string> {
  const t = getAdminToken();
  return { ...(extra ?? {}), ...(t ? { "x-admin-token": t } : {}) };
}

function adminFetch(input: string, init: RequestInit = {}) {
  const headers = adminHeaders(init.headers as Record<string, string> | undefined);
  return fetch(input, { credentials: "include", ...init, headers });
}

function roleBadge(role: string) {
  const map: Record<string, string> = {
    admin: "bg-red-100 text-red-700 border-red-200",
    moderator: "bg-blue-100 text-blue-700 border-blue-200",
    medical_professional: "bg-emerald-100 text-emerald-700 border-emerald-200",
    member: "bg-slate-100 text-slate-600 border-slate-200",
  };
  const labels: Record<string, string> = {
    admin: "Admin", moderator: "Moderator", medical_professional: "Med Pro", member: "Member",
  };
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${map[role] ?? map.member}`}>
      {labels[role] ?? role}
    </span>
  );
}

function riskBadge(risk: string) {
  const map: Record<string, string> = {
    low: "bg-green-100 text-green-700", medium: "bg-yellow-100 text-yellow-700",
    high: "bg-orange-100 text-orange-700", emergency: "bg-red-100 text-red-700",
  };
  return <span className={`text-xs font-bold px-2 py-0.5 rounded-full uppercase ${map[risk] ?? "bg-slate-100"}`}>{risk}</span>;
}

function StatCard({ icon: Icon, color, value, label, sub }: { icon: any; color: string; value: string | number; label: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center mb-3`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="text-2xl font-black mb-0.5">{value}</div>
        <div className="text-sm text-muted-foreground">{label}</div>
        {sub && <div className="text-xs text-green-600 font-medium mt-1">{sub}</div>}
      </CardContent>
    </Card>
  );
}

export default function Admin() {
  const { data: stats, isLoading: statsLoading } = useGetAdminStats();
  const { data: users, isLoading: usersLoading } = useListUsers();
  const queryClient = useQueryClient();
  const banUser = useBanUser();

  const [userSearch, setUserSearch] = useState("");
  const [awardDialog, setAwardDialog] = useState<{ userId: string; name: string } | null>(null);
  const [awardAmount, setAwardAmount] = useState("");
  const [awardReason, setAwardReason] = useState("");

  const [communityMembersDialog, setCommunityMembersDialog] = useState<{ id: number; name: string } | null>(null);
  const [aiFilter, setAiFilter] = useState<"pending" | "approved" | "rejected" | "edited">("pending");

  // Admin token (server secret) — pasted by the operator to unlock the dashboard
  // when their Clerk user is not yet promoted to admin role in the DB.
  const [adminToken, setAdminToken] = useState<string>(() => getAdminToken());
  const [tokenDialogOpen, setTokenDialogOpen] = useState(false);
  const [tokenInput, setTokenInput] = useState("");
  function saveAdminToken(value: string) {
    const trimmed = value.trim();
    if (trimmed) window.localStorage.setItem(ADMIN_TOKEN_KEY, trimmed);
    else window.localStorage.removeItem(ADMIN_TOKEN_KEY);
    setAdminToken(trimmed);
    setTokenDialogOpen(false);
    setTokenInput("");
    queryClient.invalidateQueries();
    toast.success(trimmed ? "Admin token saved — re-loading data" : "Admin token cleared");
  }

  const { data: communities, isLoading: commLoading } = useQuery({
    queryKey: ["admin-communities"],
    queryFn: () => adminFetch(`${API_BASE}/admin/communities`).then(r => r.json()),
  });

  const { data: allPosts, isLoading: postsLoading, refetch: refetchPosts } = useQuery({
    queryKey: ["admin-posts"],
    queryFn: () => adminFetch(`${API_BASE}/admin/posts`).then(r => r.json()),
  });

  const { data: aiSummaries, isLoading: aiLoading, refetch: refetchAI } = useQuery({
    queryKey: ["admin-ai-summaries", aiFilter],
    queryFn: () => adminFetch(`${API_BASE}/admin/ai-summaries?status=${aiFilter}`).then(r => r.json()),
  });

  const { data: communityMembers, isLoading: membersLoading, refetch: refetchMembers } = useQuery({
    queryKey: ["admin-community-members", communityMembersDialog?.id],
    queryFn: () =>
      communityMembersDialog
        ? adminFetch(`${API_BASE}/admin/communities/${communityMembersDialog.id}/members`).then(r => r.json())
        : Promise.resolve([]),
    enabled: !!communityMembersDialog,
  });

  const updateRole = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      adminFetch(`${API_BASE}/users/${userId}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      }).then(r => r.json()),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() }); toast.success("Role updated"); },
    onError: () => toast.error("Failed to update role"),
  });

  const verifyPro = useMutation({
    mutationFn: ({ userId, isVerifiedPro }: { userId: string; isVerifiedPro: boolean }) =>
      adminFetch(`${API_BASE}/admin/users/${userId}/verify-pro`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isVerifiedPro }),
      }).then(r => r.json()),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() }); toast.success("Verification updated"); },
  });

  const awardCredits = useMutation({
    mutationFn: ({ userId, amount, reason }: { userId: string; amount: number; reason: string }) =>
      adminFetch(`${API_BASE}/admin/credits/award`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, amount, reason }),
      }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
      setAwardDialog(null); setAwardAmount(""); setAwardReason("");
      toast.success("Credits awarded!");
    },
    onError: () => toast.error("Failed to award credits"),
  });

  const removeMember = useMutation({
    mutationFn: ({ communityId, userId }: { communityId: number; userId: string }) =>
      adminFetch(`${API_BASE}/admin/communities/${communityId}/members/${userId}`, {
        method: "DELETE",
      }).then(r => r.json()),
    onSuccess: () => { refetchMembers(); toast.success("Member removed"); },
  });

  const moderatePost = useMutation({
    mutationFn: ({ postId, action }: { postId: number; action: Record<string, boolean> }) =>
      adminFetch(`${API_BASE}/admin/posts/${postId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action),
      }).then(r => r.json()),
    onSuccess: () => { refetchPosts(); toast.success("Post updated"); },
  });

  const deletePost = useMutation({
    mutationFn: (postId: number) =>
      adminFetch(`${API_BASE}/admin/posts/${postId}`, { method: "DELETE" }).then(r => r.json()),
    onSuccess: () => { refetchPosts(); toast.success("Post deleted"); },
  });

  const archiveCommunity = useMutation({
    mutationFn: ({ id, isArchived }: { id: number; isArchived: boolean }) =>
      adminFetch(`${API_BASE}/admin/communities/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isArchived }),
      }).then(r => r.json()),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-communities"] }); toast.success("Community updated"); },
  });

  const filteredUsers = (users ?? []).filter((u: any) =>
    !userSearch || u.displayName.toLowerCase().includes(userSearch.toLowerCase()) || u.email.toLowerCase().includes(userSearch.toLowerCase())
  );

  return (
    <Layout>
      <div className="max-w-7xl mx-auto p-4 md:p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-lg bg-red-500 text-white flex items-center justify-center">
                <Shield className="w-4 h-4" />
              </div>
              <h1 className="text-2xl font-black text-foreground">Admin GODMODE</h1>
            </div>
            <p className="text-muted-foreground text-sm">Full platform visibility and control</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 shrink-0"
              onClick={() => { setTokenInput(""); setTokenDialogOpen(true); }}
              title={adminToken ? "Admin token is set — click to update or clear" : "Enter admin token to unlock"}
            >
              <Shield className="w-3.5 h-3.5" />
              {adminToken ? "Token ✓" : "Enter Admin Token"}
            </Button>
            <Link href="/admin/broadcast">
              <Button className="shrink-0 gap-2 bg-red-500 hover:bg-red-600 text-white">
                <Radio className="w-4 h-4" /> Broadcast
              </Button>
            </Link>
          </div>
        </div>

        <Dialog open={tokenDialogOpen} onOpenChange={setTokenDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Admin Token</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Paste the server-side admin token to unlock the dashboard. The token is stored only in your
              browser (localStorage) and sent with every admin API call as <code>x-admin-token</code>.
            </p>
            <Input
              type="password"
              autoFocus
              placeholder="Paste admin token…"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") saveAdminToken(tokenInput); }}
            />
            <div className="flex justify-between gap-2 pt-2">
              <Button variant="ghost" onClick={() => saveAdminToken("")}>Clear token</Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setTokenDialogOpen(false)}>Cancel</Button>
                <Button onClick={() => saveAdminToken(tokenInput)}>Save</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="flex flex-wrap h-auto gap-1 p-1">
            <TabsTrigger value="overview" className="gap-1.5 text-xs"><TrendingUp className="w-3.5 h-3.5" />Overview</TabsTrigger>
            <TabsTrigger value="users" className="gap-1.5 text-xs"><Users className="w-3.5 h-3.5" />Users</TabsTrigger>
            <TabsTrigger value="communities" className="gap-1.5 text-xs"><Building2 className="w-3.5 h-3.5" />Communities</TabsTrigger>
            <TabsTrigger value="posts" className="gap-1.5 text-xs"><FileText className="w-3.5 h-3.5" />Posts</TabsTrigger>
            <TabsTrigger value="ai" className="gap-1.5 text-xs"><Bot className="w-3.5 h-3.5" />AI Queue</TabsTrigger>
            <TabsTrigger value="payments" className="gap-1.5 text-xs"><Coins className="w-3.5 h-3.5" />Credits</TabsTrigger>
          </TabsList>

          {/* ── OVERVIEW ── */}
          <TabsContent value="overview" className="space-y-6">
            {statsLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                {[...Array(10)].map((_, i) => <Skeleton key={i} className="h-28" />)}
              </div>
            ) : stats ? (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                  <StatCard icon={Users} color="bg-blue-100 text-blue-600" value={stats.totalUsers} label="Total Users" sub={`+${stats.newUsersThisWeek} this week`} />
                  <StatCard icon={Activity} color="bg-violet-100 text-violet-600" value={stats.weeklyActiveUsers} label="Weekly Active" />
                  <StatCard icon={Stethoscope} color="bg-emerald-100 text-emerald-600" value={(stats as any).medProCount ?? 0} label="Med Professionals" />
                  <StatCard icon={ShieldAlert} color="bg-red-100 text-red-600" value={(stats as any).bannedUsers ?? 0} label="Banned Users" />
                  <StatCard icon={Building2} color="bg-cyan-100 text-cyan-600" value={stats.totalCommunities} label="Communities" />
                  <StatCard icon={FileText} color="bg-orange-100 text-orange-600" value={stats.totalPosts} label="Total Posts" sub={`${(stats as any).todayPosts ?? 0} today`} />
                  <StatCard icon={MessageSquare} color="bg-pink-100 text-pink-600" value={stats.totalComments} label="Total Comments" />
                  <StatCard icon={Bot} color="bg-amber-100 text-amber-600" value={(stats as any).pendingAISummaries ?? 0} label="AI Pending Review" />
                  <StatCard icon={CheckCircle2} color="bg-green-100 text-green-600" value={(stats as any).approvedAISummaries ?? 0} label="AI Approved" />
                  <StatCard icon={Coins} color="bg-yellow-100 text-yellow-600" value={`${((stats as any).totalHealthCreditsAwarded ?? 0).toLocaleString()} HC`} label="Total HC Awarded" />
                </div>

                {/* Role breakdown */}
                <Card>
                  <CardHeader><CardTitle className="text-base">Role Breakdown</CardTitle></CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {((stats as any).roleBreakdown ?? []).map((r: any) => (
                        <div key={r.role} className="text-center p-4 rounded-xl bg-muted/50 border">
                          <div className="text-2xl font-black">{r.count}</div>
                          <div className="mt-1">{roleBadge(r.role)}</div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Top Communities */}
                <Card>
                  <CardHeader><CardTitle className="text-base">Top Communities by Activity</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {stats.topCommunities?.map((c: any, i: number) => (
                        <div key={c.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center text-white font-bold text-sm">{c.iconEmoji || i + 1}</div>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-sm truncate">{c.name}</div>
                          </div>
                          <div className="flex gap-3 text-xs text-muted-foreground">
                            <span><span className="font-bold text-foreground">{c.memberCount}</span> members</span>
                            <span><span className="font-bold text-foreground">{c.postCount}</span> posts</span>
                          </div>
                          {c.isArchived && <Badge variant="secondary" className="text-xs">Archived</Badge>}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : null}
          </TabsContent>

          {/* ── USERS ── */}
          <TabsContent value="users" className="space-y-4">
            <div className="flex items-center gap-3">
              <Input placeholder="Search by name or email…" value={userSearch} onChange={e => setUserSearch(e.target.value)} className="max-w-sm" />
              <span className="text-sm text-muted-foreground">{filteredUsers.length} users</span>
            </div>
            <Card>
              <CardContent className="p-0">
                {usersLoading ? (
                  <div className="p-6 space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>User</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Level / HC</TableHead>
                          <TableHead>Joined</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredUsers.map((user: any) => (
                          <TableRow key={user.id} className={user.isBanned ? "opacity-60" : ""}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <UserAvatar name={user.displayName} url={user.avatarUrl} className="w-8 h-8 text-xs" />
                                <div>
                                  <div className="font-medium text-sm flex items-center gap-2">
                                    {user.displayName}
                                    {user.isBanned && <Badge variant="destructive" className="h-4 text-[10px]">BANNED</Badge>}
                                    {user.isVerifiedPro && <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />}
                                  </div>
                                  <div className="text-xs text-muted-foreground">{user.email}</div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>{roleBadge(user.role)}</TableCell>
                            <TableCell>
                              <div className="text-sm font-medium">Lv {user.level}</div>
                              <div className="text-xs text-muted-foreground">{user.healthCredits} HC</div>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {new Date(user.createdAt).toLocaleDateString("en-IN")}
                            </TableCell>
                            <TableCell className="text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm" className="text-xs">Manage ▾</Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-52">
                                  <DropdownMenuItem onClick={() => updateRole.mutate({ userId: user.clerkId, role: "admin" })}>
                                    <ShieldCheck className="w-4 h-4 mr-2 text-red-500" /> Make Admin
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => updateRole.mutate({ userId: user.clerkId, role: "moderator" })}>
                                    <Shield className="w-4 h-4 mr-2 text-blue-500" /> Make Moderator
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => updateRole.mutate({ userId: user.clerkId, role: "medical_professional" })}>
                                    <Stethoscope className="w-4 h-4 mr-2 text-emerald-500" /> Make Med Professional
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => updateRole.mutate({ userId: user.clerkId, role: "member" })}>
                                    <Users className="w-4 h-4 mr-2" /> Make Member
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => verifyPro.mutate({ userId: user.id, isVerifiedPro: !user.isVerifiedPro })}>
                                    <Star className="w-4 h-4 mr-2 text-amber-500" />
                                    {user.isVerifiedPro ? "Remove Verification" : "Verify Professional"}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => setAwardDialog({ userId: user.id, name: user.displayName })}>
                                    <Coins className="w-4 h-4 mr-2 text-yellow-500" /> Award HC Credits
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className={user.isBanned ? "text-green-600" : "text-destructive"}
                                    onClick={() => banUser.mutate({ userId: user.id, data: { isBanned: !user.isBanned } }, {
                                      onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() }); toast.success(user.isBanned ? "User unbanned" : "User banned"); },
                                    })}
                                  >
                                    <ShieldAlert className="w-4 h-4 mr-2" /> {user.isBanned ? "Unban User" : "Ban User"}
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── COMMUNITIES ── */}
          <TabsContent value="communities" className="space-y-4">
            <Card>
              <CardContent className="p-0">
                {commLoading ? (
                  <div className="p-6 space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Community</TableHead>
                          <TableHead>Members</TableHead>
                          <TableHead>Posts</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(communities ?? []).map((c: any) => (
                          <TableRow key={c.id} className={c.isArchived ? "opacity-50" : ""}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center text-white text-sm">
                                  {c.iconEmoji || "🏥"}
                                </div>
                                <div>
                                  <div className="font-medium text-sm">{c.name}</div>
                                  <div className="text-xs text-muted-foreground">/{c.slug}</div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="font-medium">{c.memberCount}</TableCell>
                            <TableCell className="font-medium">{c.postCount}</TableCell>
                            <TableCell>
                              {c.isArchived ? <Badge variant="secondary">Archived</Badge> : <Badge className="bg-green-100 text-green-700 border-green-200">Active</Badge>}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button variant="outline" size="sm" onClick={() => setCommunityMembersDialog({ id: c.id, name: c.name })}>
                                  View Members
                                </Button>
                                <Button
                                  variant={c.isArchived ? "outline" : "ghost"}
                                  size="sm"
                                  className={c.isArchived ? "" : "text-muted-foreground"}
                                  onClick={() => archiveCommunity.mutate({ id: c.id, isArchived: !c.isArchived })}
                                >
                                  {c.isArchived ? "Restore" : "Archive"}
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── POSTS ── */}
          <TabsContent value="posts" className="space-y-4">
            <Card>
              <CardContent className="p-0">
                {postsLoading ? (
                  <div className="p-6 space-y-3">{[...Array(8)].map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Post</TableHead>
                          <TableHead>Community</TableHead>
                          <TableHead>Author</TableHead>
                          <TableHead>Stats</TableHead>
                          <TableHead>Flags</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(allPosts ?? []).map((p: any) => (
                          <TableRow key={p.id} className={p.isModerated ? "opacity-50" : ""}>
                            <TableCell className="max-w-xs">
                              <div className="font-medium text-sm truncate">{p.title}</div>
                              <div className="text-xs text-muted-foreground truncate">{new Date(p.createdAt).toLocaleDateString("en-IN")}</div>
                            </TableCell>
                            <TableCell className="text-xs">{p.communityName}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <UserAvatar name={p.authorName} url={p.authorAvatar} className="w-6 h-6 text-[10px]" />
                                <span className="text-xs">{p.authorName}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              ↑{p.upvoteCount} · 💬{p.commentCount}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1 flex-wrap">
                                {p.isPinned && <Badge variant="outline" className="text-[10px] h-5">📌 Pinned</Badge>}
                                {p.isBroadcast && <Badge variant="outline" className="text-[10px] h-5">📢 Broadcast</Badge>}
                                {p.isModerated && <Badge variant="destructive" className="text-[10px] h-5">Moderated</Badge>}
                                {p.isExpertAnswered && <Badge className="text-[10px] h-5 bg-emerald-100 text-emerald-700">✓ Expert</Badge>}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm" className="text-xs">Actions ▾</Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => moderatePost.mutate({ postId: p.id, action: { isPinned: !p.isPinned } })}>
                                    <Pin className="w-4 h-4 mr-2" /> {p.isPinned ? "Unpin" : "Pin Post"}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => moderatePost.mutate({ postId: p.id, action: { isModerated: !p.isModerated } })}>
                                    <ShieldAlert className="w-4 h-4 mr-2" /> {p.isModerated ? "Restore" : "Moderate (Hide)"}
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem className="text-destructive" onClick={() => deletePost.mutate(p.id)}>
                                    <Trash2 className="w-4 h-4 mr-2" /> Delete Post
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── AI QUEUE ── */}
          <TabsContent value="ai" className="space-y-4">
            <div className="flex gap-2">
              {(["pending", "approved", "rejected", "edited"] as const).map(s => (
                <Button key={s} variant={aiFilter === s ? "default" : "outline"} size="sm" onClick={() => setAiFilter(s)} className="capitalize text-xs">
                  {s}
                </Button>
              ))}
            </div>
            {aiLoading ? (
              <div className="space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
            ) : (
              <div className="space-y-3">
                {(aiSummaries ?? []).length === 0 && (
                  <Card><CardContent className="p-8 text-center text-muted-foreground">No {aiFilter} AI summaries.</CardContent></Card>
                )}
                {(aiSummaries ?? []).map((s: any) => (
                  <Card key={s.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            {riskBadge(s.riskLevel)}
                            <span className="text-xs text-muted-foreground">{s.communityName}</span>
                            <span className="text-xs text-muted-foreground">·</span>
                            <span className="text-xs text-muted-foreground">{new Date(s.createdAt).toLocaleDateString("en-IN")}</span>
                          </div>
                          <div className="font-semibold text-sm mb-1 truncate">{s.postTitle}</div>
                          <div className="text-xs text-muted-foreground line-clamp-2">{s.whatItCouldBe}</div>
                          {s.validationNote && (
                            <div className="mt-2 text-xs bg-blue-50 border border-blue-200 rounded px-2 py-1 text-blue-700">
                              Note: {s.validationNote}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Badge className={
                            s.status === "approved" ? "bg-green-100 text-green-700" :
                              s.status === "rejected" ? "bg-red-100 text-red-700" :
                                s.status === "edited" ? "bg-blue-100 text-blue-700" :
                                  "bg-yellow-100 text-yellow-700"
                          }>{s.status}</Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── CREDITS/PAYMENTS ── */}
          <TabsContent value="payments" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><Coins className="w-4 h-4 text-yellow-500" /> Award Health Credits</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">Manually award HC credits to any user for special contributions, promotions, or corrections.</p>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-medium mb-1 block">Select User</label>
                      <select
                        className="w-full text-sm border rounded-md px-3 py-2 bg-background"
                        onChange={e => {
                          const user = (users as any[])?.find((u: any) => u.id === e.target.value);
                          if (user) setAwardDialog({ userId: user.id, name: user.displayName });
                        }}
                      >
                        <option value="">-- select user --</option>
                        {(users ?? []).map((u: any) => (
                          <option key={u.id} value={u.id}>{u.displayName} ({u.healthCredits} HC)</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium mb-1 block">Amount (HC)</label>
                      <Input type="number" placeholder="e.g. 100" value={awardAmount} onChange={e => setAwardAmount(e.target.value)} />
                    </div>
                    <div>
                      <label className="text-xs font-medium mb-1 block">Reason</label>
                      <Input placeholder="e.g. Community contribution" value={awardReason} onChange={e => setAwardReason(e.target.value)} />
                    </div>
                    <Button
                      className="w-full bg-yellow-500 hover:bg-yellow-600 text-white"
                      disabled={!awardDialog || !awardAmount || awardCredits.isPending}
                      onClick={() => awardDialog && awardCredits.mutate({ userId: awardDialog.userId, amount: Number(awardAmount), reason: awardReason })}
                    >
                      Award Credits
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><Award className="w-4 h-4 text-violet-500" /> Payment Gateway</CardTitle></CardHeader>
                <CardContent>
                  <div className="text-center py-8">
                    <div className="w-14 h-14 rounded-2xl bg-violet-100 flex items-center justify-center mx-auto mb-4">
                      <Coins className="w-7 h-7 text-violet-600" />
                    </div>
                    <h3 className="font-bold mb-2">Razorpay / Stripe Integration</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Connect a payment gateway to enable HC credit top-ups and premium subscriptions.
                    </p>
                    <div className="space-y-2 text-left bg-muted rounded-xl p-4 text-xs">
                      <div className="font-semibold text-foreground mb-2">To activate payments:</div>
                      <div>1. Add <code className="bg-background px-1 rounded">RAZORPAY_KEY_ID</code> + <code className="bg-background px-1 rounded">RAZORPAY_SECRET</code> to environment secrets</div>
                      <div className="text-muted-foreground">— or —</div>
                      <div>1. Add <code className="bg-background px-1 rounded">STRIPE_SECRET_KEY</code> + <code className="bg-background px-1 rounded">STRIPE_PUBLISHABLE_KEY</code></div>
                      <div>2. Restart the API server</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Top HC holders */}
            <Card>
              <CardHeader><CardTitle className="text-base">Top Health Credits Holders</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {[...(users ?? [])].sort((a: any, b: any) => b.healthCredits - a.healthCredits).slice(0, 10).map((u: any, i: number) => (
                    <div key={u.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i === 0 ? "bg-yellow-400 text-white" : i === 1 ? "bg-slate-300 text-white" : i === 2 ? "bg-amber-600 text-white" : "bg-muted text-muted-foreground"}`}>{i + 1}</div>
                      <UserAvatar name={u.displayName} url={u.avatarUrl} className="w-7 h-7 text-xs" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{u.displayName}</div>
                        <div className="text-xs text-muted-foreground">Lv {u.level}</div>
                      </div>
                      <div className="font-bold text-yellow-600 text-sm">{u.healthCredits} HC</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Community Members Dialog */}
      <Dialog open={!!communityMembersDialog} onOpenChange={open => !open && setCommunityMembersDialog(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{communityMembersDialog?.name} — Members</DialogTitle>
          </DialogHeader>
          {membersLoading ? (
            <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(communityMembers ?? []).map((m: any) => (
                  <TableRow key={m.userId}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <UserAvatar name={m.displayName} url={m.avatarUrl} className="w-7 h-7 text-xs" />
                        <div>
                          <div className="text-sm font-medium">{m.displayName}</div>
                          <div className="text-xs text-muted-foreground">{m.email}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{roleBadge(m.role)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(m.joinedAt).toLocaleDateString("en-IN")}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost" size="sm"
                        className="text-destructive text-xs"
                        onClick={() => communityMembersDialog && removeMember.mutate({ communityId: communityMembersDialog.id, userId: m.userId })}
                      >
                        Remove
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
