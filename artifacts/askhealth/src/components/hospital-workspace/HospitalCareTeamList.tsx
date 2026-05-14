import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Users, 
  UserPlus, 
  Trash2, 
  Mail, 
  Shield, 
  Search,
  MoreVertical,
  Loader2,
  AlertCircle,
  Plus,
  Stethoscope,
  Building2,
  CheckCircle2
} from "lucide-react";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface TeamMember {
  id: number;
  role: "doctor" | "nurse" | "admin" | "front_desk";
  specialty?: string;
  credentials?: string;
  isPrimary: boolean;
  user: {
    id: number;
    displayName: string;
    email: string;
    avatarUrl?: string;
  };
}

export function HospitalCareTeamList() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [newMemberRole, setNewMemberRole] = useState("doctor");

  const { data: team = [], isLoading } = useQuery<TeamMember[]>({
    queryKey: ["/api/hospital/care-team"],
    queryFn: () => fetch("/api/hospital/care-team").then(res => res.json()),
  });

  const addMutation = useMutation({
    mutationFn: (data: { email: string; role: string }) => 
      fetch("/api/hospital/care-team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then(async res => {
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Failed to add member");
        }
        return res.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hospital/care-team"] });
      setIsAddOpen(false);
      toast({ title: "Member Added", description: "The new team member has been successfully added." });
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Add Failed", description: err.message });
    }
  });

  const removeMutation = useMutation({
    mutationFn: (id: number) => fetch(`/api/hospital/care-team/${id}`, { method: "DELETE" }).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hospital/care-team"] });
      toast({ title: "Member Removed", description: "Team member has been removed from the hospital workspace." });
    }
  });

  const filteredTeam = team.filter(m => 
    m.user.displayName.toLowerCase().includes(search.toLowerCase()) || 
    m.user.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header & Stats */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
            <Users className="w-7 h-7 text-primary" /> Care Team Management
          </h2>
          <p className="text-sm text-slate-500 font-medium mt-1">Manage doctors, nurses, and administrative staff for your clinical operations.</p>
        </div>
        <Button onClick={() => setIsAddOpen(true)} className="gap-2 h-11 px-6 font-bold shadow-lg shadow-primary/20">
          <UserPlus className="w-4 h-4" /> Add Team Member
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard title="Total Staff" value={team.length} icon={<Users className="w-4 h-4" />} color="blue" />
        <StatCard title="Doctors" value={team.filter(m => m.role === 'doctor').length} icon={<Stethoscope className="w-4 h-4" />} color="emerald" />
        <StatCard title="Support Staff" value={team.filter(m => m.role !== 'doctor').length} icon={<Building2 className="w-4 h-4" />} color="indigo" />
      </div>

      {/* Main List Area */}
      <Card className="border-none shadow-sm ring-1 ring-slate-200 overflow-hidden bg-white/80 backdrop-blur-sm">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between gap-4">
          <div className="relative max-w-sm w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              placeholder="Search by name or email..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10 bg-white border-slate-200 h-10 text-sm font-medium"
            />
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="h-6 text-[10px] font-bold uppercase text-slate-400">
              {filteredTeam.length} Members Found
            </Badge>
          </div>
        </div>

        <ScrollArea className="h-[calc(100vh-450px)]">
          <div className="divide-y divide-slate-50">
            {isLoading ? (
              <div className="p-12 text-center text-slate-400 flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-primary/30" />
                <p className="text-sm font-medium">Loading your care team...</p>
              </div>
            ) : filteredTeam.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <Users className="w-12 h-12 mx-auto mb-4 opacity-10" />
                <p className="text-sm font-medium">No team members found.</p>
              </div>
            ) : (
              filteredTeam.map((member) => (
                <div key={member.id} className="p-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors group">
                  <div className="flex items-center gap-4">
                    <Avatar className="w-11 h-11 border-2 border-white shadow-sm ring-1 ring-slate-100">
                      <AvatarImage src={member.user.avatarUrl} />
                      <AvatarFallback className="bg-slate-100 text-slate-600 font-bold">
                        {member.user.displayName[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-slate-900">{member.user.displayName}</h4>
                        <RoleBadge role={member.role} />
                        {member.isPrimary && (
                          <Badge className="bg-primary/5 text-primary border-primary/20 text-[9px] font-bold uppercase py-0 px-1.5 h-4">Primary</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-0.5">
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                          <Mail className="w-3.5 h-3.5 text-slate-400" />
                          {member.user.email}
                        </div>
                        {member.specialty && (
                          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                            <Stethoscope className="w-3.5 h-3.5 text-slate-400" />
                            {member.specialty}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-400 hover:text-slate-900">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => {
                        if (confirm(`Are you sure you want to remove ${member.user.displayName}?`)) {
                          removeMutation.mutate(member.id);
                        }
                      }}
                      className="h-9 w-9 text-slate-400 hover:text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </Card>

      {/* Add Member Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-primary" /> Add Staff Member
            </DialogTitle>
            <DialogDescription className="font-medium text-slate-500">
              Invite an existing HealthCircle user to join your hospital's clinical care team.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">User Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input 
                  value={newMemberEmail}
                  onChange={e => setNewMemberEmail(e.target.value)}
                  placeholder="doctor@example.com" 
                  className="pl-10 h-11 border-slate-200"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Clinical Role</label>
              <Select value={newMemberRole} onValueChange={setNewMemberRole}>
                <SelectTrigger className="h-11 border-slate-200">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="doctor">Medical Doctor</SelectItem>
                  <SelectItem value="nurse">Clinical Nurse</SelectItem>
                  <SelectItem value="admin">Operations Admin</SelectItem>
                  <SelectItem value="front_desk">Reception / Front Desk</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="bg-amber-50 p-3 rounded-xl border border-amber-100 flex gap-3">
              <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
              <p className="text-[11px] text-amber-700 font-medium leading-relaxed">
                Staff members must have a registered HealthCircle account with the specified email before you can add them.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddOpen(false)} className="h-11 font-bold border-slate-200">Cancel</Button>
            <Button 
              onClick={() => {
                addMutation.mutate({ email: newMemberEmail, role: newMemberRole });
              }}
              disabled={addMutation.isPending}
              className="h-11 px-8 font-bold shadow-lg shadow-primary/20"
            >
              {addMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
              Add to Team
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({ title, value, icon, color }: { title: string; value: number; icon: React.ReactNode; color: 'blue' | 'emerald' | 'indigo' }) {
  const colors = {
    blue: "bg-blue-50 text-blue-600 border-blue-100",
    emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
    indigo: "bg-indigo-50 text-indigo-600 border-indigo-100",
  };
  
  return (
    <Card className={cn("p-4 border-none shadow-sm ring-1 ring-slate-100 flex items-center justify-between", colors[color])}>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider opacity-60">{title}</p>
        <p className="text-2xl font-black mt-1">{value}</p>
      </div>
      <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm">
        {icon}
      </div>
    </Card>
  );
}

function RoleBadge({ role }: { role: TeamMember["role"] }) {
  const styles = {
    doctor: "bg-emerald-50 text-emerald-700 border-emerald-200",
    nurse: "bg-blue-50 text-blue-700 border-blue-100",
    admin: "bg-indigo-50 text-indigo-700 border-indigo-100",
    front_desk: "bg-slate-50 text-slate-600 border-slate-200",
  };
  
  return (
    <Badge variant="outline" className={cn("text-[10px] font-bold uppercase py-0 px-2 h-5", styles[role])}>
      {role.replace("_", " ")}
    </Badge>
  );
}
