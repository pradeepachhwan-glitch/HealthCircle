import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Calendar, CheckCircle2, Link as LinkIcon, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

export function HospitalGoogleConnection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isConnecting, setIsConnecting] = useState(false);

  const { data: status, isLoading } = useQuery({
    queryKey: ["google-connection-status"],
    queryFn: async () => {
      const res = await fetch("/api/auth/google/connection-status");
      if (!res.ok) throw new Error("Failed to fetch connection status");
      return res.json();
    },
  });

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      const res = await fetch("/api/auth/google/auth-url");
      if (!res.ok) throw new Error("Failed to get auth URL");
      const { url } = await res.json();
      window.location.href = url;
    } catch (err) {
      toast({
        title: "Connection Error",
        description: "Could not initiate Google connection. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsConnecting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card className="border-slate-200">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Calendar className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-lg">Google Calendar & Meet</CardTitle>
              <CardDescription>Connect to automate teleconsultation scheduling</CardDescription>
            </div>
          </div>
          {status?.connected ? (
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-1 px-2 py-1">
              <CheckCircle2 className="w-3 h-3" /> Connected
            </Badge>
          ) : (
            <Badge variant="outline" className="bg-slate-50 text-slate-500 border-slate-200 gap-1 px-2 py-1">
              Not Connected
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {status?.connected ? (
          <div className="space-y-4">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-500">
                  {status.email?.charAt(0).toUpperCase() || "G"}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-slate-900 truncate">{status.email}</div>
                  <div className="text-xs text-slate-500 italic">Auto-generates Meet links for appointments</div>
                </div>
              </div>
              <Button variant="ghost" size="sm" className="text-slate-500 hover:text-slate-900" onClick={handleConnect}>
                Reconnect
              </Button>
            </div>
            <p className="text-xs text-slate-500">
              When you book a teleconsultation, HealthCircle will automatically create a Google Calendar event and a Google Meet link for both the patient and the doctor.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-100/50">
              <div className="flex gap-3">
                <AlertCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-blue-900">Why connect Google?</p>
                  <p className="text-xs text-blue-700 leading-relaxed">
                    Connecting your organization's Google account allows us to sync appointments to your team's calendar and instantly generate Google Meet links for live consultations.
                  </p>
                </div>
              </div>
            </div>
            <Button 
              className="w-full gap-2 bg-[#4285F4] hover:bg-[#357AE8] text-white" 
              onClick={handleConnect}
              disabled={isConnecting}
            >
              {isConnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <LinkIcon className="w-4 h-4" />}
              Connect Hospital Google Account
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
