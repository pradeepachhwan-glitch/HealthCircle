import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Layout } from "@/components/Layout";
import {
  Search, Star, MapPin, Clock, Calendar,
  Stethoscope, Building2, Phone, Globe, Navigation, Loader2
} from "lucide-react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

interface Doctor {
  id: number;
  name: string;
  specialty: string;
  experienceYears: number;
  consultationFee: string;
  rating: string;
  location: string;
  bio?: string;
  languages: string[];
  available: boolean;
  imageUrl?: string;
}

interface Hospital {
  id: number;
  name: string;
  location: string;
  specialties: string[];
  rating: string;
  phone?: string;
  email?: string;
  website?: string;
  imageUrl?: string;
}

const SPECIALTIES = [
  "Cardiologist", "Orthopedic Surgeon", "Dermatologist", "General Physician",
  "Gynecologist", "Neurologist", "Pulmonologist", "Endocrinologist",
];

function useLocation() {
  const [city, setCity] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [denied, setDenied] = useState(false);

  function detect() {
    if (!navigator.geolocation) return;
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
          );
          const data = await res.json();
          const addr = data.address;
          const parts = [addr.city ?? addr.town ?? addr.village, addr.state].filter(Boolean);
          setCity(parts.join(", ") || null);
        } catch {
          setCity(null);
        } finally {
          setLoading(false);
        }
      },
      () => { setDenied(true); setLoading(false); }
    );
  }

  return { city, loading, denied, detect };
}

function DoctorCard({ doctor, onBook }: { doctor: Doctor; onBook: (doctor: Doctor) => void }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-md transition-all hover:border-primary/30">
      <div className="flex gap-4">
        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center flex-shrink-0">
          <Stethoscope className="w-6 h-6 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-semibold text-slate-900">{doctor.name}</h3>
              <p className="text-sm text-primary font-medium">{doctor.specialty}</p>
            </div>
            <Badge className={doctor.available ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-500 border-slate-200"} variant="outline">
              {doctor.available ? "Available" : "Unavailable"}
            </Badge>
          </div>
          <div className="flex flex-wrap gap-3 mt-2 text-xs text-slate-500">
            <span className="flex items-center gap-1"><Star className="w-3 h-3 text-amber-400 fill-amber-400" />{doctor.rating}</span>
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{doctor.experienceYears} yrs exp.</span>
            <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{doctor.location}</span>
          </div>
          {doctor.bio && <p className="text-xs text-slate-500 mt-2 line-clamp-2">{doctor.bio}</p>}
          <div className="flex items-center justify-between mt-3">
            <div>
              <span className="text-slate-900 font-bold">₹{doctor.consultationFee}</span>
              <span className="text-slate-400 text-xs ml-1">/ consultation</span>
            </div>
            <Button
              size="sm"
              onClick={() => onBook(doctor)}
              disabled={!doctor.available}
              className="bg-primary hover:bg-primary/90 text-white text-xs"
            >
              <Calendar className="w-3.5 h-3.5 mr-1" /> Book Appointment
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function HospitalCard({ hospital }: { hospital: Hospital }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-md transition-all hover:border-primary/30">
      <div className="flex gap-4">
        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-slate-100 to-slate-50 flex items-center justify-center flex-shrink-0">
          <Building2 className="w-6 h-6 text-slate-700" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-semibold text-slate-900">{hospital.name}</h3>
              <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
                <MapPin className="w-3 h-3" /> {hospital.location}
              </div>
            </div>
            <span className="flex items-center gap-1 text-sm font-medium text-amber-600">
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" /> {hospital.rating}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-3">
            {hospital.specialties?.slice(0, 4).map(s => (
              <Badge key={s} variant="secondary" className="text-xs px-2 py-0.5">{s}</Badge>
            ))}
            {(hospital.specialties?.length ?? 0) > 4 && (
              <Badge variant="outline" className="text-xs px-2 py-0.5">+{hospital.specialties.length - 4} more</Badge>
            )}
          </div>
          <div className="flex flex-wrap gap-4 mt-3 text-xs text-slate-500">
            {hospital.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{hospital.phone}</span>}
            {hospital.website && (
              <a href={hospital.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                <Globe className="w-3 h-3" /> Website
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function BookingDialog({ doctor, open, onClose }: { doctor: Doctor | null; open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [date, setDate] = useState("");
  const [time, setTime] = useState("10:00");
  const [notes, setNotes] = useState("");

  const book = useMutation({
    mutationFn: () =>
      fetch(`${API_BASE}/appointments`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doctorId: doctor?.id,
          appointmentTime: new Date(`${date}T${time}`).toISOString(),
          notes: notes || null,
        }),
      }).then(r => r.json()),
    onSuccess: () => {
      toast({ title: "Appointment Booked!", description: `Confirmed with ${doctor?.name}.` });
      qc.invalidateQueries({ queryKey: ["appointments"] });
      onClose();
      setDate(""); setTime("10:00"); setNotes("");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to book appointment.", variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Book Appointment</DialogTitle>
        </DialogHeader>
        {doctor && (
          <div className="flex gap-3 p-3 bg-slate-50 rounded-xl mb-2">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Stethoscope className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-medium text-slate-900 text-sm">{doctor.name}</p>
              <p className="text-xs text-slate-500">{doctor.specialty} · ₹{doctor.consultationFee}</p>
            </div>
          </div>
        )}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Date</Label>
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} min={new Date().toISOString().split("T")[0]} />
          </div>
          <div className="space-y-2">
            <Label>Time</Label>
            <Input type="time" value={time} onChange={e => setTime(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Notes (optional)</Label>
            <Input placeholder="Describe your concern briefly..." value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => book.mutate()}
            disabled={!date || book.isPending}
            className="bg-primary hover:bg-primary/90"
          >
            {book.isPending ? "Booking..." : "Confirm Booking"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function ProvidersPage() {
  const [query, setQuery] = useState("");
  const [selectedSpecialty, setSelectedSpecialty] = useState("");
  const [bookingDoctor, setBookingDoctor] = useState<Doctor | null>(null);
  const { city, loading: locLoading, denied, detect } = useLocation();

  useEffect(() => { detect(); }, []);

  const locationFilter = city ?? "";

  const { data: doctors = [], isLoading: loadingDoctors } = useQuery<Doctor[]>({
    queryKey: ["doctors", query, selectedSpecialty],
    queryFn: () => {
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      if (selectedSpecialty) params.set("specialty", selectedSpecialty);
      return fetch(`${API_BASE}/doctors?${params}`, { credentials: "include" }).then(r => r.json());
    },
  });

  const { data: hospitals = [], isLoading: loadingHospitals } = useQuery<Hospital[]>({
    queryKey: ["hospitals", query],
    queryFn: () => {
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      return fetch(`${API_BASE}/hospitals?${params}`, { credentials: "include" }).then(r => r.json());
    },
  });

  // Client-side location filter when city detected
  const filteredDoctors = city && !query
    ? doctors.filter(d => d.location.toLowerCase().includes(city.split(",")[0].toLowerCase()))
    : doctors;

  const filteredHospitals = city && !query
    ? hospitals.filter(h => h.location.toLowerCase().includes(city.split(",")[0].toLowerCase()))
    : hospitals;

  // Fall back to all if location filter returns nothing
  const displayDoctors = filteredDoctors.length > 0 ? filteredDoctors : doctors;
  const displayHospitals = filteredHospitals.length > 0 ? filteredHospitals : hospitals;

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Find Doctors & Hospitals</h1>
          <div className="flex items-center gap-2 mt-1">
            {locLoading && (
              <span className="flex items-center gap-1 text-xs text-slate-400">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Detecting location…
              </span>
            )}
            {city && !locLoading && (
              <span className="flex items-center gap-1 text-xs text-primary bg-primary/5 px-2 py-0.5 rounded-full">
                <MapPin className="w-3 h-3" /> Showing results near {city}
              </span>
            )}
            {denied && !city && (
              <button
                onClick={detect}
                className="flex items-center gap-1 text-xs text-slate-500 hover:text-primary transition-colors"
              >
                <Navigation className="w-3 h-3" /> Enable location for nearby results
              </button>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            className="pl-10 bg-white h-11 rounded-xl shadow-sm"
            placeholder="Search doctors, specialties, hospitals, or city..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>

        <Tabs defaultValue="doctors">
          <TabsList className="mb-6 bg-slate-100 p-1 rounded-xl">
            <TabsTrigger value="doctors" className="gap-2 rounded-lg">
              <Stethoscope className="w-4 h-4" /> Doctors ({displayDoctors.length})
            </TabsTrigger>
            <TabsTrigger value="hospitals" className="gap-2 rounded-lg">
              <Building2 className="w-4 h-4" /> Hospitals ({displayHospitals.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="doctors">
            {/* Specialty filter chips */}
            <div className="flex flex-wrap gap-2 mb-5">
              <Button
                size="sm"
                variant={selectedSpecialty === "" ? "default" : "outline"}
                onClick={() => setSelectedSpecialty("")}
                className="h-7 text-xs rounded-full"
              >All</Button>
              {SPECIALTIES.map(s => (
                <Button
                  key={s}
                  size="sm"
                  variant={selectedSpecialty === s ? "default" : "outline"}
                  onClick={() => setSelectedSpecialty(s === selectedSpecialty ? "" : s)}
                  className="h-7 text-xs rounded-full"
                >{s}</Button>
              ))}
            </div>

            {loadingDoctors && (
              <div className="text-center py-12 text-slate-400 flex flex-col items-center gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                <p className="text-sm">Finding doctors…</p>
              </div>
            )}
            {!loadingDoctors && displayDoctors.length === 0 && (
              <div className="text-center py-12 text-slate-400">
                <Stethoscope className="w-10 h-10 mx-auto mb-3 text-slate-300" />
                <p>No doctors found. Try a different search.</p>
              </div>
            )}
            <div className="grid gap-4">
              {displayDoctors.map(d => <DoctorCard key={d.id} doctor={d} onBook={setBookingDoctor} />)}
            </div>
          </TabsContent>

          <TabsContent value="hospitals">
            {loadingHospitals && (
              <div className="text-center py-12 text-slate-400 flex flex-col items-center gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                <p className="text-sm">Finding hospitals…</p>
              </div>
            )}
            {!loadingHospitals && displayHospitals.length === 0 && (
              <div className="text-center py-12 text-slate-400">
                <Building2 className="w-10 h-10 mx-auto mb-3 text-slate-300" />
                <p>No hospitals found.</p>
              </div>
            )}
            <div className="grid gap-4">
              {displayHospitals.map(h => <HospitalCard key={h.id} hospital={h} />)}
            </div>
          </TabsContent>
        </Tabs>

        <BookingDialog
          doctor={bookingDoctor}
          open={!!bookingDoctor}
          onClose={() => setBookingDoctor(null)}
        />
      </div>
    </Layout>
  );
}
