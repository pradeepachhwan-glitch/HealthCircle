import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2, Mail, Phone, Globe, MapPin, Edit3, Save, Loader2 } from "lucide-react";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

export function HospitalProfile() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);

  const { data: user, isLoading } = useQuery({
    queryKey: ["user-me"],
    queryFn: async () => {
      const res = await fetch("/api/users/me");
      if (!res.ok) throw new Error("Failed to fetch user");
      return res.json();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: any) => {
      const res = await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error("Update failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-me"] });
      setIsEditing(false);
      toast({ title: "Profile Updated", description: "Your hospital information has been saved." });
    },
  });

  const [formData, setFormData] = useState({
    displayName: "",
    email: "",
    mobileNumber: "",
    location: ""
  });

  const handleEdit = () => {
    setFormData({
      displayName: user?.displayName || "",
      email: user?.email || "",
      mobileNumber: user?.mobileNumber || "",
      location: user?.location || ""
    });
    setIsEditing(true);
  };

  if (isLoading) {
    return (
      <Card className="border-slate-200">
        <CardContent className="p-8 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-slate-200 overflow-hidden">
      <div className="h-20 bg-slate-900 relative">
        <div className="absolute -bottom-10 left-6">
          <div className="w-20 h-20 rounded-2xl bg-white border-4 border-white shadow-md flex items-center justify-center overflow-hidden">
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt={user.displayName} className="w-full h-full object-cover" />
            ) : (
              <Building2 className="w-10 h-10 text-slate-300" />
            )}
          </div>
        </div>
      </div>
      <CardHeader className="pt-12 pb-4">
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-xl font-bold">{user?.displayName}</CardTitle>
              <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-[10px] font-bold uppercase px-1.5 py-0">Hospital</Badge>
            </div>
            <CardDescription className="flex items-center gap-1 mt-0.5">
              <MapPin className="w-3.5 h-3.5" /> {user?.location || "Location not set"}
            </CardDescription>
          </div>
          {!isEditing ? (
            <Button variant="outline" size="sm" onClick={handleEdit} className="h-8 gap-1.5 font-bold text-xs">
              <Edit3 className="w-3.5 h-3.5" /> Edit Profile
            </Button>
          ) : (
            <Button 
              size="sm" 
              onClick={() => updateMutation.mutate(formData)} 
              disabled={updateMutation.isPending}
              className="h-8 gap-1.5 font-bold text-xs"
            >
              {updateMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Save Changes
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isEditing ? (
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Hospital Name</label>
              <Input 
                value={formData.displayName} 
                onChange={e => setFormData({...formData, displayName: e.target.value})}
                className="h-9 border-slate-200"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Location</label>
              <Input 
                value={formData.location} 
                onChange={e => setFormData({...formData, location: e.target.value})}
                className="h-9 border-slate-200"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Mobile Number</label>
              <Input 
                value={formData.mobileNumber} 
                onChange={e => setFormData({...formData, mobileNumber: e.target.value})}
                className="h-9 border-slate-200"
              />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Official Email</div>
                  <div className="font-medium text-slate-700">{user?.email}</div>
                </div>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400">
                  <Phone className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Contact Number</div>
                  <div className="font-medium text-slate-700">{user?.mobileNumber || "Not added"}</div>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400">
                  <Globe className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Website</div>
                  <div className="font-medium text-slate-700">healthcircle.ai/{user?.username || user?.clerkId}</div>
                </div>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Verification</div>
                  <div className="flex items-center gap-1.5 font-medium text-emerald-600">
                    Verified Partner
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
