import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Building2, 
  Image as ImageIcon, 
  Settings2, 
  FileText, 
  Mail, 
  Phone, 
  Globe, 
  Save, 
  Loader2, 
  UploadCloud,
  Layout,
  Type
} from "lucide-react";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function HospitalSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: config, isLoading } = useQuery({
    queryKey: ["/api/hospital/settings"],
    queryFn: () => fetch("/api/hospital/settings").then(res => res.json()),
  });

  const updateSettings = useMutation({
    mutationFn: (updates: any) => fetch("/api/hospital/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    }).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hospital/settings"] });
      toast({ title: "Settings Saved", description: "Branding and workspace preferences updated." });
    }
  });

  const [formData, setFormData] = useState({
    logoUrl: "",
    signatureBlockTemplate: "",
    letterheadConfig: {
      headerText: "",
      footerText: "",
      accentColor: "#0F172A"
    }
  });

  useEffect(() => {
    if (config?.settings) {
      setFormData({
        logoUrl: config.settings.logoUrl || "",
        signatureBlockTemplate: config.settings.signatureBlockTemplate || "",
        letterheadConfig: config.settings.letterheadConfig || {
          headerText: "",
          footerText: "",
          accentColor: "#0F172A"
        }
      });
    }
  }, [config]);

  if (isLoading) return <div className="p-12 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /></div>;

  return (
    <div className="space-y-6">
      <Tabs defaultValue="branding" className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-slate-100 p-1 rounded-2xl h-12">
          <TabsTrigger value="branding" className="rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm gap-2 text-xs font-bold">
            <Layout className="w-4 h-4" /> Branding
          </TabsTrigger>
          <TabsTrigger value="documents" className="rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm gap-2 text-xs font-bold">
            <FileText className="w-4 h-4" /> Letterhead
          </TabsTrigger>
          <TabsTrigger value="workspace" className="rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm gap-2 text-xs font-bold">
            <Settings2 className="w-4 h-4" /> Workspace
          </TabsTrigger>
        </TabsList>

        <div className="mt-6">
          <TabsContent value="branding">
            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle className="text-lg font-bold">Identity & Logos</CardTitle>
                <CardDescription>Manage how your hospital appears to patients and in clinical notes.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex flex-col md:flex-row gap-8">
                  <div className="space-y-4 flex-1">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Hospital Logo URL</label>
                      <div className="flex gap-2">
                        <Input 
                          placeholder="https://..." 
                          value={formData.logoUrl}
                          onChange={e => setFormData({...formData, logoUrl: e.target.value})}
                          className="h-10 border-slate-200"
                        />
                        <Button variant="outline" className="h-10 px-3 border-slate-200">
                          <UploadCloud className="w-4 h-4" />
                        </Button>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1">Recommended size: 512x512px (PNG or SVG)</p>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Primary Signature Block</label>
                      <Textarea 
                        placeholder="e.g. {{doctorName}} - {{credentials}}\nMedical Registration: {{regNo}}"
                        value={formData.signatureBlockTemplate}
                        onChange={e => setFormData({...formData, signatureBlockTemplate: e.target.value})}
                        className="min-h-[100px] border-slate-200"
                      />
                      <p className="text-[10px] text-slate-400 mt-1 italic">Use placeholders like {"{{doctorName}}"} for automated stamps.</p>
                    </div>
                  </div>

                  <div className="w-full md:w-64 space-y-4">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Logo Preview</p>
                    <div className="aspect-square rounded-3xl bg-slate-50 border border-slate-100 flex items-center justify-center overflow-hidden shadow-inner">
                      {formData.logoUrl ? (
                        <img src={formData.logoUrl} alt="Logo Preview" className="max-w-[80%] max-h-[80%] object-contain" />
                      ) : (
                        <ImageIcon className="w-12 h-12 text-slate-200" />
                      )}
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 flex justify-end">
                  <Button 
                    onClick={() => updateSettings.mutate(formData)}
                    disabled={updateSettings.isPending}
                    className="gap-2 font-bold px-8"
                  >
                    {updateSettings.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save Branding
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="documents">
            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle className="text-lg font-bold">Clinical Letterhead</CardTitle>
                <CardDescription>Configure the header and footer for professional consultation notes.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Header Text (Contact Details)</label>
                      <Textarea 
                        placeholder="e.g. 123 Healthcare Way, Metro City\nPhone: +91 98765 43210"
                        value={formData.letterheadConfig.headerText}
                        onChange={e => setFormData({
                          ...formData, 
                          letterheadConfig: { ...formData.letterheadConfig, headerText: e.target.value }
                        })}
                        className="h-24 border-slate-200"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Footer Text (Legal/Disclaimer)</label>
                      <Textarea 
                        placeholder="e.g. This document is a digitally signed clinical note valid for medical purposes."
                        value={formData.letterheadConfig.footerText}
                        onChange={e => setFormData({
                          ...formData, 
                          letterheadConfig: { ...formData.letterheadConfig, footerText: e.target.value }
                        })}
                        className="h-24 border-slate-200"
                      />
                    </div>
                  </div>
                  
                  <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 flex flex-col">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">Live Preview</p>
                    <div className="flex-1 bg-white border border-slate-200 rounded-lg shadow-sm p-4 flex flex-col gap-4 text-[8px] font-medium text-slate-600 scale-90 origin-top">
                      <div className="flex justify-between border-b border-slate-100 pb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 bg-slate-100 rounded flex items-center justify-center">
                            {formData.logoUrl ? <img src={formData.logoUrl} className="w-4 h-4" /> : <Building2 className="w-3 h-3" />}
                          </div>
                          <span className="font-bold text-slate-900">{config?.hospital?.name || "Hospital Name"}</span>
                        </div>
                        <div className="text-right whitespace-pre-wrap">{formData.letterheadConfig.headerText || "Header Address"}</div>
                      </div>
                      <div className="flex-1 min-h-[100px] flex flex-col gap-2">
                        <div className="h-2 w-1/3 bg-slate-50 rounded" />
                        <div className="h-2 w-full bg-slate-50 rounded" />
                        <div className="h-2 w-full bg-slate-50 rounded" />
                        <div className="h-2 w-2/3 bg-slate-50 rounded" />
                      </div>
                      <div className="border-t border-slate-100 pt-2 text-center text-[6px] text-slate-400 italic">
                        {formData.letterheadConfig.footerText || "Disclaimer footer text..."}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 flex justify-end">
                  <Button 
                    onClick={() => updateSettings.mutate(formData)}
                    disabled={updateSettings.isPending}
                    className="gap-2 font-bold px-8"
                  >
                    {updateSettings.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save Letterhead
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="workspace">
            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle className="text-lg font-bold">Workspace Preferences</CardTitle>
                <CardDescription>Configure how your team interacts with the operational dashboard.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="p-8 text-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                  <Settings2 className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                  <p className="text-sm text-slate-500 font-medium">Advanced workspace settings (Queue management, Follow-up logic) are being prepared for professional release.</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
