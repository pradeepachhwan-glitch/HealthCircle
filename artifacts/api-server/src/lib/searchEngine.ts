import { db } from "@workspace/db";
import { doctorsTable, hospitalsTable, searchLogsTable, communitiesTable, postsTable, usersTable } from "@workspace/db/schema";
import { ilike, or, eq, and, desc, sql } from "drizzle-orm";
import { aiChatJson } from "./aiClient";
import { detectEmergency } from "./emergencyDetect";
import {
  fetchLiveDoctors,
  fetchLiveHospitals,
  fetchLiveDoctorsByCoords,
  fetchLiveHospitalsByCoords,
} from "./osmProviders";

/**
 * "doctor near me", "find a hospital", "best clinic" — all of these are
 * generic intent strings that don't carry meaningful keywords beyond the
 * fillers we already strip in `cleanFreeTextQuery`. Detect that case so we
 * skip the fuzzy `ilike(name OR specialty OR location)` filter and instead
 * just return the city's available providers (or all providers if no city).
 *
 * Without this, "doctor near me" hits ZERO rows because no doctor is named
 * literally "doctor near me" — and we end up showing an empty page.
 */
function isGenericProviderQuery(raw: string): boolean {
  const FILLERS = new Set([
    "near", "me", "near-me", "nearme", "nearby",
    "in", "at", "the", "a", "an", "of", "for", "to", "my",
    "hospital", "hospitals", "clinic", "clinics",
    "doctor", "doctors", "dr", "dr.", "physician", "physicians",
    "best", "top", "good", "find", "show", "list", "search",
  ]);
  const tokens = (raw ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (tokens.length === 0) return true;
  return tokens.every((t) => FILLERS.has(t));
}
import { logger } from "./logger";

export type SearchIntent = "symptom" | "treatment" | "doctor" | "lab" | "general";

export interface SearchResult {
  intent: SearchIntent;
  summary: string;
  risk_level: "low" | "medium" | "high";
  recommendations: string[];
  providers: ProviderResult[];
  relatedCommunities: RelatedCommunity[];
  discussions: DiscussionResult[];
  mapQuery: string;
  ai_synthesized: boolean;
  /** The medical specialty inferred from the query, if any (e.g. "Pediatrician"). */
  detectedSpecialty: string | null;
  /** Reason providers list is empty (lets the UI show an honest message). */
  providerEmptyReason: "no_specialty_match" | "no_general_match" | null;
}

interface ProviderResult {
  // Number for in-DB rows (serial PK), string for live OSM rows ("osm-d-…").
  id: number | string;
  type: "doctor" | "hospital";
  name: string;
  specialty?: string;
  location: string;
  rating: string;
  available?: boolean;
  source?: "openstreetmap";
  sourceUrl?: string;
}

interface RelatedCommunity {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  iconEmoji: string | null;
  iconUrl: string | null;
}

interface DiscussionResult {
  id: number;
  title: string;
  excerpt: string;
  communitySlug: string;
  communityName: string;
  authorName: string | null;
  upvoteCount: number;
  commentCount: number;
  isExpertAnswered: boolean;
  createdAt: Date;
}

const SYMPTOM_KEYWORDS = ["pain", "ache", "fever", "cold", "cough", "headache", "dizzy", "nausea", "fatigue", "swelling", "rash", "bleed", "breathe", "chest", "stomach", "दर्द", "बुखार", "सिरदर्द", "खांसी"];
const TREATMENT_KEYWORDS = ["treat", "cure", "medicine", "drug", "therapy", "surgery", "vaccine", "dose", "dosage", "prescription", "इलाज", "दवा"];
const DOCTOR_KEYWORDS = ["doctor", "specialist", "physician", "surgeon", "cardiologist", "dermatologist", "orthopedic", "gynecologist", "डॉक्टर", "चिकित्सक"];
const LAB_KEYWORDS = ["test", "blood", "urine", "x-ray", "scan", "mri", "ct", "lab", "report", "sample", "टेस्ट", "जांच"];

// NOTE: communitySlug values MUST match the slugs seeded in the `communities` DB table.
// Mismatches silently fall through and cause irrelevant communities to surface in results.
const SPECIALTY_MAP: { keywords: string[]; specialty: string; communitySlug?: string }[] = [
  { keywords: ["heart", "cardiac", "cardiologist", "chest pain", "blood pressure", "hypertension", "bp"], specialty: "Cardiologist", communitySlug: "heart-health" },
  { keywords: ["diabetes", "sugar", "insulin", "glucose"], specialty: "Endocrinologist", communitySlug: "diabetes-care" },
  { keywords: ["thyroid", "hormone", "hormonal", "pcos", "pcod"], specialty: "Endocrinologist", communitySlug: "thyroid-hormonal" },
  { keywords: ["skin", "rash", "acne", "dermatologist", "eczema"], specialty: "Dermatologist" },
  { keywords: ["bone", "joint", "back pain", "knee", "orthopedic", "fracture", "arthritis"], specialty: "Orthopedic Surgeon", communitySlug: "bone-joint-health" },
  { keywords: ["pregnan", "gynec", "menstrual", "period", "ovary", "uterus", "मातृत्व"], specialty: "Gynecologist", communitySlug: "pregnancy-motherhood" },
  { keywords: ["fertility", "ivf", "conceive", "infertil"], specialty: "Gynecologist", communitySlug: "fertility-ivf" },
  { keywords: ["mental", "anxiety", "depression", "stress", "panic", "sleep", "mood"], specialty: "Psychiatrist", communitySlug: "mental-wellness" },
  { keywords: ["child", "kid", "pediatr", "paediatr", "baby", "infant", "toddler", "बच्चे", "बच्चा"], specialty: "Pediatrician", communitySlug: "child-health" },
  { keywords: ["elder", "senior", "geriatric", "old age"], specialty: "General Physician", communitySlug: "elder-care" },
  { keywords: ["lung", "breathing", "asthma", "cough", "respiratory"], specialty: "Pulmonologist", communitySlug: "respiratory-health" },
  { keywords: ["fitness", "weight", "obesity", "exercise"], specialty: "General Physician", communitySlug: "weight-loss-fitness" },
  { keywords: ["nutrition", "diet", "food", "meal"], specialty: "Dietitian", communitySlug: "nutrition-diet" },
  { keywords: ["work", "burnout", "workplace stress"], specialty: "Psychiatrist", communitySlug: "work-stress-burnout" },
  { keywords: ["cancer", "tumor", "tumour", "oncolog", "chemo"], specialty: "Oncologist", communitySlug: "cancer-support" },
  { keywords: ["brain", "neuro", "migraine", "headache", "seizure", "epilepsy"], specialty: "Neurologist", communitySlug: "neurology-brain" },
];

// Allow-list of community slugs that may appear in search results. Excludes
// admin/business communities (clinical-ops, rcm, isb-alumni) so health-seekers
// only see health-relevant peer groups.
const HEALTH_COMMUNITY_SLUGS = new Set([
  "heart-health", "mental-wellness", "diabetes-care", "thyroid-hormonal",
  "bone-joint-health", "pregnancy-motherhood", "pcos-womens-health",
  "fertility-ivf", "child-health", "elder-care", "weight-loss-fitness",
  "nutrition-diet", "sleep-recovery", "respiratory-health", "cancer-support",
  "infectious-diseases", "work-stress-burnout", "digital-health",
  "alternative-medicine", "neurology-brain",
]);

// Same forbidden-platforms list used by Yukti chat — keeps the search summary on-platform.
const FORBIDDEN_REFERRALS = [
  /\bpracto\b/gi, /\b1\s?mg\b/gi, /\bjustdial\b/gi, /\bapollo\s?24\b/gi,
  /\bpharmeasy\b/gi, /\btata\s?1mg\b/gi, /\blybrate\b/gi, /\bnetmeds\b/gi,
  /\bdr\.?\s?lal\s?path\s?labs?\b/gi, /\bnhp\.gov\b/gi,
  /\bgoogle\s+(search|it|maps?)\b/gi, /\bwebmd\b/gi, /\bzocdoc\b/gi,
  /\bministry of health\b/gi, /\bnational health portal\b/gi,
];
function sanitizeExternalRefs(text: string): string {
  let out = text;
  for (const re of FORBIDDEN_REFERRALS) out = out.replace(re, "HealthCircle");
  out = out.replace(/(use|check|search on|visit|go to)\s+HealthCircle/gi, "use HealthCircle");
  return out;
}

function classifyIntent(query: string): SearchIntent {
  const lower = query.toLowerCase();
  if (DOCTOR_KEYWORDS.some(k => lower.includes(k))) return "doctor";
  if (LAB_KEYWORDS.some(k => lower.includes(k))) return "lab";
  if (TREATMENT_KEYWORDS.some(k => lower.includes(k))) return "treatment";
  if (SYMPTOM_KEYWORDS.some(k => lower.includes(k))) return "symptom";
  return "general";
}

function assessRisk(query: string, intent: SearchIntent): "low" | "medium" | "high" {
  const lower = query.toLowerCase();
  const highRiskTerms = ["chest pain", "can't breathe", "unconscious", "stroke", "heart attack", "severe bleeding", "suicide"];
  const mediumRiskTerms = ["fever", "pain", "swelling", "infection", "बुखार"];
  if (highRiskTerms.some(t => lower.includes(t))) return "high";
  if (intent === "symptom" && mediumRiskTerms.some(t => lower.includes(t))) return "medium";
  return "low";
}

function getRecommendations(intent: SearchIntent, risk: "low" | "medium" | "high"): string[] {
  if (risk === "high") {
    return [
      "Call emergency services (112) immediately",
      "Do not drive yourself to the hospital",
      "Stay calm and keep the patient still",
      "Use HealthCircle's 'Find a Doctor' to alert a verified specialist",
    ];
  }
  switch (intent) {
    case "symptom":
      return [
        "Monitor symptoms for 24-48 hours",
        "Stay hydrated and rest",
        "Book an appointment with a HealthCircle verified doctor if symptoms worsen",
        "Avoid self-medication without professional advice",
      ];
    case "treatment":
      return [
        "Always follow prescribed dosage",
        "Complete the full course of medication",
        "Report side effects to your doctor on HealthCircle chat",
        "Do not share prescriptions with others",
      ];
    case "doctor":
      return [
        "Tap a doctor below to view their profile and book an appointment",
        "Prepare a list of your symptoms before the visit",
        "Bring all previous medical records and test reports",
        "Note any current medications you take",
      ];
    case "lab":
      return [
        "Fast for 8-12 hours if required",
        "Bring your doctor's referral slip",
        "Arrive 15 minutes early",
        "Results typically take 24-48 hours",
      ];
    default:
      return [
        "Browse our verified doctor directory below",
        "Join a HealthCircle community to ask peers",
        "Maintain a healthy lifestyle",
      ];
  }
}

function getMapQuery(intent: SearchIntent, query: string): string {
  switch (intent) {
    case "doctor": return `${query} doctor hospital near me`;
    case "lab": return `diagnostic lab pathology near me`;
    case "symptom": return `doctor clinic hospital near me`;
    case "treatment": return `hospital specialist clinic near me`;
    default: return `doctor hospital clinic near me`;
  }
}

function detectSpecialty(query: string): { specialty: string | null; communitySlug: string | null } {
  const lower = query.toLowerCase();
  for (const m of SPECIALTY_MAP) {
    if (m.keywords.some(k => lower.includes(k))) {
      return { specialty: m.specialty, communitySlug: m.communitySlug ?? null };
    }
  }
  return { specialty: null, communitySlug: null };
}

/**
 * Smart fallback summary — used when AI synthesis is unavailable. Interpolates
 * the actual data we found so the user always sees something specific and
 * useful, never a generic boilerplate.
 */
function templateSummary(
  intent: SearchIntent,
  query: string,
  providers: ProviderResult[],
  communities: RelatedCommunity[],
  discussions: DiscussionResult[],
  risk: "low" | "medium" | "high",
): string {
  const parts: string[] = [];

  if (risk === "high") {
    parts.push(`⚠️ Your query about "${query}" sounds urgent — if this is an emergency, call 108 immediately.`);
  } else {
    const lead: Record<SearchIntent, string> = {
      symptom: `For your concern about "${query}",`,
      treatment: `On treatment for "${query}",`,
      doctor: `Here's what HealthCircle has for "${query}":`,
      lab: `For "${query}" related tests,`,
      general: `On "${query}",`,
    };
    parts.push(lead[intent]);
  }

  const hits: string[] = [];
  if (providers.length) {
    const docs = providers.filter(p => p.type === "doctor");
    const top = docs[0] ?? providers[0];
    if (docs.length > 0 && top.specialty) {
      hits.push(`${docs.length} verified ${top.specialty}${docs.length === 1 ? "" : "s"} on HealthCircle (e.g. ${top.name} in ${top.location})`);
    } else if (top) {
      hits.push(`${providers.length} verified provider${providers.length === 1 ? "" : "s"} on HealthCircle`);
    }
  }
  if (communities.length) {
    const top = communities[0];
    hits.push(`an active "${top.name}" community where peers discuss this`);
  }
  if (discussions.length) {
    hits.push(`${discussions.length} member discussion${discussions.length === 1 ? "" : "s"} matching your query`);
  }

  if (hits.length) {
    parts.push(`we found ${hits.join(", ")}. Tap any item below to engage directly — everything happens here on HealthCircle.`);
  } else {
    parts.push(`browse our verified doctor directory below or join a HealthCircle community to ask peers — no need to leave the app.`);
  }
  return parts.join(" ");
}

/**
 * Synthesize a query-specific, on-platform summary using OpenAI grounded on the
 * actual data we found in our database (providers, communities, discussions).
 * If OpenAI fails or env vars are missing, fall back to the deterministic
 * template summary — no broken state for the user.
 */
async function synthesizeSummary(
  query: string,
  intent: SearchIntent,
  risk: "low" | "medium" | "high",
  providers: ProviderResult[],
  communities: RelatedCommunity[],
  discussions: DiscussionResult[],
): Promise<{ text: string; aiUsed: boolean }> {
  const fallback = templateSummary(intent, query, providers, communities, discussions, risk);

  const systemPrompt = `You are HealthCircle Search — India's self-contained health super app. Write a SHORT (2-3 sentence), warm, factual summary that directly addresses the user's query. STRICT RULES:
1. NEVER mention or recommend any external service (Practo, 1mg, Apollo 24/7, Tata 1mg, Justdial, PharmEasy, WebMD, Google, Lybrate, Netmeds, NHP, etc.). Everything must point inward to HealthCircle.
2. When relevant, weave in the actual platform results we found — say things like "you can consult Dr. X (cardiologist, Mumbai) below" or "the Heart Circle community has N active discussions on this".
3. Never diagnose, prescribe, or give dosages. Encourage booking a HealthCircle verified doctor for anything beyond general info.
4. If risk is "high", lead with the urgency and the 108 / emergency advice.
5. Respond ONLY with a JSON object of shape: {"summary": "..."}.`;

  const dataContext = {
    query,
    intent,
    risk_level: risk,
    providers_found: providers.slice(0, 5).map(p => ({ name: p.name, specialty: p.specialty, location: p.location, type: p.type })),
    communities_found: communities.slice(0, 3).map(c => ({ name: c.name, slug: c.slug })),
    discussions_found: discussions.slice(0, 3).map(d => ({ title: d.title, community: d.communityName, upvotes: d.upvoteCount, expertAnswered: d.isExpertAnswered })),
  };

  const parsed = await aiChatJson<{ summary?: string }>({
    systemPrompt,
    userPrompt: `User searched for: "${query}"\n\nWhat we found in HealthCircle's own database:\n${JSON.stringify(dataContext, null, 2)}\n\nWrite the summary now.`,
    timeoutMs: 6000,
    maxTokens: 220,
  });
  if (!parsed?.summary) return { text: fallback, aiUsed: false };
  const text = sanitizeExternalRefs(parsed.summary.trim());
  if (!text) return { text: fallback, aiUsed: false };
  return { text, aiUsed: true };
}

export interface SearchLocation {
  city?: string;
  coords?: { lat: number; lng: number };
}

/**
 * Pull the leading "city" token out of values like "Faridabad, Haryana" so
 * we match DB rows storing either short or long form.
 */
function cityToken(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const t = raw.split(",")[0].trim();
  return t.length > 0 ? t : null;
}

/**
 * Reverse-geocode browser coords to a human-readable city using OSM
 * Nominatim. Cached via a bounded LRU-ish Map (Map iteration is insertion
 * order — we evict the oldest entries when the cap is hit). Failures are
 * negative-cached for a shorter TTL so a Nominatim outage doesn't trigger
 * a thundering-herd of retries or log-spam.
 */
const reverseCache = new Map<string, { city: string | null; expires: number }>();
const REVERSE_TTL_MS = 30 * 60 * 1000;
const REVERSE_NEG_TTL_MS = 5 * 60 * 1000;
const REVERSE_CACHE_MAX = 1000;

function setReverseCache(key: string, city: string | null, ttl: number): void {
  if (reverseCache.size >= REVERSE_CACHE_MAX) {
    // Evict oldest insertion first (Map preserves insertion order).
    const oldest = reverseCache.keys().next().value;
    if (oldest !== undefined) reverseCache.delete(oldest);
  }
  reverseCache.set(key, { city, expires: Date.now() + ttl });
}

async function reverseGeocodeCity(lat: number, lng: number): Promise<string | null> {
  const key = `${lat.toFixed(3)},${lng.toFixed(3)}`;
  const hit = reverseCache.get(key);
  if (hit && hit.expires > Date.now()) return hit.city;
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10`;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4000);
    const r = await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": "HealthCircle/1.0 (healthcircle.app; contact@healthcircle.app)" },
    }).finally(() => clearTimeout(t));
    if (!r.ok) { setReverseCache(key, null, REVERSE_NEG_TTL_MS); return null; }
    const j = (await r.json()) as { address?: Record<string, string> };
    const a = j.address ?? {};
    const city = a.city || a.town || a.village || a.municipality || a.county || a.state_district || a.state || null;
    setReverseCache(key, city, city ? REVERSE_TTL_MS : REVERSE_NEG_TTL_MS);
    return city;
  } catch (err) {
    logger.warn({ err, lat, lng }, "reverse geocode failed");
    setReverseCache(key, null, REVERSE_NEG_TTL_MS);
    return null;
  }
}

export async function runHealthSearch(
  query: string,
  userId?: number,
  language?: string,
  location?: SearchLocation,
): Promise<SearchResult> {
  const intent = classifyIntent(query);
  // Emergency hard-stop overrides any heuristic risk score — if the query
  // includes life-threatening triggers (chest pain, suicide, breathing
  // distress, etc. across English/Hinglish/Indic), bump risk to "high" so
  // the UI shows the urgent banner and the AI synthesis leads with 108.
  const emergency = detectEmergency(query);

  // Hard-stop: if a life-threatening trigger fires, return an immediate,
  // unmissable 108 response without spending DB queries or AI latency.
  // The user sees the urgent guidance instantly and we still log the search
  // so MedPro/admin dashboards can see the spike.
  if (emergency) {
    if (userId) {
      try {
        await db.insert(searchLogsTable).values({
          userId, query, intent, riskLevel: "high", language: language ?? "en",
        });
      } catch { /* logging is best-effort */ }
    }
    return {
      intent: "general",
      summary: "🚨 This sounds like a medical emergency. Call 108 (ambulance) immediately. If you can't call yourself, ask someone nearby. Do not wait. Inside HealthCircle, tap 'Get a Doctor's Opinion' to alert a verified medical professional in parallel.",
      risk_level: "high",
      recommendations: [
        "CALL 108 NOW — India's national ambulance service (free)",
        "If you cannot call, ask someone nearby to call for you",
        "Do not leave the person alone",
        "Tap 'Get a Doctor's Opinion' inside the chat to alert a HealthCircle verified doctor",
      ],
      providers: [],
      relatedCommunities: [],
      discussions: [],
      mapQuery: "",
      ai_synthesized: false,
      detectedSpecialty: null,
      providerEmptyReason: null,
    };
  }

  const risk = assessRisk(query, intent);
  const recommendations = getRecommendations(intent, risk);
  const { specialty, communitySlug } = detectSpecialty(query);

  // ── Resolve user's city ──
  // Prefer explicit `city` param; otherwise reverse-geocode the browser
  // coords. The result is used (a) as a hard SQL filter on DB providers and
  // (b) as the bbox for the OSM live fallback when the DB has no city-local
  // matches.
  let cityFull: string | null = location?.city?.trim() || null;
  if (!cityFull && location?.coords) {
    cityFull = await reverseGeocodeCity(location.coords.lat, location.coords.lng);
  }
  const cityShort = cityToken(cityFull);

  // mapQuery now includes the resolved city when available, so the embedded
  // Google Map zooms to the user's area instead of "near me" guessing.
  const mapQuery = cityFull ? `${getMapQuery(intent, query)} ${cityFull}` : getMapQuery(intent, query);

  // ── Providers (doctors + hospitals) ──
  // If a specialty was detected but we have ZERO doctors of that specialty in
  // our verified network, we DO NOT silently backfill with random doctors —
  // that misleads users (e.g. searching "pediatrician" and getting a cardiologist
  // is a worse experience than an honest "no verified pediatricians yet").
  let providers: ProviderResult[] = [];
  let providerEmptyReason: "no_specialty_match" | "no_general_match" | null = null;
  // Generic provider intent like "doctor near me" / "find a hospital" — no
  // meaningful keywords beyond fillers we'd strip anyway. Skip the fuzzy
  // ILIKE that would otherwise return zero rows.
  const isGeneric = isGenericProviderQuery(query);
  try {
    if (intent !== "lab") {
      let final: typeof doctorsTable.$inferSelect[] = [];

      const cityCond = cityShort ? ilike(doctorsTable.location, `%${cityShort}%`) : null;

      if (specialty) {
        // Strict: only doctors actually matching the requested specialty
        // AND (when known) located in the user's city.
        const conds = [eq(doctorsTable.available, true), ilike(doctorsTable.specialty, `%${specialty}%`)];
        if (cityCond) conds.push(cityCond);
        final = await db.select().from(doctorsTable).where(and(...conds)).limit(5);
        if (final.length === 0) providerEmptyReason = "no_specialty_match";
      } else if (isGeneric) {
        // "doctor near me" — no useful keyword. Just return available
        // doctors, filtered by city if known, sorted by rating so the user
        // gets a sensible default list instead of an empty page.
        const conds = [eq(doctorsTable.available, true)];
        if (cityCond) conds.push(cityCond);
        final = await db.select().from(doctorsTable).where(and(...conds)).orderBy(desc(doctorsTable.rating)).limit(5);
        if (final.length === 0) providerEmptyReason = "no_general_match";
      } else {
        // Specific free-text query: fuzzy match on name/specialty/location,
        // AND-ed with city when known so a "diabetes" search in Faridabad
        // doesn't surface Mumbai dummy rows. Location stays inside the
        // fuzzy OR so callers without coords (no city filter) can still
        // hit doctors via "<query> mumbai" style text searches.
        const fuzzy = or(
          ilike(doctorsTable.name, `%${query}%`),
          ilike(doctorsTable.specialty, `%${query}%`),
          ilike(doctorsTable.location, `%${query}%`),
        );
        const conds = [eq(doctorsTable.available, true), fuzzy];
        if (cityCond) conds.push(cityCond);
        final = await db.select().from(doctorsTable).where(and(...conds)).limit(5);
        if (final.length === 0) providerEmptyReason = "no_general_match";
      }

      providers = providers.concat(
        final.map(d => ({
          id: d.id,
          type: "doctor" as const,
          name: d.name,
          specialty: d.specialty,
          location: d.location,
          rating: d.rating,
          available: d.available,
        })),
      );

      // Live OSM fallback for doctors. Two paths, in order of preference:
      //   1. cityFull known     → bbox query around the city
      //   2. coords known       → around:radius circle around lat/lng
      // This means even if Nominatim reverse-geocode fails (rate-limited or
      // an unfamiliar locality), the user still sees real local doctors as
      // long as their browser shared coordinates.
      if (final.length === 0 && cityFull) {
        try {
          const live = await fetchLiveDoctors({
            specialty: specialty ?? undefined,
            q: specialty || isGeneric ? undefined : query,
            city: cityFull,
          });
          if (live.length > 0) {
            providers = providers.concat(
              live.slice(0, 5).map(d => ({
                id: d.id,
                type: "doctor" as const,
                name: d.name,
                specialty: d.specialty,
                location: d.location,
                rating: d.rating,
                available: d.available,
                source: "openstreetmap" as const,
                sourceUrl: d.sourceUrl,
              })),
            );
            providerEmptyReason = null;
          }
        } catch (err) {
          logger.warn({ err }, "live doctor fallback failed");
        }
      }

      // Coords-based OSM fallback — only used when the city-bbox path
      // either wasn't available or produced nothing.
      if (
        providers.filter(p => p.type === "doctor").length === 0 &&
        location?.coords &&
        !cityFull
      ) {
        try {
          const live = await fetchLiveDoctorsByCoords({
            lat: location.coords.lat,
            lng: location.coords.lng,
            specialty: specialty ?? undefined,
            q: specialty || isGeneric ? undefined : query,
          });
          if (live.length > 0) {
            providers = providers.concat(
              live.slice(0, 5).map(d => ({
                id: d.id,
                type: "doctor" as const,
                name: d.name,
                specialty: d.specialty,
                location: d.location,
                rating: d.rating,
                available: d.available,
                source: "openstreetmap" as const,
                sourceUrl: d.sourceUrl,
              })),
            );
            providerEmptyReason = null;
          }
        } catch (err) {
          logger.warn({ err }, "live doctor coords fallback failed");
        }
      }
    }

    // Hospitals — generic queries skip the fuzzy filter so "hospital near me"
    // doesn't fail to match the literal string.
    const hConds: ReturnType<typeof and>[] = [];
    if (!isGeneric) {
      hConds.push(or(ilike(hospitalsTable.name, `%${query}%`), ilike(hospitalsTable.location, `%${query}%`)));
    }
    if (cityShort) hConds.push(ilike(hospitalsTable.location, `%${cityShort}%`));
    const hospitals = hConds.length
      ? await db.select().from(hospitalsTable).where(and(...hConds)).limit(3)
      : await db.select().from(hospitalsTable).orderBy(desc(hospitalsTable.rating)).limit(3);

    providers = providers.concat(
      hospitals.map(h => ({ id: h.id, type: "hospital" as const, name: h.name, location: h.location, rating: h.rating })),
    );

    if (hospitals.length === 0 && cityFull) {
      try {
        const liveH = await fetchLiveHospitals({ q: isGeneric ? undefined : query, city: cityFull });
        providers = providers.concat(
          liveH.slice(0, 3).map(h => ({
            id: h.id,
            type: "hospital" as const,
            name: h.name,
            location: h.location,
            rating: h.rating,
            source: "openstreetmap" as const,
            sourceUrl: h.sourceUrl,
          })),
        );
      } catch (err) {
        logger.warn({ err }, "live hospital fallback failed");
      }
    }

    if (
      providers.filter(p => p.type === "hospital").length === 0 &&
      location?.coords &&
      !cityFull
    ) {
      try {
        const liveH = await fetchLiveHospitalsByCoords({
          lat: location.coords.lat,
          lng: location.coords.lng,
          q: isGeneric ? undefined : query,
        });
        providers = providers.concat(
          liveH.slice(0, 3).map(h => ({
            id: h.id,
            type: "hospital" as const,
            name: h.name,
            location: h.location,
            rating: h.rating,
            source: "openstreetmap" as const,
            sourceUrl: h.sourceUrl,
          })),
        );
      } catch (err) {
        logger.warn({ err }, "live hospital coords fallback failed");
      }
    }
  } catch {
    // graceful — empty is fine
  }

  // Last-resort safety net: if the user asked a *generic* doctor question
  // ("doctor near me", "find a physician") and we still have nothing to
  // show, surface the top-rated verified doctors nationwide. We deliberately
  // do NOT do this for specialty queries — if the user searched for a
  // pediatrician and we have none verified, we keep the result empty and
  // let the UI show its honest "no verified Pediatrician yet" message
  // (driven by `providerEmptyReason`). Showing a cardiologist under a
  // "Verified Pediatricians" heading would be misleading.
  if (providers.length === 0 && intent === "doctor" && !specialty && isGeneric) {
    try {
      const fallback = await db
        .select()
        .from(doctorsTable)
        .where(eq(doctorsTable.available, true))
        .orderBy(desc(doctorsTable.rating))
        .limit(5);
      if (fallback.length > 0) {
        providers = providers.concat(
          fallback.map(d => ({
            id: d.id,
            type: "doctor" as const,
            name: d.name,
            specialty: d.specialty,
            location: d.location,
            rating: d.rating,
            available: d.available,
          })),
        );
        // Generic-intent results found via the nationwide net are still
        // useful, so clear the empty-reason flag.
        providerEmptyReason = null;
      }
    } catch {
      // graceful
    }
  }

  // ── Communities ──
  // Only health communities ever surface here. Admin/business communities
  // (clinical-ops, rcm, isb-alumni) are excluded via HEALTH_COMMUNITY_SLUGS so
  // a health-seeker never sees "ISB Alumni Network" while searching for a
  // pediatrician.
  let relatedCommunities: RelatedCommunity[] = [];
  try {
    const allCommunities = await db
      .select({
        id: communitiesTable.id,
        slug: communitiesTable.slug,
        name: communitiesTable.name,
        description: communitiesTable.description,
        iconEmoji: communitiesTable.iconEmoji,
        iconUrl: communitiesTable.iconUrl,
      })
      .from(communitiesTable)
      .where(eq(communitiesTable.isArchived, false));

    const healthOnly = allCommunities.filter(c => HEALTH_COMMUNITY_SLUGS.has(c.slug));

    // 1. Direct match for the detected specialty's community (highest signal).
    if (communitySlug) {
      const direct = healthOnly.find(c => c.slug === communitySlug);
      if (direct) relatedCommunities.push(direct);
    }

    // 2. Fuzzy text match against community name/description.
    const lowerQ = query.toLowerCase();
    const fuzzy = healthOnly
      .filter(c => !relatedCommunities.find(r => r.id === c.id))
      .filter(c =>
        c.name.toLowerCase().includes(lowerQ) ||
        (c.description ?? "").toLowerCase().includes(lowerQ)
      );
    relatedCommunities = relatedCommunities.concat(fuzzy.slice(0, 2));

    // 3. Backfill from a curated "popular" set, not alphabetical order.
    if (relatedCommunities.length < 3) {
      const POPULAR_FALLBACK = ["heart-health", "mental-wellness", "diabetes-care", "weight-loss-fitness", "child-health"];
      const popular = POPULAR_FALLBACK
        .map(slug => healthOnly.find(c => c.slug === slug))
        .filter((c): c is NonNullable<typeof c> => !!c)
        .filter(c => !relatedCommunities.find(r => r.id === c.id));
      relatedCommunities = relatedCommunities.concat(popular.slice(0, 3 - relatedCommunities.length));
    }
  } catch {
    // graceful
  }

  // ── Community discussions (posts) — NEW ──
  // Surface real conversations on the platform that match the user's query so
  // they have an immediate way to engage with peers and verified pros.
  let discussions: DiscussionResult[] = [];
  try {
    const pattern = `%${query}%`;
    const rows = await db
      .select({
        id: postsTable.id,
        title: postsTable.title,
        content: postsTable.content,
        upvoteCount: postsTable.upvoteCount,
        commentCount: postsTable.commentCount,
        isExpertAnswered: postsTable.isExpertAnswered,
        createdAt: postsTable.createdAt,
        communitySlug: communitiesTable.slug,
        communityName: communitiesTable.name,
        authorName: usersTable.displayName,
      })
      .from(postsTable)
      .leftJoin(communitiesTable, eq(postsTable.communityId, communitiesTable.id))
      .leftJoin(usersTable, eq(postsTable.authorId, usersTable.id))
      .where(or(ilike(postsTable.title, pattern), ilike(postsTable.content, pattern)))
      .orderBy(desc(postsTable.isExpertAnswered), desc(postsTable.upvoteCount), desc(postsTable.createdAt))
      .limit(5);

    discussions = rows
      // Health allow-list applies here too — a peer post in "Clinical Ops" or
      // "ISB Alumni" must never appear inside a health-search result.
      .filter(r => r.communitySlug && r.communityName && HEALTH_COMMUNITY_SLUGS.has(r.communitySlug))
      .map(r => ({
        id: r.id,
        title: r.title,
        excerpt: (r.content ?? "").replace(/\s+/g, " ").slice(0, 160) + ((r.content ?? "").length > 160 ? "…" : ""),
        communitySlug: r.communitySlug as string,
        communityName: r.communityName as string,
        authorName: r.authorName,
        upvoteCount: r.upvoteCount,
        commentCount: r.commentCount,
        isExpertAnswered: r.isExpertAnswered,
        createdAt: r.createdAt as Date,
      }));
  } catch {
    // graceful
  }

  // ── Search log ──
  if (userId) {
    try {
      await db.insert(searchLogsTable).values({ userId, query, intent, language: language ?? "en" });
    } catch {
      // graceful
    }
  }

  // ── AI synthesis grounded on the actual results above ──
  const { text: aiSummary, aiUsed } = await synthesizeSummary(query, intent, risk, providers, relatedCommunities, discussions);

  return {
    intent,
    summary: aiSummary,
    risk_level: risk,
    recommendations: recommendations.map(sanitizeExternalRefs),
    providers,
    relatedCommunities,
    discussions,
    mapQuery,
    ai_synthesized: aiUsed,
    detectedSpecialty: specialty,
    providerEmptyReason,
  };
}

// Suppress unused-import warnings for sql (kept for potential future use)
void sql;
