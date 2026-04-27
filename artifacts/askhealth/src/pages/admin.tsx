import { useGetAdminStats, useListUsers, useUpdateUserRole, getListUsersQueryKey, useBanUser } from "@workspace/api-client-react";
import { Layout, UserAvatar } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, FileText, MessageSquare, Activity, Shield, ShieldAlert, ShieldCheck } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export default function Admin() {
  const { data: stats, isLoading: statsLoading } = useGetAdminStats();
  const { data: users, isLoading: usersLoading } = useListUsers();
  
  const queryClient = useQueryClient();
  const updateRole = useUpdateUserRole();
  const banUser = useBanUser();

  const handleRoleChange = (userId: string, role: "admin" | "moderator" | "member") => {
    updateRole.mutate(
      { userId, data: { role } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
          toast.success("Role updated successfully");
        },
        onError: () => toast.error("Failed to update role")
      }
    );
  };

  const handleBanToggle = (userId: string, isBanned: boolean) => {
    banUser.mutate(
      { userId, data: { isBanned } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
          toast.success(isBanned ? "User banned" : "User unbanned");
        },
        onError: () => toast.error("Failed to update ban status")
      }
    );
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto p-6 md:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-1 tracking-tight">Admin Dashboard</h1>
            <p className="text-muted-foreground">Manage platform settings, users, and communities.</p>
          </div>
          <Link href="/admin/broadcast">
            <Button className="shrink-0 bg-sidebar-primary text-white hover:bg-sidebar-primary/90">
              <MessageSquare className="w-4 h-4 mr-2" />
              New Broadcast
            </Button>
          </Link>
        </div>

        {statsLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
          </div>
        ) : stats ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center">
                    <Users className="w-5 h-5" />
                  </div>
                </div>
                <div className="text-3xl font-bold mb-1">{stats.totalUsers}</div>
                <div className="text-sm text-muted-foreground flex justify-between">
                  <span>Total Users</span>
                  <span className="text-green-600">+{stats.newUsersThisWeek} this week</span>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-lg bg-sidebar-primary/10 text-sidebar-primary flex items-center justify-center">
                    <Activity className="w-5 h-5" />
                  </div>
                </div>
                <div className="text-3xl font-bold mb-1">{stats.weeklyActiveUsers}</div>
                <div className="text-sm text-muted-foreground">Weekly Active Users</div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-lg bg-orange-500/10 text-orange-600 flex items-center justify-center">
                    <FileText className="w-5 h-5" />
                  </div>
                </div>
                <div className="text-3xl font-bold mb-1">{stats.totalPosts}</div>
                <div className="text-sm text-muted-foreground">Total Posts</div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-lg bg-purple-500/10 text-purple-600 flex items-center justify-center">
                    <MessageSquare className="w-5 h-5" />
                  </div>
                </div>
                <div className="text-3xl font-bold mb-1">{stats.totalComments}</div>
                <div className="text-sm text-muted-foreground">Total Comments</div>
              </CardContent>
            </Card>
          </div>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>User Management</CardTitle>
          </CardHeader>
          <CardContent>
            {usersLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
              </div>
            ) : users ? (
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
                    {users.map(user => (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <UserAvatar name={user.displayName} url={user.avatarUrl} className="w-8 h-8" />
                            <div>
                              <div className="font-medium flex items-center gap-2">
                                {user.displayName}
                                {user.isBanned && <Badge variant="destructive" className="h-5 text-[10px]">BANNED</Badge>}
                              </div>
                              <div className="text-xs text-muted-foreground">{user.email}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={user.role === 'admin' ? 'default' : user.role === 'moderator' ? 'secondary' : 'outline'}>
                            {user.role}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">Level {user.level}</div>
                          <div className="text-xs text-muted-foreground">{user.healthCredits} HC</div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(user.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">Manage</Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleRoleChange(user.id, "admin")}>
                                <ShieldCheck className="w-4 h-4 mr-2" /> Make Admin
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleRoleChange(user.id, "moderator")}>
                                <Shield className="w-4 h-4 mr-2" /> Make Moderator
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleRoleChange(user.id, "member")}>
                                <UserAvatar name="Member" className="w-4 h-4 mr-2 !bg-transparent !text-foreground" /> Make Member
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                className={user.isBanned ? "text-green-600" : "text-destructive"}
                                onClick={() => handleBanToggle(user.id, !user.isBanned)}
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
            ) : null}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
