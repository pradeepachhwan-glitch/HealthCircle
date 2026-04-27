import { logger } from "./logger";

const NOMINATIM = "https://nominatim.openstreetmap.org";
const OVERPASS = "https://overpass-api.de/api/interpreter";
const UA = "HealthCircle/1.0 (healthcircle.app; contact@healthcircle.app)";
const TIMEOUT_MS = 6000;

interface CacheEntry<T> { value: T; expires: number; }
const cache = new Map<string, CacheEntry<unknown>>();
const TTL_MS = 60 * 60 * 1000;

function cacheGet<T>(key: string): T | null {
  const e = cache.get(key);
  if (!e) return null;
  if (Date.now() > e.expires) { cache.delete(key); return null; }
  return e.value as T;
}
function cacheSet<T>(key: string, value: T): void {
  cache.set(key, { value, expires: Date.now() + TTL_MS });
}

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal, headers: { "User-Agent": UA, ...(init?.headers ?? {}) } });
  } finally {
    clearTimeout(t);
  }
}

interface Bbox { south: number; west: number; north: number; east: number; centerLabel: string; }

async function geocodeCity(city: string): Promise<Bbox | null> {
  const key = `geo:${city.toLowerCase()}`;
  const cached = cacheGet<Bbox | null>(key);
  if (cached !== null) return cached;
  try {
    const url = `${NOMINATIM}/search?format=json&limit=1&countrycodes=in&q=${encodeURIComponent(city)}`;
    const r = await fetchWithTimeout(url);
    if (!r.ok) return null;
    const arr = (await r.json()) as Array<{ boundingbox?: [string, string, string, string]; display_name?: string }>;
    if (!arr.length || !arr[0].boundingbox) { cacheSet(key, null); return null; }
    const [s, n, w, e] = arr[0].boundingbox.map(parseFloat);
    const bbox: Bbox = { south: s, north: n, west: w, east: e, centerLabel: arr[0].display_name ?? city };
    cacheSet(key, bbox);
    return bbox;
  } catch (err) {
    logger.warn({ err, city }, "OSM geocode failed");
    return null;
  }
}

export interface LiveDoctor {
  id: string;
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
  source: "openstreetmap";
  sourceUrl?: string;
  phone?: string;
  website?: string;
}

export interface LiveHospital {
  id: string;
  name: string;
  location: string;
  specialties: string[];
  rating: string;
  phone?: string;
  email?: string;
  website?: string;
  imageUrl?: string;
  source: "openstreetmap";
  sourceUrl?: string;
}

interface OverpassElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

async function overpassQuery(selectors: string[], bbox: Bbox): Promise<OverpassElement[]> {
  const bboxStr = `(${bbox.south},${bbox.west},${bbox.north},${bbox.east})`;
  const body = selectors.map((s) => `${s}${bboxStr};`).join("");
  const ql = `[out:json][timeout:8];(${body});out tags center 40;`;
  try {
    const r = await fetchWithTimeout(OVERPASS, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `data=${encodeURIComponent(ql)}`,
    });
    if (!r.ok) {
      logger.warn({ status: r.status }, "Overpass query failed");
      return [];
    }
    const json = (await r.json()) as { elements?: OverpassElement[] };
    return json.elements ?? [];
  } catch (err) {
    logger.warn({ err }, "Overpass query error");
    return [];
  }
}

export async function fetchLiveDoctors(opts: { specialty?: string; q?: string; city?: string }): Promise<LiveDoctor[]> {
  const city = (opts.city ?? "").trim() || "Mumbai";
  const cacheKey = `doctors:${city.toLowerCase()}:${(opts.specialty ?? "").toLowerCase()}:${(opts.q ?? "").toLowerCase()}`;
  const cached = cacheGet<LiveDoctor[]>(cacheKey);
  if (cached) return cached;

  const bbox = await geocodeCity(city);
  if (!bbox) return [];

  // amenity=doctors / clinic / healthcare=doctor
  const selectors = [
    `node["amenity"~"^(doctors|clinic)$"]`,
    `way["amenity"~"^(doctors|clinic)$"]`,
    `node["healthcare"~"^(doctor|clinic)$"]`,
    `way["healthcare"~"^(doctor|clinic)$"]`,
  ];
  const elements = await overpassQuery(selectors, bbox);

  const specialty = (opts.specialty ?? "").toLowerCase().trim();
  const q = (opts.q ?? "").toLowerCase().trim();

  const list: LiveDoctor[] = elements
    .map((el) => {
      const t = el.tags ?? {};
      const name = t.name || t["name:en"] || t.operator;
      if (!name) return null;
      const elSpecialty = (t["healthcare:speciality"] || t.speciality || t.specialty || "General Physician").replace(/_/g, " ");
      if (specialty && !elSpecialty.toLowerCase().includes(specialty) && !name.toLowerCase().includes(specialty)) return null;
      if (q && !name.toLowerCase().includes(q) && !elSpecialty.toLowerCase().includes(q)) return null;
      const addr = [t["addr:street"], t["addr:suburb"], t["addr:city"]].filter(Boolean).join(", ") || city;
      return {
        id: `osm-d-${el.id}`,
        name,
        specialty: titleCase(elSpecialty),
        experienceYears: 0,
        consultationFee: "0",
        rating: "0.0",
        location: addr,
        bio: undefined,
        languages: ["English"],
        available: true,
        imageUrl: undefined,
        source: "openstreetmap" as const,
        sourceUrl: `https://www.openstreetmap.org/${el.type}/${el.id}`,
        phone: t["contact:phone"] || t.phone,
        website: t["contact:website"] || t.website,
      } as LiveDoctor;
    })
    .filter((x): x is LiveDoctor => x !== null)
    .slice(0, 30);

  cacheSet(cacheKey, list);
  return list;
}

export async function fetchLiveHospitals(opts: { q?: string; city?: string; specialty?: string }): Promise<LiveHospital[]> {
  const city = (opts.city ?? "").trim() || "Mumbai";
  const cacheKey = `hospitals:${city.toLowerCase()}:${(opts.q ?? "").toLowerCase()}:${(opts.specialty ?? "").toLowerCase()}`;
  const cached = cacheGet<LiveHospital[]>(cacheKey);
  if (cached) return cached;

  const bbox = await geocodeCity(city);
  if (!bbox) return [];

  const selectors = [
    `node["amenity"="hospital"]`,
    `way["amenity"="hospital"]`,
    `node["healthcare"="hospital"]`,
    `way["healthcare"="hospital"]`,
  ];
  const elements = await overpassQuery(selectors, bbox);

  const q = (opts.q ?? "").toLowerCase().trim();

  const list: LiveHospital[] = elements
    .map((el) => {
      const t = el.tags ?? {};
      const name = t.name || t["name:en"] || t.operator;
      if (!name) return null;
      if (q && !name.toLowerCase().includes(q)) return null;
      const addr = [t["addr:street"], t["addr:suburb"], t["addr:city"]].filter(Boolean).join(", ") || city;
      const specialties = (t["healthcare:speciality"] || t.speciality || "")
        .split(/[;,]/)
        .map((s) => titleCase(s.trim().replace(/_/g, " ")))
        .filter(Boolean);
      return {
        id: `osm-h-${el.id}`,
        name,
        location: addr,
        specialties: specialties.length ? specialties : ["General"],
        rating: "0.0",
        phone: t["contact:phone"] || t.phone,
        email: t["contact:email"] || t.email,
        website: t["contact:website"] || t.website,
        imageUrl: undefined,
        source: "openstreetmap" as const,
        sourceUrl: `https://www.openstreetmap.org/${el.type}/${el.id}`,
      } as LiveHospital;
    })
    .filter((x): x is LiveHospital => x !== null)
    .slice(0, 30);

  cacheSet(cacheKey, list);
  return list;
}

function titleCase(s: string): string {
  return s.split(/\s+/).map((w) => (w.length ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w)).join(" ");
}
