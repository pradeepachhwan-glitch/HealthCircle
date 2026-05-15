import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Clock, 
  Calendar, 
  Plus, 
  Trash2, 
  Save, 
  Loader2, 
  AlertCircle,
  CheckCircle2,
  ChevronRight
} from "lucide-react";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

interface AvailabilitySlot {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  slotDuration: number;
}

export function HospitalAvailability() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // 1. Get current doctor profile
  const { data: doctor, isLoading: isLoadingDoctor } = useQuery({
    queryKey: ["/api/scheduler/me"],
    queryFn: () => fetch("/api/scheduler/me").then(res => res.json()),
  });

  // 2. Get existing availability
  const { data: existingSlots = [], isLoading: isLoadingSlots } = useQuery<AvailabilitySlot[]>({
    queryKey: ["/api/scheduler/availability", doctor?.id],
    queryFn: () => fetch(`/api/scheduler/availability/${doctor?.id}`).then(res => res.json()),
    enabled: !!doctor?.id,
  });

  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);

  useEffect(() => {
    if (existingSlots.length > 0) {
      setSlots(existingSlots);
    }
  }, [existingSlots]);

  const updateMutation = useMutation({
    mutationFn: (data: { doctorId: number; slots: AvailabilitySlot[] }) => 
      fetch("/api/scheduler/availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scheduler/availability"] });
      toast({ title: "Schedule Updated", description: "Your availability has been saved and is now live for patients." });
    }
  });

  const addSlot = () => {
    setSlots([...slots, { dayOfWeek: 1, startTime: "09:00", endTime: "17:00", slotDuration: 30 }]);
  };

  const removeSlot = (index: number) => {
    setSlots(slots.filter((_, i) => i !== index));
  };

  const updateSlot = (index: number, updates: Partial<AvailabilitySlot>) => {
    setSlots(slots.map((s, i) => i === index ? { ...s, ...updates } : s));
  };

  if (isLoadingDoctor || isLoadingSlots) return <div className="p-12 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /></div>;

  if (!doctor) return (
    <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 shadow-sm">
      <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
      <h2 className="text-xl font-bold text-slate-900">Doctor Profile Required</h2>
      <p className="text-slate-500 max-w-md mx-auto mt-2">To manage a clinical schedule, you must first be registered as a doctor in your hospital's care team.</p>
      <Button className="mt-6 font-bold" variant="outline">Contact Hospital Admin</Button>
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
            <Calendar className="w-7 h-7 text-primary" /> Clinical Scheduler
          </h2>
          <p className="text-sm text-slate-500 font-medium mt-1">Configure your working hours for teleconsultations.</p>
        </div>
        <div className="flex items-center gap-2">
           <Badge className="bg-emerald-50 text-emerald-700 border-emerald-100 gap-1.5 py-1 px-3">
             <CheckCircle2 className="w-3.5 h-3.5" /> Schedule Active
           </Badge>
        </div>
      </div>

      <Card className="border-none shadow-sm ring-1 ring-slate-200 overflow-hidden bg-white/80 backdrop-blur-sm">
        <CardHeader className="border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Weekly Working Hours</CardTitle>
              <CardDescription>Patients can only book appointments within these windows.</CardDescription>
            </div>
            <Button onClick={addSlot} variant="outline" className="h-9 gap-2 font-bold border-slate-200 text-xs">
              <Plus className="w-4 h-4" /> Add Time Window
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-slate-50">
            {slots.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <Clock className="w-12 h-12 mx-auto mb-4 opacity-10" />
                <p className="text-sm font-medium">No hours configured yet. Click "Add Time Window" to start.</p>
              </div>
            ) : (
              slots.sort((a,b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime)).map((slot, index) => (
                <div key={index} className="p-4 md:p-6 flex flex-col md:flex-row md:items-center gap-4 hover:bg-slate-50/30 transition-colors">
                  <div className="w-full md:w-48">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">Day of Week</label>
                    <Select 
                      value={slot.dayOfWeek.toString()} 
                      onValueChange={(val) => updateSlot(index, { dayOfWeek: parseInt(val) })}
                    >
                      <SelectTrigger className="h-10 border-slate-200 bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white">
                        {DAYS.map((day, i) => (
                          <SelectItem key={i} value={i.toString()}>{day}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex-1 grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">Start Time</label>
                      <Input 
                        type="time" 
                        value={slot.startTime} 
                        onChange={e => updateSlot(index, { startTime: e.target.value })}
                        className="h-10 border-slate-200"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">End Time</label>
                      <Input 
                        type="time" 
                        value={slot.endTime} 
                        onChange={e => updateSlot(index, { endTime: e.target.value })}
                        className="h-10 border-slate-200"
                      />
                    </div>
                    <div className="space-y-1 col-span-2 md:col-span-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">Slot Duration (Min)</label>
                      <Select 
                        value={slot.slotDuration.toString()} 
                        onValueChange={(val) => updateSlot(index, { slotDuration: parseInt(val) })}
                      >
                        <SelectTrigger className="h-10 border-slate-200 bg-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-white">
                          <SelectItem value="15">15 Minutes</SelectItem>
                          <SelectItem value="20">20 Minutes</SelectItem>
                          <SelectItem value="30">30 Minutes</SelectItem>
                          <SelectItem value="45">45 Minutes</SelectItem>
                          <SelectItem value="60">1 Hour</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex items-end pb-0.5">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => removeSlot(index)}
                      className="h-10 w-10 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
        <div className="p-6 border-t border-slate-100 bg-white flex justify-between items-center">
           <div className="flex items-center gap-2 text-slate-400 text-xs font-medium">
             <AlertCircle className="w-4 h-4" />
             <span>Changes are applied immediately after saving.</span>
           </div>
           <Button 
             onClick={() => updateMutation.mutate({ doctorId: doctor.id, slots })}
             disabled={updateMutation.isPending}
             className="gap-2 font-bold px-8 shadow-lg shadow-primary/20"
           >
             {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
             Save Weekly Schedule
           </Button>
        </div>
      </Card>

      <div className="bg-primary/5 rounded-3xl p-6 border border-primary/10 flex flex-col md:flex-row items-center gap-6">
         <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-sm shrink-0">
           <Calendar className="w-8 h-8 text-primary" />
         </div>
         <div className="flex-1 text-center md:text-left">
           <h3 className="font-black text-slate-900 uppercase tracking-tight">Need Leave or Time Off?</h3>
           <p className="text-sm text-slate-600 font-medium mt-1">You can override specific dates for holidays or personal leave in the advanced settings.</p>
         </div>
         <Button variant="outline" className="h-11 px-6 font-bold border-primary/20 text-primary bg-white hover:bg-primary/5 rounded-2xl">
           Manage Specific Dates <ChevronRight className="w-4 h-4 ml-2" />
         </Button>
      </div>
    </div>
  );
}

function Badge({ children, className, variant = "default" }: { children: React.ReactNode; className?: string; variant?: string }) {
  return (
    <div className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2", className)}>
      {children}
    </div>
  );
}
