import { useQuery } from "@tanstack/react-query";
import { Calendar, Clock, Video, MessageSquare, ChevronRight, ExternalLink, User } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

export function HospitalAppointments() {
  const { data: consultationsData, isLoading } = useQuery({
    queryKey: ["hospital-consultations"],
    queryFn: async () => {
      const res = await fetch("/api/tc/consultations");
      if (!res.ok) throw new Error("Failed to fetch consultations");
      return res.json();
    },
  });

  const consultations = consultationsData?.consultations ?? [];

  return (
    <Card className="border-slate-200">
      <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-lg">Appointments</CardTitle>
          <CardDescription>Live teleconsultations and bookings</CardDescription>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="h-8">History</Button>
          <Button size="sm" className="h-8">Schedule New</Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {isLoading ? (
            [1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 w-full rounded-xl" />
            ))
          ) : consultations.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-slate-100 rounded-2xl">
              <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-3">
                <Calendar className="w-6 h-6 text-slate-300" />
              </div>
              <p className="text-sm text-slate-500 font-medium">No active appointments.</p>
              <Button variant="link" className="mt-1 text-xs">Book first patient session</Button>
            </div>
          ) : (
            consultations.map((consult: any) => (
              <div 
                key={consult.id} 
                className="group relative p-4 rounded-2xl border border-slate-100 bg-white hover:border-primary/20 hover:shadow-md hover:shadow-primary/5 transition-all"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100">
                      <User className="w-5 h-5 text-slate-400" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">Patient ID: #{consult.userId}</h4>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge className={`text-[10px] h-4 px-1.5 uppercase tracking-wider font-bold ${
                          consult.status === "completed" ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-50 border-emerald-100" :
                          consult.status === "booked" ? "bg-blue-50 text-blue-700 hover:bg-blue-50 border-blue-100" :
                          "bg-amber-50 text-amber-700 hover:bg-amber-50 border-amber-100"
                        }`} variant="outline">
                          {consult.status}
                        </Badge>
                        <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1 uppercase">
                          {consult.type === "video" ? <Video className="w-2.5 h-2.5" /> : <MessageSquare className="w-2.5 h-2.5" />}
                          {consult.type}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-bold text-slate-900">
                      {consult.scheduledAt ? format(new Date(consult.scheduledAt), "MMM d, h:mm a") : "Not scheduled"}
                    </div>
                    <div className="text-[10px] text-slate-400 font-medium mt-0.5">₹{consult.consultationFee} consultation</div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {consult.googleMeetUrl && (
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="h-8 flex-1 gap-1.5 text-blue-600 border-blue-100 bg-blue-50/50 hover:bg-blue-50 hover:border-blue-200 text-xs font-bold"
                      onClick={() => window.open(consult.googleMeetUrl, "_blank")}
                    >
                      <Video className="w-3.5 h-3.5" /> Join Meet
                    </Button>
                  )}
                  <Button 
                    size="sm" 
                    className="h-8 flex-1 gap-1.5 text-xs font-bold"
                  >
                    Manage Details <ChevronRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
