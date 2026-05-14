import { useQuery } from "@tanstack/react-query";
import { Stethoscope, Star, MapPin, ChevronRight, Search, Filter } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

export function HospitalDoctors() {
  const { data: doctorsData, isLoading } = useQuery({
    queryKey: ["hospital-doctors"],
    queryFn: async () => {
      const res = await fetch("/api/tc/doctors");
      if (!res.ok) throw new Error("Failed to fetch doctors");
      return res.json();
    },
  });

  const doctors = doctorsData?.doctors ?? [];

  return (
    <Card className="border-slate-200">
      <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-lg">Organization Doctors</CardTitle>
          <CardDescription>Manage and view performance of your care team</CardDescription>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="h-8 gap-1.5">
            <Filter className="w-3.5 h-3.5" /> Filter
          </Button>
          <Button size="sm" className="h-8">Add Doctor</Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input 
            placeholder="Search by name or specialty..." 
            className="pl-9 h-9 border-slate-200 bg-slate-50/50"
          />
        </div>

        <div className="space-y-3">
          {isLoading ? (
            [1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 w-full rounded-xl" />
            ))
          ) : doctors.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-3">
                <Stethoscope className="w-6 h-6 text-slate-300" />
              </div>
              <p className="text-sm text-slate-500">No doctors registered yet.</p>
            </div>
          ) : (
            doctors.map((doctor: any) => (
              <div 
                key={doctor.id} 
                className="flex items-center gap-4 p-3 rounded-xl border border-slate-100 hover:border-primary/20 hover:bg-slate-50/50 transition-all cursor-pointer group"
              >
                <div className="w-12 h-12 rounded-full bg-slate-100 overflow-hidden shrink-0 border border-slate-200">
                  {doctor.imageUrl ? (
                    <img src={doctor.imageUrl} alt={doctor.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-400">
                      <Stethoscope className="w-6 h-6" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-slate-900 truncate">{doctor.name}</h4>
                    <div className="flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                      <Star className="w-2.5 h-2.5 fill-amber-600" />
                      {doctor.rating}
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 font-medium">{doctor.specialty}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex items-center gap-1 text-[10px] text-slate-400">
                      <MapPin className="w-2.5 h-2.5" />
                      {doctor.location}
                    </div>
                    <Badge variant="outline" className="text-[10px] h-4 px-1.5 bg-emerald-50 text-emerald-700 border-emerald-100">
                      Available
                    </Badge>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-primary transition-colors" />
              </div>
            ))
          )}
        </div>
        
        {doctors.length > 0 && (
          <Button variant="ghost" size="sm" className="w-full mt-4 text-xs font-semibold text-primary hover:bg-primary/5">
            View All Staff
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
