import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  CheckCircle2, 
  Clock, 
  ExternalLink, 
  FileText, 
  MessageSquare, 
  MoreVertical, 
  Search, 
  Video,
  User,
  Sparkles,
  Printer,
  ChevronRight,
  Calendar,
  Stethoscope
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

// Types (should ideally come from @workspace/api-client-react)
interface Consultation {
  id: number;
  status: "requested" | "scheduled" | "in_progress" | "completed" | "cancelled";
  scheduledAt?: string;
  patientName?: string; 
  patientAvatar?: string;
  chiefComplaint?: string;
  googleMeetUrl?: string;
  soapDraft?: {
    subjective?: string;
    objective?: string;
    assessment?: string;
    plan?: string;
  };
  isApproved: boolean;
  signatureBlockUsed?: string;
}

export function ClinicalInbox() {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch consultations
  const { data: consultations = [], isLoading } = useQuery<Consultation[]>({
    queryKey: ["/api/hospital/consultations"],
    queryFn: () => fetch("/api/hospital/consultations").then(res => res.json()),
  });

  const selectedConsult = consultations.find(c => c.id === selectedId);

  // Mutations
  const scribeMutation = useMutation({
    mutationFn: (id: number) => fetch(`/api/hospital/consultations/${id}/scribe`, { method: "POST" }).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hospital/consultations"] });
      toast({ title: "SOAP Draft Generated", description: "AI has processed the consultation notes." });
    }
  });

  const approveMutation = useMutation({
    mutationFn: (id: number) => fetch(`/api/hospital/consultations/${id}/approve`, { method: "PATCH" }).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hospital/consultations"] });
      toast({ title: "Consultation Approved", description: "Clinical note is now finalized." });
    }
  });

  const handlePrint = async (id: number) => {
    toast({ title: "Preparing Document", description: "Fetching professional clinical note template..." });
    // In a real app, this might open a new window with a print-specific route
    // For this PWA, we'll implement a hidden print template.
    window.open(`/hospital/consultations/${id}/print`, '_blank');
  };

  if (isLoading) return <div className="p-8 text-center text-slate-500">Loading inbox...</div>;

  return (
    <div className="flex h-[calc(100vh-220px)] bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
      {/* Left Pane: Consultation List (WhatsApp-style) */}
      <div className="w-80 border-r border-slate-100 flex flex-col bg-slate-50/20">
        <div className="p-4 border-b border-slate-100 bg-white">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              placeholder="Search patients..." 
              className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border-none rounded-xl text-xs font-medium focus:ring-2 focus:ring-primary/20 outline-none transition-all"
            />
          </div>
        </div>
        
        <ScrollArea className="flex-1">
          <div className="divide-y divide-slate-50">
            {consultations.length === 0 && (
              <div className="p-12 text-center">
                <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-3">
                  <Clock className="w-5 h-5 text-slate-300" />
                </div>
                <p className="text-xs text-slate-400 font-medium italic">No active consultations</p>
              </div>
            )}
            {consultations.map((consult) => (
              <button
                key={consult.id}
                onClick={() => setSelectedId(consult.id)}
                className={cn(
                  "w-full p-4 flex gap-3 text-left transition-all duration-200",
                  selectedId === consult.id ? "bg-white shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)] z-10 border-l-4 border-primary" : "opacity-70 hover:opacity-100 hover:bg-white"
                )}
              >
                <Avatar className="w-11 h-11 border-2 border-white shadow-sm shrink-0">
                  {consult.patientAvatar ? (
                    <img src={consult.patientAvatar} alt={consult.patientName} className="object-cover" />
                  ) : (
                    <AvatarFallback className="bg-slate-100 text-slate-600 font-bold text-sm">
                      {consult.patientName?.[0] || "P"}
                    </AvatarFallback>
                  )}
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="font-bold text-slate-900 text-[13px] truncate">{consult.patientName || `Patient #${consult.id}`}</span>
                    <span className="text-[9px] font-bold text-slate-400 uppercase">
                      {consult.scheduledAt ? new Date(consult.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "New"}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 truncate mb-2 font-medium">
                    {consult.chiefComplaint || "General Consultation"}
                  </p>
                  <div className="flex items-center justify-between">
                    <StatusBadge status={consult.status} />
                    {consult.isApproved && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Right Pane: Workspace */}
      <div className="flex-1 flex flex-col bg-white">
        {selectedConsult ? (
          <>
            {/* Header */}
            <div className="p-4 px-6 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-20">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <Avatar className="w-11 h-11 border border-slate-100 shadow-sm">
                    {selectedConsult.patientAvatar ? (
                      <img src={selectedConsult.patientAvatar} alt={selectedConsult.patientName} className="object-cover" />
                    ) : (
                      <AvatarFallback className="bg-primary/5 text-primary font-bold">
                        {selectedConsult.patientName?.[0] || "P"}
                      </AvatarFallback>
                    )}
                  </Avatar>
                  <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-bold text-slate-900 leading-none">{selectedConsult.patientName || `Patient #${selectedConsult.id}`}</h2>
                    <Badge variant="outline" className="text-[9px] h-4 font-bold uppercase tracking-wider text-slate-400 border-slate-200">HC-OPS-{selectedConsult.id}</Badge>
                  </div>
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase">
                      <Clock className="w-3 h-3" /> Booked {new Date(selectedConsult.createdAt!).toLocaleTimeString()}
                    </span>
                    <span className="w-1 h-1 bg-slate-200 rounded-full" />
                    <span className="flex items-center gap-1 text-[10px] font-bold text-primary uppercase">
                      <Video className="w-3 h-3" /> Priority Consultation
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="h-9 gap-2 text-xs font-bold border-slate-200 px-4 rounded-xl">
                  <FileText className="w-4 h-4" /> Continuity Log
                </Button>
                <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-400 rounded-full hover:bg-slate-50">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Content */}
            <ScrollArea className="flex-1 bg-slate-50/20 p-6">
              <div className="max-w-2xl mx-auto space-y-6">
                
                {/* 1. Appointment Card */}
                <Card className="p-6 border-none shadow-sm ring-1 ring-slate-100 overflow-hidden relative">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 blur-3xl" />
                  <div className="flex items-start justify-between relative">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-primary" /> Appointment Details
                      </h3>
                      <div className="space-y-3">
                        <div className="flex items-center gap-6">
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Scheduled Time</p>
                            <p className="text-sm font-semibold text-slate-700">
                              {selectedConsult.scheduledAt ? new Date(selectedConsult.scheduledAt).toLocaleString() : "TBD"}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status</p>
                            <div className="mt-0.5"><StatusBadge status={selectedConsult.status} /></div>
                          </div>
                        </div>
                      </div>
                    </div>
                    {selectedConsult.googleMeetUrl ? (
                      <Button 
                        onClick={() => window.open(selectedConsult.googleMeetUrl, '_blank')}
                        className="bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-200 gap-2"
                      >
                        <Video className="w-4 h-4" /> Join Meet
                      </Button>
                    ) : (
                      <Button variant="outline" className="border-dashed border-slate-300 text-slate-500 gap-2">
                        <Calendar className="w-4 h-4" /> Generate Meet Link
                      </Button>
                    )}
                  </div>
                </Card>

                {/* 2. Clinical Documentation Section */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Stethoscope className="w-4 h-4 text-primary" /> Clinical Note (SOAP)
                    </h3>
                    {!selectedConsult.soapDraft && (
                      <Button 
                        size="sm" 
                        variant="secondary"
                        onClick={() => scribeMutation.mutate(selectedConsult.id)}
                        disabled={scribeMutation.isPending}
                        className="h-8 gap-2 text-xs font-bold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-indigo-200"
                      >
                        <Sparkles className="w-3.5 h-3.5" /> 
                        {scribeMutation.isPending ? "Scribing..." : "Generate AI SOAP Draft"}
                      </Button>
                    )}
                  </div>

                  {selectedConsult.soapDraft ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {["Subjective", "Objective", "Assessment", "Plan"].map((section) => (
                        <div key={section} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">{section}</p>
                          <p className="text-sm text-slate-600 leading-relaxed">
                            {(selectedConsult.soapDraft as any)[section.toLowerCase()] || "No notes added."}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 p-8 text-center">
                      <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center shadow-sm mx-auto mb-3">
                        <FileText className="w-5 h-5 text-slate-300" />
                      </div>
                      <p className="text-sm text-slate-500 font-medium">Wait for consultation to end or use AI Scribe to generate notes.</p>
                    </div>
                  )}
                </div>

                {/* 3. Approval & Signature */}
                {selectedConsult.soapDraft && (
                  <Card className="p-6 border-none shadow-md ring-1 ring-slate-100 bg-white">
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">Final Review</h3>
                        <p className="text-xs text-slate-500 mt-1">Review clinical details before stamping your electronic signature block.</p>
                      </div>
                      {selectedConsult.isApproved ? (
                        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-1.5 py-1 px-3">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Approved
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50/50 py-1 px-3">
                          Pending Approval
                        </Badge>
                      )}
                    </div>

                    {selectedConsult.isApproved && selectedConsult.signatureBlockUsed && (
                      <div className="mb-6 p-4 bg-slate-50 rounded-xl border border-slate-100 text-center">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Electronic Signature Block</p>
                        <p className="font-serif italic text-lg text-slate-800 underline decoration-slate-300">
                          {selectedConsult.signatureBlockUsed.split('-')[0]}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">{selectedConsult.signatureBlockUsed.split('-')[1]}</p>
                      </div>
                    )}

                    <div className="flex gap-3">
                      {!selectedConsult.isApproved ? (
                        <Button 
                          onClick={() => approveMutation.mutate(selectedConsult.id)}
                          disabled={approveMutation.isPending}
                          className="flex-1 h-12 font-bold shadow-lg shadow-primary/20"
                        >
                          {approveMutation.isPending ? "Approving..." : "Approve & Sign Clinical Note"}
                        </Button>
                      ) : (
                        <Button 
                          variant="outline" 
                          className="flex-1 h-12 font-bold border-slate-200 gap-2"
                          onClick={() => handlePrint(selectedConsult.id)}
                        >
                          <Printer className="w-4 h-4" /> Download/Print Note
                        </Button>
                      )}
                    </div>
                  </Card>
                )}

              </div>
            </ScrollArea>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-50/20">
            <div className="w-20 h-20 rounded-full bg-white flex items-center justify-center shadow-md mb-6 relative">
              <MessageSquare className="w-8 h-8 text-primary/40" />
              <div className="absolute top-0 right-0 w-6 h-6 bg-primary rounded-full border-4 border-white animate-pulse" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Clinical Operations Inbox</h2>
            <p className="text-sm text-slate-500 max-w-xs mt-2 font-medium">
              Select a patient from the list to manage consultations, scribe notes, and generate clinical documents.
            </p>
            <div className="mt-8 grid grid-cols-2 gap-3 w-full max-w-sm">
              <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm text-left">
                <Video className="w-4 h-4 text-emerald-500 mb-2" />
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Meet Links</p>
                <p className="text-xs font-semibold text-slate-700 mt-0.5">Automated Generation</p>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm text-left">
                <Sparkles className="w-4 h-4 text-indigo-500 mb-2" />
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">AI Scribe</p>
                <p className="text-xs font-semibold text-slate-700 mt-0.5">SOAP Documentation</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: Consultation["status"] }) {
  const styles = {
    requested: "bg-blue-50 text-blue-700 border-blue-100",
    scheduled: "bg-amber-50 text-amber-700 border-amber-100",
    in_progress: "bg-emerald-50 text-emerald-700 border-emerald-100 animate-pulse",
    completed: "bg-slate-50 text-slate-600 border-slate-100",
    cancelled: "bg-red-50 text-red-700 border-red-100",
  };
  
  return (
    <Badge variant="outline" className={cn("text-[9px] font-bold uppercase py-0 px-1.5 h-4", styles[status])}>
      {status.replace("_", " ")}
    </Badge>
  );
}
