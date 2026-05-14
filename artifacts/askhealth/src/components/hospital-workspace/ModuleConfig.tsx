import React from "react";
import { 
  LayoutDashboard, 
  Video, 
  Calendar, 
  Users, 
  ListOrdered, 
  Stethoscope, 
  FileText, 
  Building2, 
  Megaphone, 
  BarChart3, 
  Bell, 
  ShieldCheck, 
  IndianRupee, 
  History, 
  BrainCircuit,
  Lock,
  ExternalLink,
  MessageSquare
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type ModuleStatus = "LIVE" | "PARTIAL" | "COMING SOON";

export interface HospitalModule {
  id: string;
  title: string;
  icon: React.ReactNode;
  status: ModuleStatus;
  description: string;
}

export const HOSPITAL_MODULES: HospitalModule[] = [
  {
    id: "clinical-inbox",
    title: "Clinical Inbox",
    icon: <MessageSquare className="w-4 h-4" />,
    status: "LIVE",
    description: "WhatsApp-style clinical operations and messaging."
  },
  {
    id: "dashboard",
    title: "Command Center",
    icon: <LayoutDashboard className="w-4 h-4" />,
    status: "LIVE",
    description: "Operational overview of hospital metrics and activities."
  },
  {
    id: "teleconsult",
    title: "Teleconsultation",
    icon: <Video className="w-4 h-4" />,
    status: "LIVE",
    description: "Manage video consultations and live doctor queues."
  },
  {
    id: "google",
    title: "Google Integration",
    icon: <Calendar className="w-4 h-4" />,
    status: "LIVE",
    description: "Sync with Google Calendar and automate Meet links."
  },
  {
    id: "care-team",
    title: "Care Team",
    icon: <Users className="w-4 h-4" />,
    status: "LIVE",
    description: "Onboard and manage doctors and medical staff."
  },
  {
    id: "queue",
    title: "Patient Queue",
    icon: <ListOrdered className="w-4 h-4" />,
    status: "LIVE",
    description: "Real-time monitoring of waiting and active patients."
  },
  {
    id: "intake",
    title: "AI Triage",
    icon: <BrainCircuit className="w-4 h-4" />,
    status: "COMING SOON",
    description: "Automated patient intake and severity assessment."
  },
  {
    id: "clinical",
    title: "SOAP Notes",
    icon: <FileText className="w-4 h-4" />,
    status: "PARTIAL",
    description: "Clinical documentation and prescription management."
  },
  {
    id: "branding",
    title: "Hospital Profile",
    icon: <Building2 className="w-4 h-4" />,
    status: "LIVE",
    description: "Manage hospital branding and public information."
  },
  {
    id: "outreach",
    title: "Community Outreach",
    icon: <Megaphone className="w-4 h-4" />,
    status: "PARTIAL",
    description: "Connect with patients via community programs."
  },
  {
    id: "analytics",
    title: "Analytics",
    icon: <BarChart3 className="w-4 h-4" />,
    status: "PARTIAL",
    description: "In-depth operational and financial reporting."
  },
  {
    id: "notifications",
    title: "Communication",
    icon: <Bell className="w-4 h-4" />,
    status: "PARTIAL",
    description: "Manage automated SMS, Email and Push alerts."
  },
  {
    id: "access",
    title: "Organization Controls",
    icon: <ShieldCheck className="w-4 h-4" />,
    status: "COMING SOON",
    description: "Advanced RBAC and department-level permissions."
  },
  {
    id: "revenue",
    title: "Revenue & Billing",
    icon: <IndianRupee className="w-4 h-4" />,
    status: "PARTIAL",
    description: "Billing overview and payout reconciliation."
  },
  {
    id: "follow-up",
    title: "Follow-Up System",
    icon: <History className="w-4 h-4" />,
    status: "LIVE",
    description: "Track patient continuity and post-consultation care."
  },
  {
    id: "ai-ops",
    title: "AI Operations",
    icon: <Lock className="w-4 h-4" />,
    status: "COMING SOON",
    description: "Predictive operational intelligence for clinics."
  }
];

export function StatusBadge({ status }: { status: ModuleStatus }) {
  switch (status) {
    case "LIVE":
      return (
        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[9px] font-bold uppercase py-0 px-1.5 h-4">
          Live
        </Badge>
      );
    case "PARTIAL":
      return (
        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[9px] font-bold uppercase py-0 px-1.5 h-4">
          Partial
        </Badge>
      );
    case "COMING SOON":
      return (
        <Badge variant="outline" className="bg-slate-50 text-slate-500 border-slate-200 text-[9px] font-bold uppercase py-0 px-1.5 h-4">
          Soon
        </Badge>
      );
    default:
      return null;
  }
}
