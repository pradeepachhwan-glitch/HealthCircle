import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Calendar, Video, ChevronRight, Clock, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function UpcomingAppointments() {
  const { data: appointments = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/appointments"],
    queryFn: () => fetch("/api/appointments").then(res => res.json()),
  });

  const upcoming = appointments.filter(a => a.status === "booked" && new Date(a.appointmentTime) > new Date());

  if (isLoading) return <div className="h-20 flex items-center justify-center bg-slate-50 rounded-2xl border border-slate-100"><Loader2 className="w-5 h-5 animate-spin text-primary/30" /></div>;

  if (upcoming.length === 0) return null;

  return (
    <div className="space-y-3 mb-8">
      <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] px-1">Upcoming consultations</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {upcoming.map((app) => (
          <div key={app.id} className="bg-white rounded-2xl border border-primary/20 shadow-sm p-4 flex items-center justify-between group hover:border-primary transition-all">
             <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary/5 flex items-center justify-center shrink-0">
                   <Calendar className="w-6 h-6 text-primary" />
                </div>
                <div>
                   <h3 className="font-bold text-slate-900 text-sm">Consultation with {app.doctor?.name || "Doctor"}</h3>
                   <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
                         <Clock className="w-3.5 h-3.5 text-slate-300" />
                         {app.appointmentTime ? format(new Date(app.appointmentTime), "MMM d, h:mm a") : "Time not set"}
                      </span>
                      <Badge className="bg-emerald-50 text-emerald-700 border-emerald-100 text-[10px] uppercase font-bold px-1.5 h-4">
                        Confirmed
                      </Badge>
                   </div>
                </div>
             </div>
             <Link href={`/teleconsult/session/${app.id}`}>
                <Button size="sm" className="h-9 px-4 gap-2 font-bold shadow-lg shadow-primary/10">
                   Join Room <Video className="w-3.5 h-3.5" />
                </Button>
             </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
