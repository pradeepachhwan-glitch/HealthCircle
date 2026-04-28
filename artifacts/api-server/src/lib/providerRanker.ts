// Hybrid retrieval ranking layer for provider search.
//
// Both DB (curated, trusted) and external (OSM, coverage) results are fetched
// in parallel. This module assigns a relevance score to each result, merges
// the two pools, removes near-duplicates (prefer DB record when names are
// nearly identical), then returns a sorted list ready to send to the client.
//
// Scoring model — doctors:
//   DB record              +100  (trusted, bookable)
//   OSM record             +20   (coverage expansion)
//   specialty exact match  +40
//   specialty chip match   +35
//   city match             +30
//   rating bonus           up to +30 (rating × 6)
//   name/q match           +10
//   available              +5
//
// Hospitals use the same bands with specialties array instead of a single field.

import type { LiveDoctor, LiveHospital } from "./osmProviders";

// ---- unified shapes --------------------------------------------------------

export type DoctorSource = "db" | "openstreetmap";
export type HospitalSource = "db" | "openstreetmap";

export interface RankedDoctor {
  id: string | number;
  name: string;
  specialty: string;
  experienceYears: number;
  consultationFee: string | number;
  rating: string | number;
  location: string;
  bio?: string | null;
  languages: string[];
  available: boolean;
  imageUrl?: string | null;
  source: DoctorSource;
  sourceUrl?: string | null;
  phone?: string | null;
  website?: string | null;
  _score: number;
}

export interface RankedHospital {
  id: string | number;
  name: string;
  location: string;
  specialties: string[];
  rating: string | number;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  imageUrl?: string | null;
  source: HospitalSource;
  sourceUrl?: string | null;
  _score: number;
}

// ---- scoring ---------------------------------------------------------------

interface DoctorOpts {
  q?: string;
  inferred?: string | null;
  chip?: string | null;
  cityShort?: string | null;
}

export function scoreDoctor(
  doc: Pick<RankedDoctor, "name" | "specialty" | "location" | "rating" | "available" | "source">,
  opts: DoctorOpts,
): number {
  let s = doc.source === "db" ? 100 : 20;

  const spec = doc.specialty.toLowerCase();
  const loc = doc.location.toLowerCase();
  const name = doc.name.toLowerCase();
  const q = (opts.q ?? "").toLowerCase();
  const inf = (opts.inferred ?? "").toLowerCase();
  const chip = (opts.chip ?? "").toLowerCase();
  const city = (opts.cityShort ?? "").toLowerCase();

  if (inf && spec.includes(inf)) s += 40;
  else if (chip && spec.includes(chip)) s += 35;

  if (city && loc.includes(city)) s += 30;
  if (q && name.includes(q)) s += 10;
  if (q && spec.includes(q)) s += 8;

  const r = parseFloat(String(doc.rating));
  if (!isNaN(r) && r > 0) s += Math.round(r * 6); // up to +30

  if (doc.available) s += 5;
  return s;
}

interface HospitalOpts {
  q?: string;
  inferred?: string | null;
  chip?: string | null;
  cityShort?: string | null;
}

export function scoreHospital(
  hosp: Pick<RankedHospital, "name" | "specialties" | "location" | "rating" | "source">,
  opts: HospitalOpts,
): number {
  let s = hosp.source === "db" ? 100 : 20;

  const specs = hosp.specialties.map((sp) => sp.toLowerCase());
  const loc = hosp.location.toLowerCase();
  const name = hosp.name.toLowerCase();
  const q = (opts.q ?? "").toLowerCase();
  const inf = (opts.inferred ?? "").toLowerCase();
  const chip = (opts.chip ?? "").toLowerCase();
  const city = (opts.cityShort ?? "").toLowerCase();

  if (inf && specs.some((sp) => sp.includes(inf))) s += 40;
  else if (chip && specs.some((sp) => sp.includes(chip))) s += 35;

  if (city && loc.includes(city)) s += 30;
  if (q && name.includes(q)) s += 10;

  const r = parseFloat(String(hosp.rating));
  if (!isNaN(r) && r > 0) s += Math.round(r * 6);

  return s;
}

// ---- de-duplication --------------------------------------------------------

function normalizeName(n: string): string {
  return n
    .toLowerCase()
    .replace(/\bdr\.?\s*/gi, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

export function deduplicateDoctors(docs: RankedDoctor[]): RankedDoctor[] {
  const seen = new Set<string>();
  return docs.filter((d) => {
    const key = normalizeName(d.name);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function deduplicateHospitals(hosps: RankedHospital[]): RankedHospital[] {
  const seen = new Set<string>();
  return hosps.filter((h) => {
    const key = normalizeName(h.name);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ---- DB → RankedDoctor / RankedHospital adapters ---------------------------

type DbDoctor = {
  id: number;
  name: string;
  specialty: string;
  experienceYears: number | null;
  consultationFee: string | null;
  rating: string | null;
  location: string | null;
  bio: string | null;
  languages: string[] | null;
  available: boolean | null;
  imageUrl: string | null;
};

export function adaptDbDoctor(d: DbDoctor, opts: DoctorOpts): RankedDoctor {
  const base: RankedDoctor = {
    id: d.id,
    name: d.name,
    specialty: d.specialty,
    experienceYears: d.experienceYears ?? 0,
    consultationFee: d.consultationFee ?? "0",
    rating: d.rating ?? "0.0",
    location: d.location ?? "",
    bio: d.bio,
    languages: d.languages ?? ["English"],
    available: d.available ?? false,
    imageUrl: d.imageUrl,
    source: "db",
    sourceUrl: null,
    phone: null,
    website: null,
    _score: 0,
  };
  base._score = scoreDoctor(base, opts);
  return base;
}

export function adaptLiveDoctor(d: LiveDoctor, opts: DoctorOpts): RankedDoctor {
  const base: RankedDoctor = {
    id: d.id,
    name: d.name,
    specialty: d.specialty,
    experienceYears: d.experienceYears,
    consultationFee: d.consultationFee,
    rating: d.rating,
    location: d.location,
    bio: d.bio ?? null,
    languages: d.languages,
    available: d.available,
    imageUrl: d.imageUrl ?? null,
    source: "openstreetmap",
    sourceUrl: d.sourceUrl ?? null,
    phone: d.phone ?? null,
    website: d.website ?? null,
    _score: 0,
  };
  base._score = scoreDoctor(base, opts);
  return base;
}

type DbHospital = {
  id: number;
  name: string;
  location: string | null;
  specialties: string[] | null;
  rating: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  imageUrl: string | null;
};

export function adaptDbHospital(h: DbHospital, opts: HospitalOpts): RankedHospital {
  const base: RankedHospital = {
    id: h.id,
    name: h.name,
    location: h.location ?? "",
    specialties: h.specialties ?? [],
    rating: h.rating ?? "0.0",
    phone: h.phone,
    email: h.email,
    website: h.website,
    imageUrl: h.imageUrl,
    source: "db",
    sourceUrl: null,
    _score: 0,
  };
  base._score = scoreHospital(base, opts);
  return base;
}

export function adaptLiveHospital(h: LiveHospital, opts: HospitalOpts): RankedHospital {
  const base: RankedHospital = {
    id: h.id,
    name: h.name,
    location: h.location,
    specialties: h.specialties,
    rating: h.rating,
    phone: h.phone ?? null,
    email: h.email ?? null,
    website: h.website ?? null,
    imageUrl: h.imageUrl ?? null,
    source: "openstreetmap",
    sourceUrl: h.sourceUrl ?? null,
    _score: 0,
  };
  base._score = scoreHospital(base, opts);
  return base;
}

// ---- merge pipeline --------------------------------------------------------

export function mergeAndRankDoctors(
  dbDocs: DbDoctor[],
  liveDocs: LiveDoctor[],
  opts: DoctorOpts,
  limit = 50,
): RankedDoctor[] {
  const scored = [
    ...dbDocs.map((d) => adaptDbDoctor(d, opts)),
    ...liveDocs.map((d) => adaptLiveDoctor(d, opts)),
  ];
  scored.sort((a, b) => b._score - a._score);
  return deduplicateDoctors(scored).slice(0, limit);
}

export function mergeAndRankHospitals(
  dbHosps: DbHospital[],
  liveHosps: LiveHospital[],
  opts: HospitalOpts,
  limit = 50,
): RankedHospital[] {
  const scored = [
    ...dbHosps.map((h) => adaptDbHospital(h, opts)),
    ...liveHosps.map((h) => adaptLiveHospital(h, opts)),
  ];
  scored.sort((a, b) => b._score - a._score);
  return deduplicateHospitals(scored).slice(0, limit);
}
