import { useQuery } from "@tanstack/react-query";
import { Stethoscope, Star, MapPin, ChevronRight, Search, Filter } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

export function HospitalDoctors() {
  const { data: team = [], isLoading } = useQuery({
    queryKey: ["/api/hospital/care-team"],
    queryFn: async () => {
      const res = await fetch("/api/hospital/care-team");
      if (!res.ok) throw new Error("Failed to fetch care team");
      return res.json();
    },
  });

  return (
    <Card className="border-slate-200">
      <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-lg">Care Team</CardTitle>
          <CardDescription>Manage and view your clinical staff</CardDescription>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="h-8 gap-1.5 border-slate-200 font-bold text-xs">
            <Filter className="w-3.5 h-3.5" /> Filter
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {isLoading ? (
            [1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full rounded-xl" />
            ))
          ) : team.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-3">
                <Stethoscope className="w-6 h-6 text-slate-300" />
              </div>
              <p className="text-sm text-slate-500 font-medium">No staff registered yet.</p>
            </div>
          ) : (
            team.slice(0, 5).map((member: any) => (
              <div 
                key={member.id} 
                className="flex items-center gap-4 p-3 rounded-xl border border-slate-100 hover:border-primary/20 hover:bg-slate-50/50 transition-all group"
              >
                <div className="w-10 h-10 rounded-full bg-slate-100 overflow-hidden shrink-0 border border-slate-200">
                  {member.user.avatarUrl ? (
                    <img src={member.user.avatarUrl} alt={member.user.displayName} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs font-bold uppercase">
                      {member.user.displayName[0]}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-slate-900 truncate">{member.user.displayName}</h4>
                    <Badge variant="outline" className="text-[9px] h-4 px-1.5 uppercase font-bold text-slate-400">
                      {member.role}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium">{member.specialty || "General Staff"}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-primary transition-colors" />
              </div>
            ))
          )}
        </div>
        
        {team.length > 0 && (
          <Button variant="ghost" size="sm" className="w-full mt-4 text-xs font-bold text-primary hover:bg-primary/5">
            View All {team.length} Staff Members
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
