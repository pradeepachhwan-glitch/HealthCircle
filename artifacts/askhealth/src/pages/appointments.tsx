import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { Layout } from "@/components/Layout";
import { Calendar, Clock, MapPin, Stethoscope, Building2, CheckCircle, XCircle, AlertCircle } from "lucide-react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

interface Appointment {
  id: number;
  appointmentTime: string;
  status: "booked" | "completed" | "cancelled";
  notes?: string;
  createdAt: string;
  doctor?: { id: number; name: string; specialty: string; imageUrl?: string } | null;
  hospital?: { id: number; name: string; location: string } | null;
}

const STATUS_CONFIG = {
  booked: { label: "Booked", color: "bg-blue-50 text-blue-700 border-blue-200", icon: Clock },
  completed: { label: "Completed", color: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: CheckCircle },
  cancelled: { label: "Cancelled", color: "bg-red-50 text-red-700 border-red-200", icon: XCircle },
};

function AppointmentCard({ appointment }: { appointment: Appointment }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const status = STATUS_CONFIG[appointment.status];
  const StatusIcon = status.icon;

  const cancel = useMutation({
    mutationFn: () =>
      fetch(`${API_BASE}/appointments/${appointment.id}/cancel`, { method: "PATCH", credentials: "include" }).then(r => r.json()),
    onSuccess: () => {
      toast({ title: "Appointment Cancelled" });
      qc.invalidateQueries({ queryKey: ["appointments"] });
    },
    onError: () => toast({ title: "Error", description: "Failed to cancel.", variant: "destructive" }),
  });

  const apptDate = new Date(appointment.appointmentTime);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-sm transition-all">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            {appointment.doctor ? <Stethoscope className="w-5 h-5 text-primary" /> : <Building2 className="w-5 h-5 text-slate-600" />}
          </div>
          <div>
            <p className="font-semibold text-slate-900">
              {appointment.doctor?.name ?? appointment.hospital?.name ?? "Provider"}
            </p>
            <p className="text-xs text-slate-500">
              {appointment.doctor?.specialty ?? appointment.hospital?.location}
            </p>
          </div>
        </div>
        <Badge variant="outline" className={`${status.color} flex items-center gap-1.5 text-xs`}>
          <StatusIcon className="w-3 h-3" />
          {status.label}
        </Badge>
      </div>

      <div className="flex flex-wrap gap-4 text-sm text-slate-600 mb-3">
        <span className="flex items-center gap-1.5">
          <Calendar className="w-4 h-4 text-slate-400" />
          {apptDate.toLocaleDateString("en-IN", { weekday: "short", year: "numeric", month: "short", day: "numeric" })}
        </span>
        <span className="flex items-center gap-1.5">
          <Clock className="w-4 h-4 text-slate-400" />
          {apptDate.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
        </span>
        {appointment.hospital?.location && (
          <span className="flex items-center gap-1.5">
            <MapPin className="w-4 h-4 text-slate-400" />
            {appointment.hospital.location}
          </span>
        )}
      </div>

      {appointment.notes && (
        <p className="text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2 mb-3 italic">"{appointment.notes}"</p>
      )}

      {appointment.status === "booked" && (
        <div className="flex justify-end">
          <Button
            size="sm"
            variant="outline"
            className="text-red-600 border-red-200 hover:bg-red-50 text-xs"
            onClick={() => cancel.mutate()}
            disabled={cancel.isPending}
          >
            <XCircle className="w-3.5 h-3.5 mr-1" />
            {cancel.isPending ? "Cancelling..." : "Cancel Appointment"}
          </Button>
        </div>
      )}
    </div>
  );
}

export default function AppointmentsPage() {
  const { data: appointments = [], isLoading, isError, refetch } = useQuery<Appointment[]>({
    queryKey: ["appointments"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/appointments`, { credentials: "include" });
      if (!res.ok) throw new Error(`Failed to load appointments (${res.status})`);
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    retry: 1,
  });

  const upcoming = appointments.filter(a => a.status === "booked" && new Date(a.appointmentTime) >= new Date());
  const past = appointments.filter(a => a.status !== "booked" || new Date(a.appointmentTime) < new Date());

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">My Appointments</h1>
            <p className="text-sm text-slate-500 mt-0.5">{appointments.length} total appointment{appointments.length !== 1 ? "s" : ""}</p>
          </div>
          <Link href="/providers">
            <Button size="sm" className="bg-primary hover:bg-primary/90 text-xs">
              <Calendar className="w-3.5 h-3.5 mr-1" /> Book New
            </Button>
          </Link>
        </div>

        <div className="space-y-6">
          {isLoading && <div className="text-center py-12 text-slate-400">Loading appointments...</div>}

          {!isLoading && isError && (
            <div className="text-center py-16">
              <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-300" />
              <h3 className="font-semibold text-red-600 mb-2">Couldn't load your appointments</h3>
              <p className="text-slate-500 text-sm mb-6">Please check your connection and try again.</p>
              <Button onClick={() => refetch()} variant="outline">Retry</Button>
            </div>
          )}

          {!isLoading && !isError && appointments.length === 0 && (
            <div className="text-center py-16">
              <Calendar className="w-12 h-12 mx-auto mb-4 text-slate-300" />
              <h3 className="font-semibold text-slate-700 mb-2">No appointments yet</h3>
              <p className="text-slate-400 text-sm mb-6">Book your first appointment with a doctor</p>
              <Link href="/providers">
                <Button className="bg-primary hover:bg-primary/90">Find a Doctor</Button>
              </Link>
            </div>
          )}

          {upcoming.length > 0 && (
            <div>
              <h2 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-blue-500" /> Upcoming ({upcoming.length})
              </h2>
              <div className="space-y-3">
                {upcoming.map(a => <AppointmentCard key={a.id} appointment={a} />)}
              </div>
            </div>
          )}

          {past.length > 0 && (
            <div>
              <h2 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-slate-400" /> Past ({past.length})
              </h2>
              <div className="space-y-3">
                {past.map(a => <AppointmentCard key={a.id} appointment={a} />)}
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
