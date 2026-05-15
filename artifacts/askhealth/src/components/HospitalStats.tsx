import { useQuery } from "@tanstack/react-query";
import { Users, Calendar, Activity, TrendingUp, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function HospitalStats() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["/api/hospital/stats"],
    queryFn: async () => {
      const res = await fetch("/api/hospital/stats");
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-24 w-full rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <StatCard
        label="Total Appointments"
        value={stats?.totalAppointments ?? 0}
        icon={<Calendar className="w-4 h-4" />}
        trend={stats?.trends.appointments === "up" ? "up" : "down"}
        trendValue="+12%"
      />
      <StatCard
        label="Active Doctors"
        value={stats?.activeDoctors ?? 0}
        icon={<Users className="w-4 h-4" />}
      />
      <StatCard
        label="Completion Rate"
        value={`${stats?.completionRate ?? 0}%`}
        icon={<Activity className="w-4 h-4" />}
        trend="up"
        trendValue="+0.4%"
      />
      <StatCard
        label="Total Revenue"
        value={stats?.revenue ?? "₹0"}
        icon={<TrendingUp className="w-4 h-4" />}
        trend="up"
        trendValue="+8.2%"
      />
    </div>
  );
}

function StatCard({ label, value, icon, trend, trendValue }: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: "up" | "down";
  trendValue?: string;
}) {
  return (
    <Card className="border-slate-200 shadow-sm overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="w-8 h-8 rounded-lg bg-slate-50 text-slate-500 flex items-center justify-center">
            {icon}
          </div>
          {trend && (
            <div className={`flex items-center text-[10px] font-bold ${trend === "up" ? "text-emerald-600" : "text-rose-600"}`}>
              {trend === "up" ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              {trendValue}
            </div>
          )}
        </div>
        <div className="text-2xl font-bold text-slate-900">{value}</div>
        <div className="text-xs text-slate-500 font-medium uppercase tracking-wider">{label}</div>
      </CardContent>
    </Card>
  );
}
