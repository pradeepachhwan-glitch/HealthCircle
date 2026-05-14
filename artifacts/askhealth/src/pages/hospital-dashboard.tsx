import { useState } from "react";
import { Link } from "wouter";
import { Building2, Share2, Plus, LayoutDashboard, Search } from "lucide-react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { useAuth } from "@workspace/replit-auth-web";
import { HospitalStats } from "@/components/HospitalStats";
import { HospitalDoctors } from "@/components/HospitalDoctors";
import { HospitalAppointments } from "@/components/HospitalAppointments";
import { HospitalProfile } from "@/components/HospitalProfile";
import { HospitalGoogleConnection } from "@/components/HospitalGoogleConnection";
import { HospitalSidebar } from "@/components/hospital-workspace/HospitalSidebar";
import { ClinicalInbox } from "@/components/hospital-workspace/ClinicalInbox";
import { HospitalCareTeamProfile } from "@/components/hospital-workspace/HospitalCareTeamProfile";
import { HospitalCareTeamList } from "@/components/hospital-workspace/HospitalCareTeamList";
import { ModulePlaceholder } from "@/components/hospital-workspace/ModulePlaceholder";
import { HOSPITAL_MODULES } from "@/components/hospital-workspace/ModuleConfig";
import { Input } from "@/components/ui/input";

export default function HospitalDashboard() {
  const { user } = useAuth();
  const [activeModule, setActiveModule] = useState("clinical-inbox");

  const renderModuleContent = () => {
    switch (activeModule) {
      case "clinical-inbox":
        return <ClinicalInbox />;
      case "dashboard":
        return (
          <div className="space-y-6">
            <HospitalStats />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <HospitalAppointments />
              <div className="space-y-6">
                <HospitalGoogleConnection />
                <HospitalProfile />
              </div>
            </div>
          </div>
        );
      case "teleconsult":
        return <HospitalAppointments />;
      case "care-team":
        return <HospitalCareTeamList />;
      case "google":
        return <HospitalGoogleConnection />;
      case "branding":
        return <HospitalProfile />;
      case "queue":
        return <HospitalAppointments />; // Shared logic for now
      case "follow-up":
        return <HospitalAppointments />; // Shared logic for now
      default:
        const module = HOSPITAL_MODULES.find(m => m.id === activeModule);
        return (
          <ModulePlaceholder 
            title={module?.title || "Module"} 
            description={module?.description || ""} 
            isPartial={module?.status === "PARTIAL"}
          />
        );
    }
  };

  return (
    <Layout>
      <div className="min-h-screen bg-slate-50/50 pb-20">
        {/* Top Header */}
        <div className="bg-white border-b border-slate-200 sticky top-0 z-30 px-4 py-3">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 flex-1">
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold uppercase tracking-wider border border-slate-200 shrink-0">
                <Building2 className="w-3.5 h-3.5" />
                {user?.displayName || "Hospital Workspace"}
              </div>
              <div className="relative max-w-md w-full hidden sm:block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input 
                  placeholder="Search patients, doctors, or records..." 
                  className="pl-10 h-9 bg-slate-50 border-slate-200 text-xs font-medium"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" className="h-9 gap-2 text-xs font-bold border-slate-200 hidden sm:flex">
                <Share2 className="w-4 h-4" /> Share
              </Button>
              <Button className="h-9 gap-2 text-xs font-bold shadow-lg shadow-primary/20">
                <Plus className="w-4 h-4" /> New Booking
              </Button>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex flex-col lg:flex-row gap-8">
            {/* Sidebar Navigation */}
            <aside className="shrink-0">
              <HospitalSidebar 
                activeModule={activeModule} 
                onModuleChange={setActiveModule} 
              />
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 min-w-0">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                    {HOSPITAL_MODULES.find(m => m.id === activeModule)?.title}
                  </h1>
                  <p className="text-sm text-slate-500 font-medium mt-1">
                    {HOSPITAL_MODULES.find(m => m.id === activeModule)?.description}
                  </p>
                </div>
              </div>

              {renderModuleContent()}
            </main>
          </div>
        </div>
      </div>
    </Layout>
  );
}
