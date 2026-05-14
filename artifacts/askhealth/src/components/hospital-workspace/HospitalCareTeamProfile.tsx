import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { 
  User, 
  Award, 
  FileSignature, 
  ShieldCheck, 
  Save, 
  Loader2,
  AlertCircle,
  FileText
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface Profile {
  id: number;
  specialty?: string;
  credentials?: string;
  registrationNumber?: string;
  signatureUrl?: string;
}

export function HospitalCareTeamProfile() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: profile, isLoading } = useQuery<Profile | null>({
    queryKey: ["/api/hospital/profile/me"],
    queryFn: () => fetch("/api/hospital/profile/me").then(res => res.json()),
  });

  const { register, handleSubmit, formState: { isDirty } } = useForm<Partial<Profile>>({
    values: profile || {},
  });

  const mutation = useMutation({
    mutationFn: (data: Partial<Profile>) => 
      fetch("/api/hospital/profile/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hospital/profile/me"] });
      toast({ title: "Profile Updated", description: "Your clinical credentials have been saved." });
    },
    onError: () => {
      toast({ variant: "destructive", title: "Error", description: "Failed to update profile." });
    }
  });

  if (isLoading) return <div className="p-8 text-center text-slate-500">Loading profile...</div>;

  if (!profile) {
    return (
      <Alert variant="destructive" className="max-w-2xl mx-auto">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Profile Not Found</AlertTitle>
        <AlertDescription>
          You are not currently linked to a hospital care team. Please contact your hospital administrator to be added as a provider.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-4 mb-2">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
          <User className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Clinical Profile</h2>
          <p className="text-sm text-slate-500 font-medium">Manage your professional credentials and signature for consultation notes.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="space-y-6">
        <Card className="p-8 border-none shadow-sm ring-1 ring-slate-200 bg-white/80 backdrop-blur-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <Award className="w-3 h-3" /> Medical Specialty
                </Label>
                <Input 
                  {...register("specialty")}
                  placeholder="e.g. General Physician, Cardiologist" 
                  className="bg-slate-50 border-slate-200 focus:bg-white transition-all h-11"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <ShieldCheck className="w-3 h-3" /> Registration Number
                </Label>
                <Input 
                  {...register("registrationNumber")}
                  placeholder="e.g. KMC-12345" 
                  className="bg-slate-50 border-slate-200 focus:bg-white transition-all h-11"
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <FileText className="w-3 h-3" /> Professional Credentials
                </Label>
                <Input 
                  {...register("credentials")}
                  placeholder="e.g. MBBS, MD (Internal Medicine)" 
                  className="bg-slate-50 border-slate-200 focus:bg-white transition-all h-11"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <FileSignature className="w-3 h-3" /> Electronic Signature Text
                </Label>
                <Input 
                  {...register("signatureUrl")}
                  placeholder="e.g. Dr. Pradeep Achhwan" 
                  className="bg-slate-50 border-slate-200 focus:bg-white transition-all h-11"
                />
                <p className="text-[10px] text-slate-400 font-medium">
                  This text will be used in the "Doctor Signature" block on clinical notes.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-10 pt-8 border-t border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-amber-600 font-bold bg-amber-50 px-3 py-1.5 rounded-full border border-amber-100">
              <AlertCircle className="w-3.5 h-3.5" />
              Required for Clinical Note Approval
            </div>
            <Button 
              type="submit" 
              disabled={mutation.isPending || !isDirty}
              className="gap-2 px-8 h-12 font-bold shadow-lg shadow-primary/20"
            >
              {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Credentials
            </Button>
          </div>
        </Card>
      </form>
      
      <div className="bg-indigo-50/50 p-6 rounded-3xl border border-indigo-100 flex gap-4 items-start">
        <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-indigo-500 shadow-sm shrink-0">
          <ShieldCheck className="w-5 h-5" />
        </div>
        <div>
          <h4 className="text-sm font-bold text-indigo-900">Medical Data Privacy</h4>
          <p className="text-xs text-indigo-700/70 leading-relaxed mt-1 font-medium">
            Your credentials and signature are stored securely within the Hospital Workspace. They are only used to generate "Doctor-Approved" clinical notes that you explicitly finalize.
          </p>
        </div>
      </div>
    </div>
  );
}
