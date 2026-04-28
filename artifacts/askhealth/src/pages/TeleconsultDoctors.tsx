import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Star,
  MapPin,
  Clock,
  Video,
  MessageSquare,
  Filter,
  Loader2,
  Stethoscope,
  CheckCircle2,
  Brain,
  AlertTriangle,
} from "lucide-react";

interface Doctor {
  id: number;
  name: string;
  specialty: string;
  experienceYears: number;
  rating: string;
  location: string;
  bio: string | null;
  consultationFee: string;
  available: boolean;
  imageUrl: string | null;
  languages: string[];
}

const SPECIALTIES = [
  "all", "Cardiologist", "General Physician", "Dermatologist",
  "Gynecologist", "Neurologist", "Orthopedic Surgeon", "Pulmonologist", "Endocrinologist",
];

const SPECIALTY_ICONS: Record<string, string> = {
  "Cardiologist": "❤️", "General Physician": "🩺", "Dermatologist": "🌿",
  "Gynecologist": "🌸", "Neurologist": "🧠", "Orthopedic Surgeon": "🦴",
  "Pulmonologist": "🫁", "Endocrinologist": "🔬",
};

function DoctorCard({
  doctor,
  onBook,
  defaultType,
}: {
  doctor: Doctor;
  onBook: (d: Doctor, type: string) => void;
  defaultType: string;
}) {
  const [type, setType] = useState(defaultType);

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 hover:shadow-md hover:border-primary/20 transition-all">
      <div className="flex items-start gap-4">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-blue-200 flex items-center justify-center text-xl font-bold text-primary flex-shrink-0">
          {SPECIALTY_ICONS[doctor.specialty] ?? "🩺"}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div>
              <h3 className="font-bold text-slate-800">{doctor.name}</h3>
              <p className="text-sm text-slate-500">{doctor.specialty}</p>
            </div>
            {doctor.available ? (
              <Badge className="bg-green-100 text-green-700 flex-shrink-0">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1.5 inline-block" />
                Available
              </Badge>
            ) : (
              <Badge className="bg-slate-100 text-slate-500 flex-shrink-0">Unavailable</Badge>
            )}
          </div>

          <div className="flex flex-wrap gap-3 mt-2 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
              {Number(doctor.rating).toFixed(1)}
            </span>
            <span>{doctor.experienceYears} yrs exp</span>
            {doctor.location && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3" />{doctor.location}
              </span>
            )}
          </div>

          {doctor.bio && (
            <p className="text-xs text-slate-500 mt-2 line-clamp-2">{doctor.bio}</p>
          )}

          <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex gap-2">
              {["video", "async"].map((t) => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    type === t
                      ? "bg-primary text-white border-primary"
                      : "bg-white text-slate-600 border-slate-200 hover:border-primary/40"
                  }`}
                >
                  {t === "video" ? <Video className="w-3.5 h-3.5" /> : <MessageSquare className="w-3.5 h-3.5" />}
                  {t === "video" ? "Video" : "Async"}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <span className="font-bold text-primary">
                ₹{Number(doctor.consultationFee).toLocaleString("en-IN")}
              </span>
              <Button
                size="sm"
                disabled={!doctor.available}
                onClick={() => onBook(doctor, type)}
              >
                Book
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ConsentModal({
  doctor,
  type,
  triageId,
  chiefComplaint,
  onClose,
  onConfirm,
  loading,
}: {
  doctor: Doctor;
  type: string;
  triageId: string | null;
  chiefComplaint: string;
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
}) {
  const [consented, setConsented] = useState(false);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-xl">
            {SPECIALTY_ICONS[doctor.specialty] ?? "🩺"}
          </div>
          <div>
            <h2 className="font-bold text-slate-800">Confirm Booking</h2>
            <p className="text-xs text-slate-500">{doctor.name} · {doctor.specialty}</p>
          </div>
        </div>

        <div className="rounded-xl bg-slate-50 border border-slate-100 p-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">Consultation type</span>
            <span className="font-medium">{type === "video" ? "📹 Video" : "💬 Async Chat"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Fee</span>
            <span className="font-bold text-primary">₹{Number(doctor.consultationFee).toLocaleString("en-IN")}</span>
          </div>
          {type === "async" && (
            <div className="flex justify-between">
              <span className="text-slate-500">Response SLA</span>
              <span className="font-medium flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400" /> 4 hours
              </span>
            </div>
          )}
        </div>

        <label className="flex gap-3 items-start cursor-pointer rounded-xl border border-slate-200 p-4 hover:border-primary/40 transition-colors">
          <input
            type="checkbox"
            checked={consented}
            onChange={(e) => setConsented(e.target.checked)}
            className="mt-0.5 accent-primary h-4 w-4 flex-shrink-0"
          />
          <span className="text-xs text-slate-600 leading-relaxed">
            I consent to telemedical consultation and data processing. I understand this is not
            an emergency service and I should call 108 or visit an A&E for life-threatening conditions.
          </span>
        </label>

        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button className="flex-1" disabled={!consented || loading} onClick={onConfirm}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
            Confirm Booking
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function TeleconsultDoctors() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const triageId = params.get("triageId");
  const suggestedSpecialty = params.get("specialty") ?? "all";
  const suggestedType = params.get("type") ?? "video";

  const [specialty, setSpecialty] = useState(suggestedSpecialty);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState<{ doctor: Doctor; type: string } | null>(null);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [chiefComplaint, setChiefComplaint] = useState("");

  useEffect(() => {
    setLoading(true);
    fetch(`/api/tc/doctors?specialty=${encodeURIComponent(specialty === "all" ? "" : specialty)}`, {
      credentials: "include",
    })
      .then((r) => r.json())
      .then((d) => setDoctors(d.doctors ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [specialty]);

  const handleConfirmBooking = async () => {
    if (!booking) return;
    setBookingLoading(true);
    try {
      const res = await fetch("/api/tc/consultation/book", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doctorId: booking.doctor.id,
          triageSessionId: triageId ? parseInt(triageId) : undefined,
          type: booking.type,
          chiefComplaint: chiefComplaint || undefined,
          consentGiven: true,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Booking failed");
      const { consultation } = await res.json();
      navigate(`/teleconsult/session/${consultation.id}`);
    } catch (e: any) {
      alert(e.message ?? "Booking failed");
    } finally {
      setBookingLoading(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
            <Stethoscope className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h1 className="font-bold text-slate-800 text-xl">Find a Doctor</h1>
            <p className="text-xs text-slate-500">Verified specialists · Instant booking</p>
          </div>
        </div>

        {triageId && (
          <div className="rounded-xl bg-violet-50 border border-violet-200 p-4 flex gap-3 mb-5">
            <Brain className="w-4 h-4 text-violet-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-violet-700">
              Yukti triage complete. Showing doctors matching your suggested specialty.
              Your clinical snapshot will be shared with the doctor.
            </p>
          </div>
        )}

        {/* Specialty filter */}
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-semibold text-slate-600">Filter by specialty</span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
            {SPECIALTIES.map((s) => (
              <button
                key={s}
                onClick={() => setSpecialty(s)}
                className={`px-4 py-2 rounded-full text-xs font-medium border whitespace-nowrap transition-all flex-shrink-0 ${
                  specialty === s
                    ? "bg-primary text-white border-primary shadow-sm"
                    : "bg-white text-slate-600 border-slate-200 hover:border-primary/40"
                }`}
              >
                {s === "all" ? "All" : `${SPECIALTY_ICONS[s] ?? ""} ${s}`}
              </button>
            ))}
          </div>
        </div>

        {/* Consult type hint */}
        {!triageId && (
          <div className="mb-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 flex gap-2 items-start">
              <Video className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-slate-700">Video Consult</p>
                <p className="text-xs text-slate-500">Face-to-face, ~15–30 min</p>
              </div>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 flex gap-2 items-start">
              <MessageSquare className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-slate-700">Async Chat</p>
                <p className="text-xs text-slate-500">Text-based, 4 hr SLA</p>
              </div>
            </div>
          </div>
        )}

        {/* Doctor list */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-36 rounded-2xl bg-slate-100 animate-pulse" />
            ))}
          </div>
        ) : doctors.length === 0 ? (
          <div className="text-center py-12">
            <AlertTriangle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-slate-500 text-sm">No doctors found for this specialty</p>
          </div>
        ) : (
          <div className="space-y-4">
            {doctors.map((d) => (
              <DoctorCard
                key={d.id}
                doctor={d}
                onBook={(doc, type) => setBooking({ doctor: doc, type })}
                defaultType={suggestedType}
              />
            ))}
          </div>
        )}
      </div>

      {booking && (
        <ConsentModal
          doctor={booking.doctor}
          type={booking.type}
          triageId={triageId}
          chiefComplaint={chiefComplaint}
          onClose={() => setBooking(null)}
          onConfirm={handleConfirmBooking}
          loading={bookingLoading}
        />
      )}
    </Layout>
  );
}
