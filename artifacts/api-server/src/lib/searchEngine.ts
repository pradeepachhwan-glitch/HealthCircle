import { db } from "@workspace/db";
import { doctorsTable, hospitalsTable, searchLogsTable, communitiesTable } from "@workspace/db/schema";
import { ilike, or, eq, and } from "drizzle-orm";

export type SearchIntent = "symptom" | "treatment" | "doctor" | "lab" | "general";

export interface SearchResult {
  intent: SearchIntent;
  summary: string;
  risk_level: "low" | "medium" | "high";
  recommendations: string[];
  providers: ProviderResult[];
  relatedCommunities: RelatedCommunity[];
  mapQuery: string;
}

interface ProviderResult {
  id: number;
  type: "doctor" | "hospital";
  name: string;
  specialty?: string;
  location: string;
  rating: string;
  available?: boolean;
}

interface RelatedCommunity {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  iconEmoji: string | null;
}

const SYMPTOM_KEYWORDS = ["pain", "ache", "fever", "cold", "cough", "headache", "dizzy", "nausea", "fatigue", "swelling", "rash", "bleed", "breathe", "chest", "stomach", "दर्द", "बुखार", "सिरदर्द", "खांसी"];
const TREATMENT_KEYWORDS = ["treat", "cure", "medicine", "drug", "therapy", "surgery", "vaccine", "dose", "dosage", "prescription", "इलाज", "दवा"];
const DOCTOR_KEYWORDS = ["doctor", "specialist", "physician", "surgeon", "cardiologist", "dermatologist", "orthopedic", "gynecologist", "डॉक्टर", "चिकित्सक"];
const LAB_KEYWORDS = ["test", "blood", "urine", "x-ray", "scan", "mri", "ct", "lab", "report", "sample", "टेस्ट", "जांच"];

const SPECIALTY_MAP: { keywords: string[]; specialty: string; communitySlug?: string }[] = [
  { keywords: ["heart", "cardiac", "cardiologist", "chest pain", "blood pressure", "hypertension", "bp"], specialty: "Cardiologist", communitySlug: "heart-circle" },
  { keywords: ["diabetes", "sugar", "insulin", "glucose"], specialty: "Endocrinologist", communitySlug: "sugar-care" },
  { keywords: ["skin", "rash", "acne", "dermatologist", "eczema"], specialty: "Dermatologist" },
  { keywords: ["bone", "joint", "back pain", "knee", "orthopedic", "fracture"], specialty: "Orthopedic Surgeon" },
  { keywords: ["pregnan", "gynec", "menstrual", "period", "ovary", "uterus", "मातृत्व"], specialty: "Gynecologist", communitySlug: "mom-journey" },
  { keywords: ["mental", "anxiety", "depression", "stress", "panic", "sleep"], specialty: "Psychiatrist", communitySlug: "mind-space" },
  { keywords: ["child", "kid", "pediatric", "baby"], specialty: "Pediatrician" },
  { keywords: ["lung", "breathing", "asthma", "cough", "respiratory"], specialty: "Pulmonologist" },
  { keywords: ["fitness", "weight", "obesity", "exercise", "diet"], specialty: "General Physician", communitySlug: "fit-life" },
  { keywords: ["work", "burnout", "workplace stress"], specialty: "Psychiatrist", communitySlug: "work-reset" },
];

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

export async function runHealthSearch(query: string, userId?: number, language?: string): Promise<SearchResult> {
  const intent = classifyIntent(query);
  const risk = assessRisk(query, intent);
  const recommendations = getRecommendations(intent, risk);
  const mapQuery = getMapQuery(intent, query);
  const { specialty, communitySlug } = detectSpecialty(query);

  let providers: ProviderResult[] = [];
  try {
    // Doctor search — prefer detected specialty match, then fall back to text search
    if (intent !== "lab") {
      const conditions = [];
      if (specialty) conditions.push(ilike(doctorsTable.specialty, `%${specialty}%`));
      conditions.push(ilike(doctorsTable.name, `%${query}%`));
      conditions.push(ilike(doctorsTable.specialty, `%${query}%`));
      conditions.push(ilike(doctorsTable.location, `%${query}%`));

      const doctors = await db
        .select()
        .from(doctorsTable)
        .where(and(eq(doctorsTable.available, true), or(...conditions)))
        .limit(5);

      // If no specialty matches, broaden to top-rated doctors so user always sees options
      let final = doctors;
      if (final.length === 0) {
        final = await db.select().from(doctorsTable).where(eq(doctorsTable.available, true)).limit(5);
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
    }

    // Hospital search
    const hospitals = await db
      .select()
      .from(hospitalsTable)
      .where(or(ilike(hospitalsTable.name, `%${query}%`), ilike(hospitalsTable.location, `%${query}%`)))
      .limit(3);

    providers = providers.concat(
      hospitals.map(h => ({
        id: h.id,
        type: "hospital" as const,
        name: h.name,
        location: h.location,
        rating: h.rating,
      })),
    );
  } catch {
    // Provider search gracefully fails — empty array is fine
  }

  // Related HealthCircle communities (always native — never external)
  let relatedCommunities: RelatedCommunity[] = [];
  try {
    const allCommunities = await db
      .select({
        id: communitiesTable.id,
        slug: communitiesTable.slug,
        name: communitiesTable.name,
        description: communitiesTable.description,
        iconEmoji: communitiesTable.iconEmoji,
      })
      .from(communitiesTable)
      .where(eq(communitiesTable.isArchived, false));

    if (communitySlug) {
      const direct = allCommunities.find(c => c.slug === communitySlug);
      if (direct) relatedCommunities.push(direct);
    }
    // Also include up to 2 communities whose name/description matches the query terms
    const lowerQ = query.toLowerCase();
    const fuzzy = allCommunities
      .filter(c => c.slug !== communitySlug)
      .filter(c => c.name.toLowerCase().includes(lowerQ) || (c.description ?? "").toLowerCase().includes(lowerQ));
    relatedCommunities = relatedCommunities.concat(fuzzy.slice(0, 2));
    // Always at least show 3 communities so user has something to engage with
    if (relatedCommunities.length < 3) {
      const remaining = allCommunities
        .filter(c => !relatedCommunities.find(r => r.id === c.id))
        .slice(0, 3 - relatedCommunities.length);
      relatedCommunities = relatedCommunities.concat(remaining);
    }
  } catch {
    // Communities lookup gracefully fails
  }

  if (userId) {
    try {
      await db.insert(searchLogsTable).values({ userId, query, intent, language: language ?? "en" });
    } catch {
      // Log gracefully fails
    }
  }

  const summaries: Record<SearchIntent, string> = {
    symptom: `Based on your query about "${query}", here are AI insights, related HealthCircle communities, and verified doctors you can consult.`,
    treatment: `Here is evidence-based information about treatment options for "${query}", with verified specialists you can book directly.`,
    doctor: `Here are HealthCircle's verified specialists for "${query}". Tap any to view their profile and book an appointment.`,
    lab: `Here are details about lab tests related to "${query}". Use HealthCircle to discuss with a specialist.`,
    general: `Here is health information related to "${query}", with relevant communities and specialists you can engage with on HealthCircle.`,
  };

  return {
    intent,
    summary: summaries[intent],
    risk_level: risk,
    recommendations,
    providers,
    relatedCommunities,
    mapQuery,
  };
}
