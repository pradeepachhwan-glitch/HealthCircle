import { Link } from "wouter";
import { Building2, ClipboardList, Megaphone, Stethoscope, UploadCloud } from "lucide-react";
import { Layout } from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@workspace/replit-auth-web";

export default function HospitalDashboard() {
  const { user } = useAuth();

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
          <section className="rounded-3xl bg-slate-950 text-white p-6 shadow-sm overflow-hidden relative">
            <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-primary/30 blur-3xl" />
            <div className="relative">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-xs font-medium mb-4">
                <Building2 className="w-3.5 h-3.5" />
                Hospital workspace
              </div>
              <h1 className="text-2xl md:text-3xl font-bold">Welcome, {user?.displayName ?? "Health Partner"}</h1>
              <p className="mt-2 text-sm text-slate-300 max-w-2xl">
                This account type is reserved for hospitals, clinics, and care teams. The full partner
                content workflow will be configured after the core Replit parity migration is stable.
              </p>
            </div>
          </section>

          <div className="grid gap-4 md:grid-cols-3">
            <PartnerCard
              icon={<UploadCloud className="w-5 h-5" />}
              title="Upload care content"
              description="Future home for hospital announcements, videos, articles, and care-program content."
            />
            <PartnerCard
              icon={<Stethoscope className="w-5 h-5" />}
              title="Manage doctors"
              description="Later this will connect hospital doctors to HealthCircle provider and teleconsult flows."
            />
            <PartnerCard
              icon={<Megaphone className="w-5 h-5" />}
              title="Reach communities"
              description="Hospital-approved education can be reviewed and published into relevant communities."
            />
          </div>

          <Card>
            <CardContent className="p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex gap-3">
                <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                  <ClipboardList className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-semibold text-slate-900">Current status</h2>
                  <p className="text-sm text-slate-500">
                    Your hospital account can sign in now. Admins will define content, access, and upload
                    permissions in the next partner phase.
                  </p>
                </div>
              </div>
              <Link href="/support">
                <Button variant="outline">Contact HealthCircle</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}

function PartnerCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Card className="border-slate-200">
      <CardContent className="p-5">
        <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4">
          {icon}
        </div>
        <h3 className="font-semibold text-slate-900">{title}</h3>
        <p className="text-sm text-slate-500 mt-1">{description}</p>
      </CardContent>
    </Card>
  );
}
