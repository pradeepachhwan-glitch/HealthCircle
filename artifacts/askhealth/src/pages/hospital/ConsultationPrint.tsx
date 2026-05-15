import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Loader2, Printer, Building2, User, Calendar, Stethoscope, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useEffect } from "react";

export default function ConsultationPrint() {
  const params = useParams();
  const id = params.id;

  const { data: consult, isLoading, error } = useQuery({
    queryKey: [`/api/hospital/consultations/${id}/pdf-data`],
    queryFn: () => fetch(`/api/hospital/consultations/${id}/pdf-data`).then(res => {
      if (!res.ok) throw new Error("Failed to fetch data");
      return res.json();
    }),
  });

  useEffect(() => {
    if (consult) {
      // Auto-trigger print dialog after data is loaded and rendered
      // We'll give it a tiny delay for images to settle
      const timer = setTimeout(() => {
        // window.print();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [consult]);

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center space-y-4">
        <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
        <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Generating Professional Note...</p>
      </div>
    </div>
  );

  if (error || !consult) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center p-8 bg-white rounded-3xl shadow-xl max-w-sm">
        <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
          <Stethoscope className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Document Not Found</h2>
        <p className="text-sm text-slate-500 mt-2">The requested clinical note could not be retrieved or is not yet approved.</p>
        <Button className="mt-6 w-full" variant="outline" onClick={() => window.close()}>Close Window</Button>
      </div>
    </div>
  );

  const { consultation, patient, hospital, settings } = consult;

  return (
    <div className="min-h-screen bg-slate-100 py-12 px-4 print:bg-white print:py-0 print:px-0">
      {/* Action Bar (Hidden when printing) */}
      <div className="max-w-[800px] mx-auto mb-6 flex justify-between items-center print:hidden">
        <div className="flex items-center gap-2 text-slate-500 text-sm font-medium">
          <Building2 className="w-4 h-4" />
          <span>Hospital Workspace</span>
          <ChevronRight className="w-4 h-4" />
          <span className="text-slate-900 font-bold">Clinical Note Preview</span>
        </div>
        <Button onClick={() => window.print()} className="gap-2 font-bold shadow-lg shadow-primary/20">
          <Printer className="w-4 h-4" /> Print / Save as PDF
        </Button>
      </div>

      {/* Professional Letterhead Template */}
      <div className="max-w-[800px] mx-auto bg-white shadow-2xl min-h-[1050px] p-12 print:shadow-none print:p-8 flex flex-col font-serif">
        
        {/* Header */}
        <div className="flex justify-between items-start border-b-2 border-slate-900 pb-8 mb-10">
          <div className="flex gap-6 items-start">
            <div className="w-24 h-24 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center overflow-hidden shrink-0">
              {settings?.logoUrl ? (
                <img src={settings.logoUrl} alt={hospital.name} className="w-full h-full object-contain" />
              ) : (
                <Building2 className="w-12 h-12 text-slate-200" />
              )}
            </div>
            <div className="space-y-1">
              <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-none uppercase">{hospital.name}</h1>
              <p className="text-sm font-bold text-primary tracking-widest uppercase">Clinical Consultation Record</p>
              <div className="flex flex-col gap-0.5 pt-2 text-xs text-slate-500 font-sans font-medium">
                <span className="flex items-center gap-1.5"><Calendar className="w-3 h-3" /> Date: {new Date(consultation.approvedAt).toLocaleDateString()}</span>
                <span className="flex items-center gap-1.5"><Stethoscope className="w-3 h-3" /> Ref: HC-OPS-{consultation.id}</span>
              </div>
            </div>
          </div>
          <div className="text-right space-y-1 max-w-[250px] font-sans">
             <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Facility Address</div>
             <p className="text-[11px] text-slate-600 font-semibold leading-relaxed whitespace-pre-wrap">
               {settings?.letterheadConfig?.headerText || hospital.location}
             </p>
          </div>
        </div>

        {/* Patient & Consultation Summary Row */}
        <div className="grid grid-cols-2 gap-8 mb-10 bg-slate-50/50 p-6 rounded-2xl border border-slate-100 font-sans">
          <div className="space-y-3">
             <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Patient Details</p>
                <div className="flex items-center gap-3">
                   <div className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center">
                     <User className="w-5 h-5 text-slate-300" />
                   </div>
                   <div>
                     <p className="text-sm font-bold text-slate-900">{patient.displayName}</p>
                     <p className="text-[10px] text-slate-500 font-medium">{patient.email}</p>
                   </div>
                </div>
             </div>
          </div>
          <div className="space-y-3">
             <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Consultation Intent</p>
                <p className="text-sm font-bold text-slate-700 leading-snug">
                  {consultation.intakeSummary || "General Clinical Review"}
                </p>
                <Badge className="mt-2 bg-slate-900 text-white border-none text-[9px] px-2 py-0 h-4 font-bold uppercase tracking-widest">
                  {consultation.status}
                </Badge>
             </div>
          </div>
        </div>

        {/* Clinical Note Content (SOAP) */}
        <div className="flex-1 space-y-10">
          <div className="space-y-8">
            {["Subjective", "Objective", "Assessment", "Plan"].map((section) => (
              <div key={section} className="space-y-3">
                <div className="flex items-center gap-4">
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-[0.2em]">{section}</h3>
                  <div className="flex-1 h-px bg-slate-100" />
                </div>
                <div className="pl-4 border-l-4 border-slate-100 py-1">
                  <p className="text-sm text-slate-700 leading-relaxed text-justify whitespace-pre-wrap">
                    {consultation.soapDraft?.[section.toLowerCase()] || "Clinical evaluation not documented for this section."}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Transcript Snippet or Additional Notes */}
          {consultation.transcript && (
             <div className="mt-12 p-8 bg-slate-50 rounded-3xl border border-slate-100 italic font-sans text-xs text-slate-500 leading-relaxed">
                <p className="font-bold text-slate-400 uppercase tracking-widest mb-3 not-italic">Clinical Discussion Highlights</p>
                "{consultation.transcript.substring(0, 500)}..."
             </div>
          )}
        </div>

        {/* Signature Area */}
        <div className="mt-16 pt-12 border-t-2 border-slate-900 flex justify-between items-end font-sans">
          <div className="max-w-xs">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Disclaimer</p>
            <p className="text-[9px] text-slate-400 leading-relaxed italic">
              {settings?.letterheadConfig?.footerText || "This document is a digitally generated clinical record. It is intended for official medical and insurance purposes. Please consult your primary physician for long-term care management."}
            </p>
          </div>
          <div className="text-center w-64 space-y-2">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Authorized Signature</p>
            <div className="py-4 px-6 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
               <p className="font-serif italic text-2xl text-slate-800 underline decoration-slate-300 mb-1">
                 {consultation.signatureBlockUsed?.split('-')[0] || "Attending Physician"}
               </p>
               <p className="text-[10px] font-bold text-primary uppercase tracking-widest">
                 {consultation.signatureBlockUsed?.split('-')[1] || "HealthCircle Certified"}
               </p>
            </div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-2">
              Signed on {new Date(consultation.approvedAt).toLocaleString()}
            </p>
          </div>
        </div>

        {/* Watermark/Footer */}
        <div className="mt-12 flex justify-center opacity-10">
           <div className="flex items-center gap-2 grayscale">
              <Building2 className="w-4 h-4" />
              <span className="text-[10px] font-black uppercase tracking-[0.4em]">HealthCircle Operations</span>
           </div>
        </div>

      </div>
    </div>
  );
}
