import { useEffect, useMemo, useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Stethoscope, Loader2, CheckCircle2, Clock, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useGetCurrentUser } from "@workspace/api-client-react";
import { useAuth } from "@workspace/replit-auth-web";
import { Link } from "wouter";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

interface DoctorApplication {
  id: number;
  name: string;
  specialty: string;
  registrationNumber: string;
  experienceYears: number;
  location: string;
  languages: string[];
  bio: string | null;
  consultationFee: string;
  status: "pending" | "approved" | "rejected";
  reviewerNotes: string | null;
  decidedAt: string | null;
  createdAt: string;
}

export default function DoctorApply() {
  const { isLoaded: clerkLoaded, isSignedIn } = useAuth();
  const { data: user, isLoading: userQueryLoading } = useGetCurrentUser({
    query: { enabled: clerkLoaded === true && isSignedIn === true, queryKey: ["doctorApplyCurrentUser"] },
  });
  const userLoading = !clerkLoaded || (isSignedIn && userQueryLoading);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [existing, setExisting] = useState<DoctorApplication | null>(null);
  const [form, setForm] = useState({
    name: "",
    specialty: "",
    registrationNumber: "",
    experienceYears: "0",
    location: "",
    languages: "en",
    bio: "",
    consultationFee: "0",
  });

  // Pre-fill the name field from the current user's display name.
  useEffect(() => {
    if (user) {
      setForm((f) => ({
        ...f,
        name: f.name || user.displayName || "",
      }));
    }
  }, [user]);

  // Fetch existing application status.
  useEffect(() => {
    if (userLoading) return;
    if (!isSignedIn || !user) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/doctor-applications/me`, { credentials: "include" });
        if (!res.ok) throw new Error("Failed to load");
        const data = await res.json();
        if (cancelled) return;
        if (data.application) {
          setExisting(data.application);
          // pre-fill form with existing values so they can edit pending app.
          if (data.application.status === "pending") {
            setForm({
              name: data.application.name,
              specialty: data.application.specialty,
              registrationNumber: data.application.registrationNumber,
              experienceYears: String(data.application.experienceYears),
              location: data.application.location ?? "",
              languages: (data.application.languages ?? ["en"]).join(", "),
              bio: data.application.bio ?? "",
              consultationFee: String(data.application.consultationFee ?? 0),
            });
          }
        }
      } catch {
        // ignore — fresh form
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user, userLoading, isSignedIn]);

  const alreadyPro = (user?.role as string) === "medical_professional" || user?.role === "admin";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.specialty.trim() || !form.registrationNumber.trim()) {
      toast.error("Name, specialty and registration number are required");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        name: form.name.trim(),
        specialty: form.specialty.trim(),
        registrationNumber: form.registrationNumber.trim(),
        experienceYears: Number(form.experienceYears) || 0,
        location: form.location.trim(),
        languages: form.languages.split(",").map((s) => s.trim()).filter(Boolean),
        bio: form.bio.trim() || undefined,
        consultationFee: Number(form.consultationFee) || 0,
      };
      const res = await fetch(`${API_BASE}/doctor-applications`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to submit");
      setExisting(data.application);
      toast.success(existing ? "Application updated — waiting for admin review" : "Application submitted — an admin will review it soon");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  }

  const statusUI = useMemo(() => {
    if (!existing) return null;
    if (existing.status === "pending") {
      return (
        <div className="flex items-start gap-3 rounded-lg bg-amber-50 border border-amber-200 p-4">
          <Clock className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
          <div>
            <div className="font-semibold text-amber-900">Awaiting admin review</div>
            <div className="text-sm text-amber-800 mt-0.5">
              Submitted {new Date(existing.createdAt).toLocaleString()}. You can edit and resubmit your application below — it will replace the current pending application.
            </div>
          </div>
        </div>
      );
    }
    if (existing.status === "approved") {
      return (
        <div className="flex items-start gap-3 rounded-lg bg-green-50 border border-green-200 p-4">
          <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
          <div>
            <div className="font-semibold text-green-900">Approved</div>
            <div className="text-sm text-green-800 mt-0.5">
              Your account has been promoted to verified medical professional. You can now appear in the doctors directory and accept tele-consultations.
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="flex items-start gap-3 rounded-lg bg-red-50 border border-red-200 p-4">
        <XCircle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
        <div>
          <div className="font-semibold text-red-900">Application rejected</div>
          {existing.reviewerNotes && (
            <div className="text-sm text-red-800 mt-0.5">Reviewer notes: <span className="italic">{existing.reviewerNotes}</span></div>
          )}
          <div className="text-sm text-red-800 mt-1">You may submit a new application with corrected information below.</div>
        </div>
      </div>
    );
  }, [existing]);

  if (userLoading || loading) {
    return (
      <Layout>
        <div className="max-w-3xl mx-auto p-6 flex items-center justify-center min-h-[40vh]">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      </Layout>
    );
  }

  if (!isSignedIn || !user) {
    return (
      <Layout>
        <div className="max-w-md mx-auto p-6 mt-12 text-center space-y-4">
          <Stethoscope className="w-10 h-10 text-primary mx-auto" />
          <h1 className="text-2xl font-bold">Onboard as a Doctor on HealthCircle</h1>
          <p className="text-slate-600">Sign in to apply for verified medical professional access.</p>
          <Link href="/sign-in"><Button>Sign in</Button></Link>
        </div>
      </Layout>
    );
  }

  if (alreadyPro && (!existing || existing.status === "approved")) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto p-6 mt-8 text-center space-y-4">
          <CheckCircle2 className="w-10 h-10 text-green-600 mx-auto" />
          <h1 className="text-2xl font-bold">You're already a verified medical professional</h1>
          <p className="text-slate-600">Manage your profile and consultations from the medical pro area.</p>
          <Link href="/medpro"><Button>Open Medical Pro Dashboard</Button></Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Stethoscope className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-bold">Onboard as a Doctor on HealthCircle</h1>
          </div>
          <p className="text-slate-600">
            Submit your medical credentials. An administrator will verify your registration and notify you once approved.
          </p>
        </div>

        {statusUI}

        <Card>
          <CardHeader>
            <CardTitle>Application details</CardTitle>
            <CardDescription>All fields marked with * are required.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="name">Full name *</Label>
                  <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required disabled={existing?.status === "approved"} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="specialty">Specialty *</Label>
                  <Input id="specialty" placeholder="e.g. Cardiology" value={form.specialty} onChange={(e) => setForm({ ...form, specialty: e.target.value })} required disabled={existing?.status === "approved"} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="reg">Medical registration number *</Label>
                  <Input id="reg" placeholder="MCI / NMC reg no." value={form.registrationNumber} onChange={(e) => setForm({ ...form, registrationNumber: e.target.value })} required disabled={existing?.status === "approved"} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="exp">Years of experience</Label>
                  <Input id="exp" type="number" min={0} max={80} value={form.experienceYears} onChange={(e) => setForm({ ...form, experienceYears: e.target.value })} disabled={existing?.status === "approved"} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="location">Location</Label>
                  <Input id="location" placeholder="City, State" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} disabled={existing?.status === "approved"} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="languages">Languages (comma-separated)</Label>
                  <Input id="languages" placeholder="en, hi" value={form.languages} onChange={(e) => setForm({ ...form, languages: e.target.value })} disabled={existing?.status === "approved"} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="fee">Consultation fee (₹)</Label>
                  <Input id="fee" type="number" min={0} value={form.consultationFee} onChange={(e) => setForm({ ...form, consultationFee: e.target.value })} disabled={existing?.status === "approved"} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bio">About you</Label>
                <Textarea id="bio" rows={4} placeholder="Brief professional bio shown to patients" value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} disabled={existing?.status === "approved"} />
              </div>

              {existing?.status !== "approved" && (
                <div className="flex items-center justify-between pt-2">
                  <Badge variant="secondary" className="text-xs">Verified by admin before going live</Badge>
                  <Button type="submit" disabled={submitting}>
                    {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    {existing?.status === "pending" ? "Update application" : "Submit application"}
                  </Button>
                </div>
              )}
            </form>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
