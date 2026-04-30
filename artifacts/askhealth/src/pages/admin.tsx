import { useState, useEffect } from "react";
import { useGetAdminStats, useListUsers, getListUsersQueryKey, useBanUser } from "@workspace/api-client-react";
import { Layout, UserAvatar } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, FileText, MessageSquare, Activity, Shield, ShieldAlert, ShieldCheck, Bot, Coins, Building2, Pin, Trash2, CheckCircle2, XCircle, Pencil, Star, Radio, TrendingUp, Award, Stethoscope, Video, ClipboardList, ScrollText, Loader2 } from "lucide-react";
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

// ─── Tele-Consult oversight panel ─────────────────────────────────────────
function TeleconsultAdminPanel() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const queryClient = useQueryClient();

  const { data: stats } = useQuery({
    queryKey: ["admin-tc-stats"],
    queryFn: () => adminFetch(`${API_BASE}/admin/teleconsult/stats`).then(r => r.json()),
  });

  const { data: list, isLoading } = useQuery({
    queryKey: ["admin-tc-consultations", statusFilter],
    queryFn: () => adminFetch(`${API_BASE}/admin/teleconsult/consultations${statusFilter !== "all" ? `?status=${statusFilter}` : ""}`).then(r => r.json()),
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      adminFetch(`${API_BASE}/admin/teleconsult/consultations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-tc-consultations"] });
      queryClient.invalidateQueries({ queryKey: ["admin-tc-stats"] });
      toast.success("Status updated");
    },
    onError: () => toast.error("Failed to update"),
  });

  const statusBadge = (s: string) => {
    const colors: Record<string, string> = {
      pending: "bg-yellow-100 text-yellow-800",
      scheduled: "bg-blue-100 text-blue-800",
      in_progress: "bg-green-100 text-green-800",
      completed: "bg-slate-100 text-slate-800",
      cancelled: "bg-red-100 text-red-800",
      no_show: "bg-orange-100 text-orange-800",
    };
    return <Badge className={colors[s] ?? "bg-slate-100"}>{s}</Badge>;
  };

  const FILTERS = ["all", "pending", "scheduled", "in_progress", "completed", "cancelled", "no_show"];

  return (
    <>
      {stats?.stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {Object.entries(stats.stats as Record<string, number>).map(([s, n]) => (
            <Card key={s}><CardContent className="p-3 text-center">
              <div className="text-2xl font-bold">{n}</div>
              <div className="text-xs text-muted-foreground capitalize">{s.replace("_", " ")}</div>
            </CardContent></Card>
          ))}
        </div>
      )}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <CardTitle>Tele-Consult sessions</CardTitle>
            <div className="flex gap-1 flex-wrap">
              {FILTERS.map(f => (
                <Button key={f} size="sm" variant={statusFilter === f ? "default" : "outline"} onClick={() => setStatusFilter(f)} className="h-7 text-xs capitalize" data-testid={`tc-filter-${f}`}>
                  {f.replace("_", " ")}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-40" /> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead>Doctor</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(list?.consultations ?? []).map((row: any) => (
                  <TableRow key={row.consultation.id}>
                    <TableCell className="font-mono text-xs">#{row.consultation.id}</TableCell>
                    <TableCell>
                      <div className="text-sm">{row.patient?.displayName ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{row.patient?.email}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{row.doctor?.name ?? <span className="text-muted-foreground italic">unassigned</span>}</div>
                      <div className="text-xs text-muted-foreground">{row.doctor?.specialty}</div>
                    </TableCell>
                    <TableCell><Badge variant="outline" className="capitalize text-xs">{row.consultation.type}</Badge></TableCell>
                    <TableCell>{statusBadge(row.consultation.status)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(row.consultation.createdAt).toLocaleString()}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="sm">Set status</Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {["pending", "scheduled", "in_progress", "completed", "cancelled", "no_show"].map(s => (
                            <DropdownMenuItem key={s} onSelect={() => updateStatus.mutate({ id: row.consultation.id, status: s })} disabled={s === row.consultation.status} className="capitalize">
                              {s.replace("_", " ")}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
                {(list?.consultations ?? []).length === 0 && !isLoading && (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground text-sm py-8">No consultations match this filter.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}

// ─── Doctor application approval queue ────────────────────────────────────
function DoctorApplicationsPanel() {
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [reviewModal, setReviewModal] = useState<{ id: number; mode: "approve" | "reject"; appName: string } | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const queryClient = useQueryClient();

  const { data: apps, isLoading } = useQuery({
    queryKey: ["admin-doctor-apps", statusFilter],
    queryFn: () => adminFetch(`${API_BASE}/admin/doctor-applications?status=${statusFilter}`).then(r => r.json()),
  });

  const review = useMutation({
    mutationFn: ({ id, mode, notes }: { id: number; mode: "approve" | "reject"; notes: string }) =>
      adminFetch(`${API_BASE}/admin/doctor-applications/${id}/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      }).then(async r => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? "Failed");
        return data;
      }),
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ["admin-doctor-apps"] });
      queryClient.invalidateQueries({ queryKey: ["admin-audit-log"] });
      toast.success(vars.mode === "approve" ? "Doctor approved" : "Application rejected");
      setReviewModal(null);
      setReviewNotes("");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed"),
  });

  const FILTERS = ["pending", "approved", "rejected"];

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <CardTitle>Doctor applications</CardTitle>
            <div className="flex gap-1">
              {FILTERS.map(f => (
                <Button key={f} size="sm" variant={statusFilter === f ? "default" : "outline"} onClick={() => setStatusFilter(f)} className="h-7 text-xs capitalize" data-testid={`doctor-filter-${f}`}>{f}</Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-40" /> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Applicant</TableHead>
                  <TableHead>Specialty</TableHead>
                  <TableHead>Reg. number</TableHead>
                  <TableHead>Exp.</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(apps?.applications ?? []).map((row: any) => (
                  <TableRow key={row.app.id}>
                    <TableCell>
                      <div className="text-sm font-medium">{row.app.name}</div>
                      <div className="text-xs text-muted-foreground">{row.user?.email ?? "—"}</div>
                    </TableCell>
                    <TableCell><span className="text-sm">{row.app.specialty}</span></TableCell>
                    <TableCell className="font-mono text-xs">{row.app.registrationNumber}</TableCell>
                    <TableCell>{row.app.experienceYears}y</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(row.app.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      {row.app.status === "pending" ? (
                        <div className="flex gap-1 justify-end">
                          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => { setReviewModal({ id: row.app.id, mode: "approve", appName: row.app.name }); setReviewNotes(""); }} data-testid={`approve-${row.app.id}`}>
                            <CheckCircle2 className="w-3 h-3" />Approve
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-red-600" onClick={() => { setReviewModal({ id: row.app.id, mode: "reject", appName: row.app.name }); setReviewNotes(""); }} data-testid={`reject-${row.app.id}`}>
                            <XCircle className="w-3 h-3" />Reject
                          </Button>
                        </div>
                      ) : (
                        <Badge variant="outline" className="capitalize text-xs">{row.app.status}</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {(apps?.applications ?? []).length === 0 && !isLoading && (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground text-sm py-8">No {statusFilter} applications.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!reviewModal} onOpenChange={(open) => !open && setReviewModal(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{reviewModal?.mode === "approve" ? "Approve" : "Reject"} {reviewModal?.appName}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Textarea placeholder="Optional notes for the applicant…" value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} rows={3} />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setReviewModal(null)}>Cancel</Button>
              <Button
                onClick={() => reviewModal && review.mutate({ id: reviewModal.id, mode: reviewModal.mode, notes: reviewNotes })}
                disabled={review.isPending}
                variant={reviewModal?.mode === "reject" ? "destructive" : "default"}
                data-testid="confirm-review"
              >
                {review.isPending && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                Confirm {reviewModal?.mode}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Audit log viewer ─────────────────────────────────────────────────────
function AuditLogPanel() {
  const [actionFilter, setActionFilter] = useState("");
  const { data: logs, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["admin-audit-log", actionFilter],
    queryFn: () => adminFetch(`${API_BASE}/admin/audit-log${actionFilter ? `?action=${encodeURIComponent(actionFilter)}` : ""}`).then(r => r.json()),
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <CardTitle>Audit log</CardTitle>
          <div className="flex gap-2 items-center">
            <Input placeholder="Filter by action (e.g. user.role_change)" value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} className="h-8 w-64 text-sm" data-testid="audit-action-filter" />
            <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching} className="h-8">
              {isFetching ? <Loader2 className="w-3 h-3 animate-spin" /> : "Refresh"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? <Skeleton className="h-40" /> : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(logs?.entries ?? []).map((row: any) => (
                <TableRow key={row.entry.id}>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{new Date(row.entry.createdAt).toLocaleString()}</TableCell>
                  <TableCell>
                    <div className="text-sm font-medium">{row.actor?.displayName ?? <span className="italic text-muted-foreground">deleted</span>}</div>
                    <div className="text-xs text-muted-foreground">{row.actor?.email}</div>
                  </TableCell>
                  <TableCell><code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">{row.entry.action}</code></TableCell>
                  <TableCell className="text-xs">
                    {row.entry.targetType ? <><span className="text-muted-foreground">{row.entry.targetType}</span> <span className="font-mono">#{row.entry.targetId}</span></> : "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-md truncate">
                    {row.entry.meta ? <code className="text-xs">{JSON.stringify(row.entry.meta)}</code> : "—"}
                  </TableCell>
                </TableRow>
              ))}
              {(logs?.entries ?? []).length === 0 && !isLoading && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground text-sm py-8">No audit entries yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        )}
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

  // Create / edit community dialogs.
  // `createCommunityOpen` controls the "New community" dialog.
  // `editCommunityTarget` holds the community currently being edited (or null).
  const [createCommunityOpen, setCreateCommunityOpen] = useState(false);
  const [editCommunityTarget, setEditCommunityTarget] = useState<any | null>(null);
  const [communityForm, setCommunityForm] = useState({
    name: "",
    slug: "",
    description: "",
    iconEmoji: "",
    iconUrl: "",
    coverColor: "#06b6d4",
  });
  const [logoUploading, setLogoUploading] = useState(false);
  // Track whether the slug has been edited manually so name typing only
  // overwrites it while it has not been customized.
  const [slugTouched, setSlugTouched] = useState(false);
  function slugify(s: string) {
    return s.toLowerCase().trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 60);
  }
  function openCreateCommunity() {
    setCommunityForm({ name: "", slug: "", description: "", iconEmoji: "", iconUrl: "", coverColor: "#06b6d4" });
    setSlugTouched(false);
    setCreateCommunityOpen(true);
  }
  function openEditCommunity(c: any) {
    setCommunityForm({
      name: c.name ?? "",
      slug: c.slug ?? "",
      description: c.description ?? "",
      iconEmoji: c.iconEmoji ?? "",
      iconUrl: c.iconUrl ?? "",
      coverColor: c.coverColor ?? "#06b6d4",
    });
    setSlugTouched(true);
    setEditCommunityTarget(c);
  }

  // Read a File, resize/center-crop to a square thumbnail (PNG, max 256px),
  // and return the base64 data URL. Keeps stored logos tiny (~10–40 KB) so
  // the communities list stays snappy even though we inline the bytes in the
  // database column instead of using object storage.
  async function resizeImageToSquareDataUrl(file: File, maxDim = 256): Promise<string> {
    const dataUrl: string = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("Could not read file"));
      reader.readAsDataURL(file);
    });
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("Could not decode image"));
      i.src = dataUrl;
    });
    const side = Math.min(img.width, img.height);
    const sx = (img.width - side) / 2;
    const sy = (img.height - side) / 2;
    const out = document.createElement("canvas");
    out.width = Math.min(maxDim, side);
    out.height = out.width;
    const ctx = out.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable");
    ctx.drawImage(img, sx, sy, side, side, 0, 0, out.width, out.height);
    // PNG keeps transparent backgrounds (logos), at this size still tiny.
    return out.toDataURL("image/png");
  }
  async function handleLogoFile(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file (PNG, JPG, GIF or WebP).");
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
      toast.error(`Logo is too large (${sizeMb} MB). Please pick an image under 4 MB.`);
      return;
    }
    try {
      setLogoUploading(true);
      const dataUrl = await resizeImageToSquareDataUrl(file);
      // Hand to the server's inline-upload validator which enforces type/size
      // and echoes back the data URL we should persist.
      const res = await adminFetch(`${API_BASE}/uploads/inline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataUrl, name: file.name }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        // Map the most common server-side rejections to friendly messages so
        // operators see *why* the upload failed instead of a bare status code.
        if (res.status === 413) {
          throw new Error("Logo is too large for the server (4 MB max). Try a smaller image.");
        }
        if (res.status === 401 || res.status === 403) {
          throw new Error("You're not signed in as an admin. Refresh and try again.");
        }
        throw new Error(err.error ?? `Upload failed (${res.status})`);
      }
      const { url } = await res.json();
      setCommunityForm(f => ({ ...f, iconUrl: url }));
      toast.success("Logo uploaded — don't forget to Save the community.");
    } catch (e: any) {
      toast.error(e?.message ?? "Could not upload logo. Please try again.");
    } finally {
      setLogoUploading(false);
    }
  }

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

  // Search users to add to a community (debounced via the input itself).
  const [memberSearchQuery, setMemberSearchQuery] = useState("");
  const { data: userSearchResults } = useQuery({
    queryKey: ["admin-user-search", memberSearchQuery],
    enabled: memberSearchQuery.trim().length >= 2,
    queryFn: () =>
      adminFetch(`${API_BASE}/admin/users/search?q=${encodeURIComponent(memberSearchQuery.trim())}&limit=10`)
        .then(r => r.json()),
  });

  const addMember = useMutation({
    mutationFn: ({ communityId, userId }: { communityId: number; userId: string }) =>
      adminFetch(`${API_BASE}/admin/communities/${communityId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIds: [userId] }),
      }).then(r => r.json()),
    onSuccess: (data: { added: any[]; alreadyMember: number }) => {
      refetchMembers();
      if (data.added?.length) {
        toast.success(`Added ${data.added[0].displayName}`);
        setMemberSearchQuery("");
      } else if (data.alreadyMember) {
        toast.info("User is already a member");
      }
    },
    onError: () => toast.error("Could not add member"),
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

  // Create a brand-new community. Hits the public POST /communities route
  // (admin-guarded) which already supports name/slug/description/iconEmoji/
  // coverColor — the duplicate /admin/communities PATCH only handles a subset.
  const createCommunity = useMutation({
    mutationFn: (payload: { name: string; slug: string; description?: string; iconEmoji?: string; iconUrl?: string; coverColor?: string }) =>
      adminFetch(`${API_BASE}/communities`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).then(async r => {
        if (!r.ok) {
          const err = await r.json().catch(() => ({}));
          throw new Error(err.error ?? `Failed (${r.status})`);
        }
        return r.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-communities"] });
      setCreateCommunityOpen(false);
      toast.success("Community created");
    },
    onError: (e: Error) => toast.error(e.message || "Could not create community"),
  });

  // Edit an existing community. Uses the full PATCH /communities/:id route so
  // we can update iconEmoji and coverColor in addition to name/description.
  const updateCommunity = useMutation({
    mutationFn: (payload: { id: number; name?: string; description?: string; iconEmoji?: string; iconUrl?: string | null; coverColor?: string }) =>
      adminFetch(`${API_BASE}/communities/${payload.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: payload.name,
          description: payload.description,
          iconEmoji: payload.iconEmoji,
          iconUrl: payload.iconUrl,
          coverColor: payload.coverColor,
        }),
      }).then(async r => {
        if (!r.ok) {
          const err = await r.json().catch(() => ({}));
          throw new Error(err.error ?? `Failed (${r.status})`);
        }
        return r.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-communities"] });
      setEditCommunityTarget(null);
      toast.success("Community updated");
    },
    onError: (e: Error) => toast.error(e.message || "Could not update community"),
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
            <TabsTrigger value="teleconsult" className="gap-1.5 text-xs" data-testid="tab-teleconsult"><Video className="w-3.5 h-3.5" />Tele-Consult</TabsTrigger>
            <TabsTrigger value="doctor-apps" className="gap-1.5 text-xs" data-testid="tab-doctor-apps"><ClipboardList className="w-3.5 h-3.5" />Doctor Apps</TabsTrigger>
            <TabsTrigger value="audit" className="gap-1.5 text-xs" data-testid="tab-audit"><ScrollText className="w-3.5 h-3.5" />Audit Log</TabsTrigger>
          </TabsList>

          {/* ── OVERVIEW ── */}
          <TabsContent value="overview" className="space-y-6">
            {statsLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                {[...Array(10)].map((_, i) => <Skeleton key={i} className="h-28" />)}
              </div>
            ) : stats ? (
              <>
                {/* Active-user funnel: DAU / WAU / MAU. A user counts as
                    "active" if they posted, commented, asked Yukti, or
                    searched in the window — not just by being logged in. */}
                <div className="grid grid-cols-3 gap-3">
                  <StatCard icon={Activity} color="bg-emerald-100 text-emerald-700" value={(stats as any).dau ?? 0} label="DAU" sub="active in last 24h" />
                  <StatCard icon={Activity} color="bg-violet-100 text-violet-700" value={(stats as any).wau ?? 0} label="WAU" sub="active in last 7 days" />
                  <StatCard icon={Activity} color="bg-blue-100 text-blue-700" value={(stats as any).mau ?? 0} label="MAU" sub="active in last 30 days" />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                  <StatCard icon={Users} color="bg-blue-100 text-blue-600" value={stats.totalUsers} label="Total Users" sub={`+${stats.newUsersThisWeek} this week`} />
                  <StatCard icon={Activity} color="bg-violet-100 text-violet-600" value={stats.weeklyActiveUsers} label="Weekly Touched" />
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
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm text-muted-foreground">
                {(communities ?? []).length} communit{(communities ?? []).length === 1 ? "y" : "ies"} total
              </div>
              <Button
                size="sm"
                className="gap-1.5 bg-cyan-600 hover:bg-cyan-700 text-white"
                onClick={openCreateCommunity}
                data-testid="button-new-community"
              >
                <Building2 className="w-4 h-4" /> New Community
              </Button>
            </div>
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
                                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center text-white text-sm overflow-hidden">
                                  {c.iconUrl ? (
                                    <img src={c.iconUrl} alt="" className="w-full h-full object-cover" />
                                  ) : (
                                    c.iconEmoji || "🏥"
                                  )}
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
                              <div className="flex justify-end gap-2 flex-wrap">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openEditCommunity(c)}
                                  data-testid={`button-edit-community-${c.id}`}
                                >
                                  Edit
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => setCommunityMembersDialog({ id: c.id, name: c.name })}>
                                  Members
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

          {/* ── TELE-CONSULT OVERSIGHT ── */}
          <TabsContent value="teleconsult" className="space-y-4">
            <TeleconsultAdminPanel />
          </TabsContent>

          {/* ── DOCTOR APPLICATIONS ── */}
          <TabsContent value="doctor-apps" className="space-y-4">
            <DoctorApplicationsPanel />
          </TabsContent>

          {/* ── AUDIT LOG ── */}
          <TabsContent value="audit" className="space-y-4">
            <AuditLogPanel />
          </TabsContent>
        </Tabs>
      </div>

      {/* Create / Edit Community Dialog (one shared body for both modes) */}
      <Dialog
        open={createCommunityOpen || !!editCommunityTarget}
        onOpenChange={open => {
          if (!open) { setCreateCommunityOpen(false); setEditCommunityTarget(null); }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editCommunityTarget ? `Edit ${editCommunityTarget.name}` : "Create new community"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Live preview chip — shows the icon/color users will see in lists */}
            <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/40">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl text-white shrink-0 overflow-hidden"
                style={{ background: communityForm.coverColor || "#06b6d4" }}
              >
                {communityForm.iconUrl ? (
                  <img
                    src={communityForm.iconUrl}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  communityForm.iconEmoji || "🏥"
                )}
              </div>
              <div className="min-w-0">
                <div className="font-semibold truncate">{communityForm.name || "Community name"}</div>
                <div className="text-xs text-muted-foreground truncate">/{communityForm.slug || "slug"}</div>
              </div>
            </div>

            {/* Logo upload — uploaded image takes precedence over the emoji */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Logo image (optional)</label>
              <div className="flex items-center gap-3">
                <div
                  className="w-16 h-16 rounded-lg border bg-muted/30 flex items-center justify-center overflow-hidden text-2xl shrink-0"
                  style={{ background: communityForm.iconUrl ? undefined : (communityForm.coverColor || "#06b6d4") }}
                >
                  {communityForm.iconUrl ? (
                    <img src={communityForm.iconUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-white">{communityForm.iconEmoji || "🏥"}</span>
                  )}
                </div>
                <div className="flex-1 flex flex-wrap items-center gap-2">
                  <label
                    htmlFor="community-logo-file"
                    className="inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-md border border-input bg-background text-sm font-medium cursor-pointer hover:bg-muted/50 disabled:opacity-50"
                  >
                    {logoUploading ? "Uploading…" : (communityForm.iconUrl ? "Replace logo" : "Upload logo")}
                  </label>
                  <input
                    id="community-logo-file"
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    disabled={logoUploading}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) await handleLogoFile(file);
                      e.target.value = "";
                    }}
                    data-testid="input-community-logo-file"
                  />
                  {communityForm.iconUrl && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => setCommunityForm(f => ({ ...f, iconUrl: "" }))}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Square images work best. We'll center-crop and resize to 256×256.
                If no logo is uploaded, the emoji below is used.
              </p>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="community-name" className="text-sm font-medium">Name</label>
              <Input
                id="community-name"
                value={communityForm.name}
                onChange={e => {
                  const name = e.target.value;
                  setCommunityForm(f => ({
                    ...f,
                    name,
                    slug: slugTouched ? f.slug : slugify(name),
                  }));
                }}
                placeholder="e.g. Diabetes Care"
                data-testid="input-community-name"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="community-slug" className="text-sm font-medium">Slug (URL handle)</label>
              <Input
                id="community-slug"
                value={communityForm.slug}
                onChange={e => { setCommunityForm(f => ({ ...f, slug: slugify(e.target.value) })); setSlugTouched(true); }}
                placeholder="e.g. diabetes-care"
                disabled={!!editCommunityTarget}
                data-testid="input-community-slug"
              />
              {editCommunityTarget ? (
                <p className="text-xs text-muted-foreground">Slug cannot be changed after creation.</p>
              ) : (!communityForm.slug.trim() && communityForm.name.trim()) ? (
                <p className="text-xs text-amber-600">
                  We could not generate a URL handle from that name (non-Latin characters).
                  Please type one manually — letters, numbers, and dashes only.
                </p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="community-description" className="text-sm font-medium">Description</label>
              <textarea
                id="community-description"
                value={communityForm.description}
                onChange={e => setCommunityForm(f => ({ ...f, description: e.target.value }))}
                rows={3}
                placeholder="What this community is about…"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                data-testid="input-community-description"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label htmlFor="community-icon" className="text-sm font-medium">Icon (emoji)</label>
                <Input
                  id="community-icon"
                  value={communityForm.iconEmoji}
                  onChange={e => setCommunityForm(f => ({ ...f, iconEmoji: e.target.value.slice(0, 4) }))}
                  placeholder="🩺"
                  className="text-2xl text-center"
                  data-testid="input-community-icon"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="community-color" className="text-sm font-medium">Cover color</label>
                <div className="flex items-center gap-2">
                  <input
                    id="community-color"
                    type="color"
                    aria-label="Cover color picker"
                    value={communityForm.coverColor || "#06b6d4"}
                    onChange={e => setCommunityForm(f => ({ ...f, coverColor: e.target.value }))}
                    className="w-10 h-10 rounded-md border cursor-pointer"
                    data-testid="input-community-color"
                  />
                  <Input
                    aria-label="Cover color hex value"
                    value={communityForm.coverColor}
                    onChange={e => setCommunityForm(f => ({ ...f, coverColor: e.target.value }))}
                    placeholder="#06b6d4"
                    className="flex-1 font-mono text-xs"
                  />
                </div>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => { setCreateCommunityOpen(false); setEditCommunityTarget(null); }}
            >
              Cancel
            </Button>
            {editCommunityTarget ? (
              <Button
                onClick={() => updateCommunity.mutate({
                  id: editCommunityTarget.id,
                  name: communityForm.name.trim(),
                  description: communityForm.description.trim() || undefined,
                  iconEmoji: communityForm.iconEmoji || undefined,
                  // Empty string means "remove the logo" — server normalizes to null.
                  iconUrl: communityForm.iconUrl || "",
                  coverColor: communityForm.coverColor || undefined,
                })}
                disabled={!communityForm.name.trim() || updateCommunity.isPending}
                data-testid="button-save-community"
              >
                {updateCommunity.isPending ? "Saving…" : "Save changes"}
              </Button>
            ) : (
              <Button
                onClick={() => createCommunity.mutate({
                  name: communityForm.name.trim(),
                  slug: communityForm.slug.trim() || slugify(communityForm.name),
                  description: communityForm.description.trim() || undefined,
                  iconEmoji: communityForm.iconEmoji || undefined,
                  iconUrl: communityForm.iconUrl || undefined,
                  coverColor: communityForm.coverColor || undefined,
                })}
                disabled={!communityForm.name.trim() || !communityForm.slug.trim() || createCommunity.isPending}
                data-testid="button-create-community"
              >
                {createCommunity.isPending ? "Creating…" : "Create community"}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Community Members Dialog */}
      <Dialog open={!!communityMembersDialog} onOpenChange={open => { if (!open) { setCommunityMembersDialog(null); setMemberSearchQuery(""); } }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{communityMembersDialog?.name} — Members</DialogTitle>
          </DialogHeader>

          {/* Add Members section — search by name or email, click to add (WhatsApp-style) */}
          <div className="space-y-2 border-b border-border pb-4 mb-2">
            <div className="text-sm font-medium">Add members</div>
            <Input
              placeholder="Search by name or email…"
              value={memberSearchQuery}
              onChange={e => setMemberSearchQuery(e.target.value)}
              data-testid="input-member-search"
            />
            {memberSearchQuery.trim().length >= 2 && (
              <div className="border border-border rounded max-h-48 overflow-y-auto">
                {!userSearchResults || userSearchResults.length === 0 ? (
                  <div className="text-xs text-muted-foreground p-3 text-center">No users found</div>
                ) : (
                  userSearchResults.map((u: any) => {
                    const alreadyMember = (communityMembers ?? []).some((m: any) => m.userId === u.clerkId);
                    return (
                      <div key={u.clerkId} className="flex items-center justify-between gap-2 p-2 hover:bg-muted/50 border-b border-border last:border-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <UserAvatar name={u.displayName} url={u.avatarUrl} className="w-7 h-7 text-xs" />
                          <div className="min-w-0">
                            <div className="text-sm font-medium truncate">{u.displayName}</div>
                            <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant={alreadyMember ? "ghost" : "default"}
                          disabled={alreadyMember || addMember.isPending}
                          onClick={() => communityMembersDialog && addMember.mutate({ communityId: communityMembersDialog.id, userId: u.clerkId })}
                          data-testid={`button-add-member-${u.clerkId}`}
                        >
                          {alreadyMember ? "Member" : "Add"}
                        </Button>
                      </div>
                    );
                  })
                )}
              </div>
            )}
            {memberSearchQuery.trim().length < 2 && (
              <p className="text-xs text-muted-foreground">Type at least 2 characters to search.</p>
            )}
          </div>

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
