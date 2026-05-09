import { logger } from "./logger";

const API_KEY = process.env.GOOGLE_MAPS_API_KEY;

export interface GoogleProviderResult {
  id: string;
  type: "doctor" | "hospital";
  name: string;
  location: string;
  rating: string;
  specialty?: string;
  imageUrl?: string;
  source: "google";
}

/**
 * Geocode a city name or address into coordinates.
 */
export async function geocodeLocation(address: string): Promise<{ lat: number; lng: number } | null> {
  if (!API_KEY) return null;
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${API_KEY}`;
    const res = await fetch(url);
    const data = await res.json() as any;
    if (!data.results?.length) return null;
    return data.results[0].geometry.location;
  } catch (err) {
    logger.warn({ err, address }, "Google Geocoding failed");
    return null;
  }
}

/**
 * Reverse geocode coordinates into a formatted address/city.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  if (!API_KEY) return null;
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${API_KEY}`;
    const res = await fetch(url);
    const data = await res.json() as any;
    if (!data.results?.length) return null;
    return data.results[0].formatted_address;
  } catch (err) {
    logger.warn({ err, lat, lng }, "Google Reverse Geocoding failed");
    return null;
  }
}

/**
 * Fetch nearby doctors or hospitals using Google Places API.
 */
export async function fetchGoogleProviders(opts: {
  lat: number;
  lng: number;
  type: "doctor" | "hospital";
  q?: string;
  radiusMeters?: number;
}): Promise<GoogleProviderResult[]> {
  if (!API_KEY) return [];

  const radius = opts.radiusMeters ?? 10000;
  const keyword = opts.q ? encodeURIComponent(opts.q) : (opts.type === "doctor" ? "doctor" : "hospital");
  
  // type=doctor or type=hospital is supported by Google Places.
  // For doctors, 'health' or 'doctor' is a good type.
  const placeType = opts.type === "hospital" ? "hospital" : "doctor";

  try {
    const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${opts.lat},${opts.lng}&radius=${radius}&type=${placeType}&keyword=${keyword}&key=${API_KEY}`;
    const res = await fetch(url);
    const data = await res.json() as any;

    if (!data.results) return [];

    return data.results.slice(0, 10).map((p: any) => ({
      id: `google:${p.place_id}`,
      type: opts.type,
      name: p.name,
      location: p.vicinity || "Nearby",
      rating: (p.rating || 0).toFixed(1),
      specialty: opts.type === "doctor" ? "Medical Professional" : "General Hospital",
      imageUrl: p.photos?.length 
        ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${p.photos[0].photo_reference}&key=${API_KEY}`
        : undefined,
      source: "google" as const,
    }));
  } catch (err) {
    logger.error({ err }, `Google Places ${opts.type} search failed`);
    return [];
  }
}
