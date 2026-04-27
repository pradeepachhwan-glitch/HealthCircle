import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Pencil, Stethoscope, Bot, Building2, AlertTriangle, MessageSquare, Star, Shield, Siren, Users, Link as LinkIcon, Phone } from "lucide-react";
import { useGetCurrentUser } from "@workspace/api-client-react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

function riskBadge(risk: string) {
  const styles: Record<string, string> = {
    low: "bg-green-100 text-green-700 border-green-200",
    medium: "bg-yellow-100 text-yellow-700 border-yellow-200",
    high: "bg-orange-100 text-orange-700 border-orange-200",
    emergency: "bg-red-100 text-red-700 border-red-200",
  };
  const icons: Record<string, string> = { low: "✓", medium: "⚡", high: "⚠", emergency: "🚨" };
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full border ${styles[risk] ?? "bg-slate-100"}`}>
      {icons[risk]} {risk.toUpperCase()}
    </span>
  );
}

type ValidationAction = "approve" | "reject" | "edit";

interface AISummary {
  id: number;
  postId: number;
  postTitle: string;
  postContent: string;
  communityName: string;
  communitySlug: string;
  whatItCouldBe: string;
  riskLevel: string;
  whatToDo: string;
  whenToSeeDoctor: string;
  disclaimer: string;
  status: string;
  editedContent: string | null;
  validationNote: string | null;
  validatedAt: string | null;
  createdAt: string;
}

function SummaryCard({ s, onValidate }: { s: AISummary; onValidate: (s: AISummary) => void }) {
  return (
    <Card className="border-l-4" style={{ borderLeftColor: s.riskLevel === "emergency" ? "#ef4444" : s.riskLevel === "high" ? "#f97316" : s.riskLevel === "medium" ? "#eab308" : "#22c55e" }}>
      <CardContent className="p-5">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              {riskBadge(s.riskLevel)}
              <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{s.communityName}</span>
              <span className="text-xs text-muted-foreground">{new Date(s.createdAt).toLocaleDateString("en-IN")}</span>
            </div>
            <h3 className="font-semibold text-sm mb-2">{s.postTitle}</h3>
            <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{s.postContent}</p>

            <div className="space-y-2 text-xs">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="font-semibold text-blue-800 mb-1">AI Assessment</div>
                <p className="text-blue-700">{s.whatItCouldBe}</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2">
                  <div className="font-semibold text-emerald-800 mb-1">Recommended Action</div>
                  <p className="text-emerald-700 line-clamp-2">{s.whatToDo}</p>
                </div>
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-2">
                  <div className="font-semibold text-orange-800 mb-1">When to See Doctor</div>
                  <p className="text-orange-700 line-clamp-2">{s.whenToSeeDoctor}</p>
                </div>
              </div>
            </div>
          </div>
          <div className="shrink-0 flex flex-col gap-2">
            {s.status === "pending" ? (
              <>
                <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white gap-1 text-xs" onClick={() => onValidate(s)}>
                  <CheckCircle2 className="w-3.5 h-3.5" /> Review
                </Button>
              </>
            ) : (
              <Badge className={
                s.status === "approved" ? "bg-green-100 text-green-700" :
                  s.status === "rejected" ? "bg-red-100 text-red-700" :
                    "bg-blue-100 text-blue-700"
              }>{s.status}</Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function MedPro() {
  const { data: currentUser } = useGetCurrentUser();
  const queryClient = useQueryClient();
  const [filterStatus, setFilterStatus] = useState<"pending" | "approved" | "rejected" | "edited">("pending");
  const [validateModal, setValidateModal] = useState<AISummary | null>(null);
  const [action, setAction] = useState<ValidationAction | null>(null);
  const [editedContent, setEditedContent] = useState("");
  const [validationNote, setValidationNote] = useState("");
  const [expertCommunityId, setExpertCommunityId] = useState<number | null>(null);
  const [expertPostId, setExpertPostId] = useState("");
  const [expertResponse, setExpertResponse] = useState("");
  const [consultationFilter, setConsultationFilter] = useState<"pending" | "in_review" | "resolved">("pending");
  const [resolveModal, setResolveModal] = useState<any | null>(null);
  const [doctorNote, setDoctorNote] = useState("");

  const { data: stats } = useQuery({
    queryKey: ["medpro-stats"],
    queryFn: () => fetch(`${API_BASE}/medpro/stats`, { credentials: "include" }).then(r => r.json()),
  });

  const { data: communities, isLoading: commLoading } = useQuery({
    queryKey: ["medpro-communities"],
    queryFn: () => fetch(`${API_BASE}/medpro/communities`, { credentials: "include" }).then(r => r.json()),
  });

  const { data: queue, isLoading: queueLoading, refetch: refetchQueue } = useQuery({
    queryKey: ["medpro-ai-queue", filterStatus],
    queryFn: () => fetch(`${API_BASE}/medpro/ai-summaries/queue?status=${filterStatus}`, { credentials: "include" }).then(r => r.json()),
  });

  const { data: urgentCases, isLoading: urgentLoading, refetch: refetchUrgent } = useQuery({
    queryKey: ["medpro-urgent-cases"],
    queryFn: () => fetch(`${API_BASE}/medpro/urgent-cases`, { credentials: "include" }).then(r => r.json()),
  });

  const { data: consultations, isLoading: consultationsLoading, refetch: refetchConsultations } = useQuery({
    queryKey: ["medpro-consultations", consultationFilter],
    queryFn: () => fetch(`${API_BASE}/medpro/consultations?status=${consultationFilter}`, { credentials: "include" }).then(r => r.json()),
  });

  const resolveConsultation = useMutation({
    mutationFn: ({ id, doctorNote, status }: { id: number; doctorNote?: string; status?: string }) =>
      fetch(`${API_BASE}/medpro/consultations/${id}/resolve`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ doctorNote, status: status ?? "resolved" }),
      }).then(r => r.json()),
    onSuccess: () => {
      refetchConsultations();
      queryClient.invalidateQueries({ queryKey: ["medpro-stats"] });
      toast.success("Consultation resolved!");
      setResolveModal(null);
      setDoctorNote("");
    },
    onError: () => toast.error("Failed to resolve consultation"),
  });

  const validateSummary = useMutation({
    mutationFn: ({ id, action, editedContent, validationNote }: { id: number; action: string; editedContent?: string; validationNote?: string }) =>
      fetch(`${API_BASE}/medpro/ai-summaries/${id}/validate`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action, editedContent, validationNote }),
      }).then(r => r.json()),
    onSuccess: () => {
      refetchQueue();
      queryClient.invalidateQueries({ queryKey: ["medpro-stats"] });
      toast.success("AI summary validated successfully!");
      setValidateModal(null);
      setAction(null);
      setEditedContent("");
      setValidationNote("");
    },
    onError: () => toast.error("Failed to validate summary"),
  });

  const postExpertResponse = useMutation({
    mutationFn: ({ communityId, postId, content }: { communityId: number; postId: number; content: string }) =>
      fetch(`${API_BASE}/medpro/communities/${communityId}/expert-response`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ postId, content }),
      }).then(r => r.json()),
    onSuccess: () => {
      toast.success("Expert response posted!");
      setExpertPostId("");
      setExpertResponse("");
    },
    onError: () => toast.error("Failed to post expert response"),
  });

  const handleValidate = () => {
    if (!validateModal || !action) return;
    if (action === "edit" && !editedContent.trim()) { toast.error("Please provide edited content"); return; }
    validateSummary.mutate({ id: validateModal.id, action, editedContent: action === "edit" ? editedContent : undefined, validationNote: validationNote || undefined });
  };

  const openValidate = (s: AISummary) => {
    setValidateModal(s);
    setAction(null);
    setEditedContent(s.whatItCouldBe);
    setValidationNote("");
  };

  return (
    <Layout>
      <div className="max-w-5xl mx-auto p-4 md:p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center">
                <Stethoscope className="w-4 h-4" />
              </div>
              <h1 className="text-2xl font-black">Medical Professional Portal</h1>
            </div>
            <p className="text-muted-foreground text-sm">Validate AI responses · Respond to posts · Support communities</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            {currentUser?.isVerifiedPro ? (
              <div className="flex items-center gap-1.5 bg-amber-100 text-amber-700 border border-amber-200 rounded-full px-3 py-1 text-xs font-bold">
                <Star className="w-3.5 h-3.5 fill-amber-500" /> Verified Pro
              </div>
            ) : (
              <div className="flex items-center gap-1.5 bg-slate-100 text-slate-600 border rounded-full px-3 py-1 text-xs">
                <Shield className="w-3.5 h-3.5" /> Pending Verification
              </div>
            )}
          </div>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <Card><CardContent className="p-4 text-center"><div className="text-2xl font-black text-yellow-600">{stats.pendingTotal}</div><div className="text-xs text-muted-foreground">Pending Review</div></CardContent></Card>
            <Card><CardContent className="p-4 text-center"><div className="text-2xl font-black text-green-600">{stats.approvedTotal}</div><div className="text-xs text-muted-foreground">Approved</div></CardContent></Card>
            <Card><CardContent className="p-4 text-center"><div className="text-2xl font-black text-red-600">{stats.rejectedTotal}</div><div className="text-xs text-muted-foreground">Rejected</div></CardContent></Card>
            <Card><CardContent className="p-4 text-center"><div className="text-2xl font-black text-violet-600">{stats.myValidations}</div><div className="text-xs text-muted-foreground">My Validations</div></CardContent></Card>
          </div>
        )}

        <Tabs defaultValue="urgent" className="space-y-5">
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="urgent" className="gap-1.5 text-xs">
              <Siren className="w-3.5 h-3.5 text-red-500" />
              Urgent Cases
              {Array.isArray(urgentCases) && urgentCases.length > 0 && (
                <span className="bg-red-500 text-white rounded-full w-4 h-4 text-[10px] font-bold flex items-center justify-center ml-1">
                  {urgentCases.length > 9 ? "9+" : urgentCases.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="consultations" className="gap-1.5 text-xs">
              <Users className="w-3.5 h-3.5" />Patient Requests
              {Array.isArray(consultations) && consultations.length > 0 && (
                <span className="bg-amber-500 text-white rounded-full w-4 h-4 text-[10px] font-bold flex items-center justify-center ml-1">
                  {consultations.length > 9 ? "9+" : consultations.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="queue" className="gap-1.5 text-xs"><Bot className="w-3.5 h-3.5" />AI Queue</TabsTrigger>
            <TabsTrigger value="communities" className="gap-1.5 text-xs"><Building2 className="w-3.5 h-3.5" />Communities</TabsTrigger>
            <TabsTrigger value="respond" className="gap-1.5 text-xs"><MessageSquare className="w-3.5 h-3.5" />Expert Response</TabsTrigger>
          </TabsList>

          {/* ── URGENT CASES ── */}
          <TabsContent value="urgent" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-base">High & Emergency Risk Cases</h2>
              <Button variant="outline" size="sm" onClick={() => refetchUrgent()} className="gap-1 text-xs">Refresh</Button>
            </div>
            {urgentLoading ? (
              Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)
            ) : !Array.isArray(urgentCases) || urgentCases.length === 0 ? (
              <Card><CardContent className="p-10 text-center text-muted-foreground">
                <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-green-500" />
                <p className="font-medium">No urgent cases pending review</p>
                <p className="text-xs mt-1">All high-risk AI summaries have been reviewed</p>
              </CardContent></Card>
            ) : urgentCases.map((c: any) => (
              <Card key={c.id} className={`border-l-4 ${c.riskLevel === "emergency" ? "border-l-red-600" : "border-l-orange-500"}`}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start gap-2 justify-between flex-wrap">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${c.riskLevel === "emergency" ? "bg-red-100 text-red-700" : "bg-orange-100 text-orange-700"}`}>
                          {c.riskLevel === "emergency" ? "🚨 EMERGENCY" : "⚠️ HIGH RISK"}
                        </span>
                        <span className="text-xs text-muted-foreground">{c.communityName}</span>
                      </div>
                      <p className="font-semibold mt-1">{c.postTitle}</p>
                    </div>
                    <a
                      href={`/communities/${c.communitySlug}/posts/${c.postId}`}
                      className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                      target="_blank" rel="noopener noreferrer"
                    >
                      <LinkIcon className="w-3 h-3" />View Post
                    </a>
                  </div>
                  {c.postContent && <p className="text-sm text-muted-foreground line-clamp-2">{c.postContent}</p>}
                  {c.whatItCouldBe && (
                    <div className="bg-red-50 dark:bg-red-950 rounded-lg p-3 text-sm space-y-1">
                      <p className="font-medium text-red-700 dark:text-red-300 text-xs uppercase tracking-wide">AI Assessment</p>
                      <p>{c.whatItCouldBe}</p>
                    </div>
                  )}
                  {c.whenToSeeDoctor && (
                    <div className="flex items-start gap-2 text-sm">
                      <Phone className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                      <p className="text-red-700 dark:text-red-300">{c.whenToSeeDoctor}</p>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">Flagged {new Date(c.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* ── PATIENT CONSULTATION REQUESTS ── */}
          <TabsContent value="consultations" className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="font-semibold text-base">Patient Requests</h2>
              <div className="flex gap-2">
                {(["pending", "in_review", "resolved"] as const).map(s => (
                  <Button key={s} size="sm" variant={consultationFilter === s ? "default" : "outline"} className="text-xs"
                    onClick={() => setConsultationFilter(s)}>
                    {s === "pending" ? "Pending" : s === "in_review" ? "In Review" : "Resolved"}
                  </Button>
                ))}
              </div>
            </div>
            {consultationsLoading ? (
              Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)
            ) : !Array.isArray(consultations) || consultations.length === 0 ? (
              <Card><CardContent className="p-10 text-center text-muted-foreground">
                <Users className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p className="font-medium">No {consultationFilter} consultation requests</p>
              </CardContent></Card>
            ) : consultations.map((c: any) => (
              <Card key={c.id} className={`border-l-4 ${c.riskLevel === "emergency" ? "border-l-red-600" : c.riskLevel === "high" ? "border-l-orange-500" : "border-l-amber-400"}`}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">{c.source === "user_request" ? "👤 Patient Request" : c.source === "ai_flag" ? "🤖 AI Flagged" : "Auto"}</span>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${c.riskLevel === "emergency" ? "bg-red-100 text-red-700" : c.riskLevel === "high" ? "bg-orange-100 text-orange-700" : "bg-amber-100 text-amber-700"}`}>
                          {c.riskLevel?.toUpperCase()}
                        </span>
                      </div>
                      <p className="font-semibold text-sm">{c.user?.displayName ?? "Unknown User"}</p>
                      {c.postTitle && <p className="text-xs text-muted-foreground">Re: {c.postTitle}</p>}
                      {c.chatSessionId && <p className="text-xs text-muted-foreground">From chat session #{c.chatSessionId}</p>}
                    </div>
                    {c.status !== "resolved" && (
                      <Button size="sm" variant="default" className="text-xs gap-1"
                        onClick={() => { setResolveModal(c); setDoctorNote(""); }}>
                        <CheckCircle2 className="w-3.5 h-3.5" />Respond
                      </Button>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{c.reason}</p>
                  {c.doctorNote && (
                    <div className="bg-green-50 dark:bg-green-950 rounded-lg p-2.5">
                      <p className="text-xs font-medium text-green-700 dark:text-green-300 mb-0.5">Doctor's Note</p>
                      <p className="text-sm">{c.doctorNote}</p>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">Requested {new Date(c.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</p>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* ── AI VALIDATION QUEUE ── */}
          <TabsContent value="queue" className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {(["pending", "approved", "rejected", "edited"] as const).map(s => (
                <Button
                  key={s}
                  variant={filterStatus === s ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilterStatus(s)}
                  className={`text-xs ${s === "pending" && filterStatus !== "pending" ? "border-yellow-300 text-yellow-700" : ""}`}
                >
                  {s === "pending" && stats?.pendingTotal > 0 && (
                    <span className="bg-yellow-500 text-white rounded-full w-4 h-4 text-[10px] font-bold flex items-center justify-center mr-1">
                      {stats.pendingTotal > 9 ? "9+" : stats.pendingTotal}
                    </span>
                  )}
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </Button>
              ))}
            </div>

            {queueLoading ? (
              <div className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-48" />)}</div>
            ) : (queue ?? []).length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
                  <h3 className="font-bold text-lg mb-1">All clear!</h3>
                  <p className="text-muted-foreground text-sm">No {filterStatus} AI summaries in the queue.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {(queue as AISummary[]).map(s => (
                  <SummaryCard key={s.id} s={s} onValidate={openValidate} />
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── COMMUNITIES ── */}
          <TabsContent value="communities" className="space-y-4">
            <p className="text-sm text-muted-foreground">As a Medical Professional, you have full read access to all communities regardless of membership.</p>
            {commLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-24" />)}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {(communities ?? []).map((c: any) => (
                  <Card key={c.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center text-white text-xl">
                          {c.iconEmoji || "🏥"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm truncate">{c.name}</div>
                          <div className="flex gap-2 text-xs text-muted-foreground">
                            <span>{c.memberCount} members</span>
                            <span>·</span>
                            <span>{c.postCount} posts</span>
                          </div>
                        </div>
                      </div>
                      {c.pendingValidations > 0 && (
                        <div className="flex items-center gap-1 text-xs bg-yellow-50 border border-yellow-200 rounded-lg px-2 py-1.5 mb-3 text-yellow-700">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span><strong>{c.pendingValidations}</strong> AI summaries pending review</span>
                        </div>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full text-xs"
                        onClick={() => setFilterStatus("pending")}
                      >
                        View Posts
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── EXPERT RESPONSE ── */}
          <TabsContent value="respond" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-emerald-500" /> Post an Expert Response
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Your response will be tagged as an <strong>Expert Response</strong> and the post will be marked as professionally reviewed.
                </p>
                <div>
                  <label className="text-xs font-medium mb-1 block">Community</label>
                  <select
                    className="w-full text-sm border rounded-md px-3 py-2 bg-background"
                    onChange={e => setExpertCommunityId(Number(e.target.value))}
                    value={expertCommunityId ?? ""}
                  >
                    <option value="">-- select community --</option>
                    {(communities ?? []).map((c: any) => (
                      <option key={c.id} value={c.id}>{c.iconEmoji} {c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block">Post ID</label>
                  <input
                    type="number"
                    placeholder="Enter the numeric Post ID"
                    className="w-full text-sm border rounded-md px-3 py-2 bg-background"
                    value={expertPostId}
                    onChange={e => setExpertPostId(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground mt-1">You can find the Post ID in the URL when viewing a post.</p>
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block">Your Expert Response</label>
                  <Textarea
                    placeholder="Provide your professional medical assessment, recommendations, or clarifications. This will be tagged as an Expert Response."
                    className="min-h-32 text-sm"
                    value={expertResponse}
                    onChange={e => setExpertResponse(e.target.value)}
                  />
                </div>
                <Button
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                  disabled={!expertCommunityId || !expertPostId || !expertResponse.trim() || postExpertResponse.isPending}
                  onClick={() => expertCommunityId && postExpertResponse.mutate({
                    communityId: expertCommunityId,
                    postId: Number(expertPostId),
                    content: expertResponse,
                  })}
                >
                  <Stethoscope className="w-4 h-4" /> Post Expert Response
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Resolve Consultation Modal */}
      <Dialog open={!!resolveModal} onOpenChange={open => !open && setResolveModal(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-500" /> Respond to Patient Request
            </DialogTitle>
          </DialogHeader>
          {resolveModal && (
            <div className="space-y-4">
              <div className="bg-muted rounded-xl p-4 text-sm space-y-1">
                <div className="font-semibold">{resolveModal.user?.displayName}</div>
                {resolveModal.postTitle && <div className="text-muted-foreground text-xs">Re: {resolveModal.postTitle}</div>}
                <p className="text-sm mt-2">{resolveModal.reason}</p>
              </div>
              <div>
                <label className="text-xs font-semibold mb-1.5 block">Your Clinical Note</label>
                <Textarea
                  value={doctorNote}
                  onChange={e => setDoctorNote(e.target.value)}
                  placeholder="Provide your professional assessment, recommendations, or advice for this patient…"
                  className="min-h-28 text-sm"
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setResolveModal(null)}>Cancel</Button>
            <Button
              onClick={() => resolveConsultation.mutate({ id: resolveModal.id, doctorNote, status: "in_review" })}
              disabled={resolveConsultation.isPending}
              variant="secondary"
            >
              Mark In Review
            </Button>
            <Button
              onClick={() => resolveConsultation.mutate({ id: resolveModal.id, doctorNote, status: "resolved" })}
              disabled={resolveConsultation.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              {resolveConsultation.isPending ? "Saving…" : "Resolve & Send Note"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Validation Modal */}
      <Dialog open={!!validateModal} onOpenChange={open => !open && setValidateModal(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-violet-500" /> Validate AI Summary
            </DialogTitle>
          </DialogHeader>

          {validateModal && (
            <div className="space-y-4">
              <div className="bg-muted rounded-xl p-4 text-sm">
                <div className="flex items-center gap-2 mb-2">{riskBadge(validateModal.riskLevel)}</div>
                <div className="font-semibold mb-1">{validateModal.postTitle}</div>
                <p className="text-muted-foreground text-xs line-clamp-3">{validateModal.postContent}</p>
              </div>

              <div className="space-y-3 text-sm">
                <div>
                  <div className="font-semibold text-xs mb-1 text-blue-700">AI ASSESSMENT</div>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-blue-800 text-xs">{validateModal.whatItCouldBe}</div>
                </div>
                <div>
                  <div className="font-semibold text-xs mb-1 text-emerald-700">RECOMMENDED ACTION</div>
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-emerald-800 text-xs">{validateModal.whatToDo}</div>
                </div>
                <div>
                  <div className="font-semibold text-xs mb-1 text-orange-700">WHEN TO SEE DOCTOR</div>
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-orange-800 text-xs">{validateModal.whenToSeeDoctor}</div>
                </div>
              </div>

              <div className="border-t pt-4">
                <div className="text-xs font-semibold mb-2">Your Decision:</div>
                <div className="flex gap-2 mb-4">
                  <Button
                    size="sm"
                    variant={action === "approve" ? "default" : "outline"}
                    className={`flex-1 gap-1 text-xs ${action === "approve" ? "bg-green-600 hover:bg-green-700" : "border-green-300 text-green-700 hover:bg-green-50"}`}
                    onClick={() => setAction("approve")}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                  </Button>
                  <Button
                    size="sm"
                    variant={action === "edit" ? "default" : "outline"}
                    className={`flex-1 gap-1 text-xs ${action === "edit" ? "bg-blue-600 hover:bg-blue-700" : "border-blue-300 text-blue-700 hover:bg-blue-50"}`}
                    onClick={() => setAction("edit")}
                  >
                    <Pencil className="w-3.5 h-3.5" /> Edit & Approve
                  </Button>
                  <Button
                    size="sm"
                    variant={action === "reject" ? "default" : "outline"}
                    className={`flex-1 gap-1 text-xs ${action === "reject" ? "bg-red-600 hover:bg-red-700" : "border-red-300 text-red-700 hover:bg-red-50"}`}
                    onClick={() => setAction("reject")}
                  >
                    <XCircle className="w-3.5 h-3.5" /> Reject
                  </Button>
                </div>

                {action === "edit" && (
                  <div className="mb-3">
                    <label className="text-xs font-medium mb-1 block">Corrected Assessment</label>
                    <Textarea
                      value={editedContent}
                      onChange={e => setEditedContent(e.target.value)}
                      className="text-xs min-h-20"
                      placeholder="Provide the correct medical assessment…"
                    />
                  </div>
                )}

                <div>
                  <label className="text-xs font-medium mb-1 block">Note (optional)</label>
                  <Textarea
                    value={validationNote}
                    onChange={e => setValidationNote(e.target.value)}
                    className="text-xs min-h-16"
                    placeholder="Add a clinical note explaining your decision…"
                  />
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setValidateModal(null)}>Cancel</Button>
            <Button
              disabled={!action || validateSummary.isPending}
              onClick={handleValidate}
              className={
                action === "approve" ? "bg-green-600 hover:bg-green-700" :
                  action === "reject" ? "bg-red-600 hover:bg-red-700" :
                    "bg-blue-600 hover:bg-blue-700"
              }
            >
              {validateSummary.isPending ? "Saving…" : `Confirm ${action ? action.charAt(0).toUpperCase() + action.slice(1) : ""}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
